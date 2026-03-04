# US-010 : Connexion utilisateur

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **ID** | US-010 |
| **Épique** | E2 — Cloud Integration |
| **Sprint** | Sprint 2 |
| **Estimation** | 3 points |
| **Priorité** | 🔴 MUST |
| **Status** | Ready |

---

## Description

**En tant qu'** utilisateur existant
**Je veux** me connecter avec mes identifiants
**Afin de** retrouver mon compte et mes préférences

---

## Contexte technique

### Stack

- **UI** : SwiftUI Form
- **Auth** : JWT (access + refresh tokens)
- **Biométrie** : Face ID / Touch ID (optionnel)
- **Storage** : Keychain

---

## Critères d'acceptation

- [ ] **AC-001** : Formulaire email + mot de passe
- [ ] **AC-002** : Option "Rester connecté"
- [ ] **AC-003** : Login avec Face ID / Touch ID
- [ ] **AC-004** : Refresh token automatique
- [ ] **AC-005** : Redirection vers Home

---

## Tâches de développement

### T1 : AuthService.login (1h)

```swift
func login(email: String, password: String) async throws -> User {
    let url = URL(string: "\(baseURL)/auth/login")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    
    let body = ["email": email, "password": password]
    request.httpBody = try JSONEncoder().encode(body)
    
    let (data, response) = try await URLSession.shared.data(for: request)
    
    guard let httpResponse = response as? HTTPURLResponse,
          httpResponse.statusCode == 200 else {
        throw AuthError.invalidCredentials
    }
    
    let result = try JSONDecoder().decode(RegisterResponse.self, from: data)
    try keychain.save(tokens: result.tokens)
    return result.user
}
```

### T2 : Biometric authentication (1h)

```swift
import LocalAuthentication

func loginWithBiometrics() async throws -> User {
    let context = LAContext()
    var error: NSError?
    
    guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
        throw AuthError.biometricsUnavailable
    }
    
    let success = try await context.evaluatePolicy(
        .deviceOwnerAuthenticationWithBiometrics,
        localizedReason: "Connecte-toi à Diva"
    )
    
    guard success else { throw AuthError.biometricsFailed }
    
    // Utiliser refresh token stocké
    return try await refreshSession()
}
```

### T3 : Auto-refresh token (1h)

```swift
func refreshSession() async throws -> User {
    guard let refreshToken = keychain.getRefreshToken() else {
        throw AuthError.notAuthenticated
    }
    
    let url = URL(string: "\(baseURL)/auth/refresh")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("Bearer \(refreshToken)", forHTTPHeaderField: "Authorization")
    
    let (data, response) = try await URLSession.shared.data(for: request)
    
    guard let httpResponse = response as? HTTPURLResponse,
          httpResponse.statusCode == 200 else {
        try keychain.clear()
        throw AuthError.sessionExpired
    }
    
    let result = try JSONDecoder().decode(RegisterResponse.self, from: data)
    try keychain.save(tokens: result.tokens)
    return result.user
}
```

### T4 : LoginView (1h)

```swift
struct LoginView: View {
    @StateObject private var viewModel = AuthViewModel()
    
    var body: some View {
        Form {
            Section("Connexion") {
                TextField("Email", text: $viewModel.email)
                SecureField("Mot de passe", text: $viewModel.password)
            }
            
            Section {
                Button("Se connecter") {
                    Task { await viewModel.login() }
                }
                .disabled(viewModel.email.isEmpty || viewModel.password.isEmpty)
                
                if LAContext().canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil) {
                    Button("Face ID / Touch ID") {
                        Task { await viewModel.loginWithBiometrics() }
                    }
                }
            }
        }
    }
}
```

---

## Tests manuels

| # | Scénario | Résultat attendu |
|---|----------|------------------|
| 1 | Login correct | Redirection Home |
| 2 | Mauvais mot de passe | Erreur "Identifiants incorrects" |
| 3 | Face ID | Connexion réussie |
| 4 | Token expiré | Auto-refresh transparent |
| 5 | Refresh expiré | Retour login |

---

## Dépendances

- **Prérequise** : US-009 (Inscription)
- **Bloquante pour** : US-012 (Claude API)

---

*Story créée par Bob (SM BMAD) — 2026-03-04*
