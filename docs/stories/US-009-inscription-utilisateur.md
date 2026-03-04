# US-009 : Inscription utilisateur

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **ID** | US-009 |
| **Épique** | E2 — Cloud Integration |
| **Sprint** | Sprint 2 |
| **Estimation** | 3 points |
| **Priorité** | 🔴 MUST |
| **Status** | Ready |

---

## Description

**En tant que** nouvel utilisateur
**Je veux** créer un compte avec mon email
**Afin d'** accéder aux fonctionnalités cloud de Diva

---

## Contexte technique

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Registration Flow                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  Form    │───►│ Validate │───►│  API     │───►│ Keychain │  │
│  │ (SwiftUI)│    │  Client  │    │  /auth/  │    │  Store   │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│                                                                  │
│  Validation:                                                     │
│  • Email format                                                  │
│  • Password >= 8 chars                                          │
│  • Confirmation match                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Stack

- **UI** : SwiftUI Form
- **Validation** : Client-side + Server-side
- **API** : POST /auth/register
- **Storage** : iOS Keychain (via KeychainAccess)

### Fichiers à créer

```
app/
├── views/auth/
│   └── RegisterView.swift
├── viewmodels/
│   └── AuthViewModel.swift
├── services/
│   └── AuthService.swift
├── models/
│   └── User.swift
└── utils/
    └── KeychainManager.swift
```

---

## Critères d'acceptation

### Fonctionnels

- [ ] **AC-001** : Formulaire avec email, mot de passe, confirmation
- [ ] **AC-002** : Validation email (format correct)
- [ ] **AC-003** : Validation mot de passe (>= 8 caractères)
- [ ] **AC-004** : Validation confirmation (match)
- [ ] **AC-005** : Appel API /auth/register
- [ ] **AC-006** : Stockage tokens en Keychain
- [ ] **AC-007** : Redirection vers Home après inscription

### Non-fonctionnels

- [ ] **AC-008** : Loading state pendant l'appel API
- [ ] **AC-009** : Messages d'erreur clairs

### Erreurs

- [ ] **AC-010** : "Email déjà utilisé" si compte existe
- [ ] **AC-011** : "Erreur réseau" si offline

---

## Tâches de développement

### T1 : Modèle User (30min)

```swift
// User.swift
struct User: Codable, Identifiable {
    let id: String
    let email: String
    let createdAt: Date
}

struct AuthTokens: Codable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int
}

struct RegisterRequest: Codable {
    let email: String
    let password: String
}

struct RegisterResponse: Codable {
    let user: User
    let tokens: AuthTokens
}
```

### T2 : KeychainManager (1h)

```swift
// KeychainManager.swift
import KeychainAccess

class KeychainManager {
    private let keychain = Keychain(service: "ai.diva.app")
    
    enum Key: String {
        case accessToken
        case refreshToken
        case userId
    }
    
    func save(tokens: AuthTokens) throws {
        try keychain.set(tokens.accessToken, key: Key.accessToken.rawValue)
        try keychain.set(tokens.refreshToken, key: Key.refreshToken.rawValue)
    }
    
    func getAccessToken() -> String? {
        try? keychain.get(Key.accessToken.rawValue)
    }
    
    func getRefreshToken() -> String? {
        try? keychain.get(Key.refreshToken.rawValue)
    }
    
    func clear() throws {
        try keychain.removeAll()
    }
}
```

### T3 : AuthService (1h)

```swift
// AuthService.swift
import Foundation

class AuthService {
    private let baseURL = "https://api.diva.ai"
    private let keychain = KeychainManager()
    
    func register(email: String, password: String) async throws -> User {
        let url = URL(string: "\(baseURL)/auth/register")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = RegisterRequest(email: email, password: password)
        request.httpBody = try JSONEncoder().encode(body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw AuthError.invalidResponse
        }
        
        switch httpResponse.statusCode {
        case 201:
            let result = try JSONDecoder().decode(RegisterResponse.self, from: data)
            try keychain.save(tokens: result.tokens)
            return result.user
        case 409:
            throw AuthError.emailAlreadyExists
        case 400:
            throw AuthError.invalidInput
        default:
            throw AuthError.serverError(httpResponse.statusCode)
        }
    }
}

enum AuthError: Error, LocalizedError {
    case emailAlreadyExists
    case invalidInput
    case invalidResponse
    case serverError(Int)
    
    var errorDescription: String? {
        switch self {
        case .emailAlreadyExists:
            return "Cet email est déjà utilisé."
        case .invalidInput:
            return "Email ou mot de passe invalide."
        case .invalidResponse:
            return "Réponse serveur invalide."
        case .serverError(let code):
            return "Erreur serveur (\(code))."
        }
    }
}
```

### T4 : AuthViewModel (1h)

```swift
// AuthViewModel.swift
import SwiftUI

@MainActor
class AuthViewModel: ObservableObject {
    @Published var email = ""
    @Published var password = ""
    @Published var confirmPassword = ""
    @Published var isLoading = false
    @Published var error: String?
    @Published var isAuthenticated = false
    
    private let authService = AuthService()
    
    var isEmailValid: Bool {
        let emailRegex = #"^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$"#
        return email.range(of: emailRegex, options: [.regularExpression, .caseInsensitive]) != nil
    }
    
    var isPasswordValid: Bool {
        password.count >= 8
    }
    
    var doPasswordsMatch: Bool {
        password == confirmPassword && !password.isEmpty
    }
    
    var canRegister: Bool {
        isEmailValid && isPasswordValid && doPasswordsMatch
    }
    
    func register() async {
        guard canRegister else { return }
        
        isLoading = true
        error = nil
        
        do {
            _ = try await authService.register(email: email, password: password)
            isAuthenticated = true
        } catch {
            self.error = error.localizedDescription
        }
        
        isLoading = false
    }
}
```

### T5 : RegisterView (1h)

```swift
// RegisterView.swift
import SwiftUI

struct RegisterView: View {
    @StateObject private var viewModel = AuthViewModel()
    
    var body: some View {
        NavigationStack {
            Form {
                Section("Créer un compte") {
                    TextField("Email", text: $viewModel.email)
                        .textContentType(.emailAddress)
                        .autocapitalization(.none)
                        .keyboardType(.emailAddress)
                    
                    SecureField("Mot de passe", text: $viewModel.password)
                        .textContentType(.newPassword)
                    
                    SecureField("Confirmer", text: $viewModel.confirmPassword)
                        .textContentType(.newPassword)
                }
                
                if let error = viewModel.error {
                    Section {
                        Text(error)
                            .foregroundColor(.red)
                    }
                }
                
                Section {
                    Button(action: {
                        Task { await viewModel.register() }
                    }) {
                        if viewModel.isLoading {
                            ProgressView()
                        } else {
                            Text("S'inscrire")
                        }
                    }
                    .disabled(!viewModel.canRegister || viewModel.isLoading)
                }
                
                Section {
                    NavigationLink("Déjà un compte ? Se connecter") {
                        LoginView()
                    }
                }
            }
            .navigationTitle("Inscription")
            .navigationDestination(isPresented: $viewModel.isAuthenticated) {
                HomeView()
            }
        }
    }
}
```

---

## Tests requis

### Tests unitaires

```swift
// AuthViewModelTests.swift
func testEmailValidation() {
    let vm = AuthViewModel()
    
    vm.email = "invalid"
    XCTAssertFalse(vm.isEmailValid)
    
    vm.email = "test@example.com"
    XCTAssertTrue(vm.isEmailValid)
}

func testPasswordValidation() {
    let vm = AuthViewModel()
    
    vm.password = "short"
    XCTAssertFalse(vm.isPasswordValid)
    
    vm.password = "longenough"
    XCTAssertTrue(vm.isPasswordValid)
}

func testPasswordMatch() {
    let vm = AuthViewModel()
    
    vm.password = "password123"
    vm.confirmPassword = "different"
    XCTAssertFalse(vm.doPasswordsMatch)
    
    vm.confirmPassword = "password123"
    XCTAssertTrue(vm.doPasswordsMatch)
}
```

### Tests manuels

| # | Scénario | Résultat attendu |
|---|----------|------------------|
| 1 | Email invalide | Bouton désactivé |
| 2 | Mot de passe < 8 chars | Bouton désactivé |
| 3 | Mots de passe différents | Bouton désactivé |
| 4 | Formulaire valide | Inscription réussie |
| 5 | Email existant | Message d'erreur |
| 6 | Mode avion | Erreur réseau |

---

## Dépendances

### Prérequises

- API serveur /auth/register déployée

### Bloquantes pour

- US-010 (Connexion)
- US-012 (Claude API — nécessite auth)

---

## Definition of Done

- [ ] Code implémenté
- [ ] Tests unitaires passent
- [ ] Tests manuels validés
- [ ] Keychain stocke les tokens
- [ ] Code review approuvée
- [ ] PR mergée

---

*Story créée par Bob (SM BMAD) — 2026-03-04*
