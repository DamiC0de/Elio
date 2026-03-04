# US-013 : Contexte conversationnel

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **ID** | US-013 |
| **Épique** | E2 — Cloud Integration |
| **Sprint** | Sprint 2 |
| **Estimation** | 3 points |
| **Priorité** | 🔴 MUST |
| **Status** | Ready |

---

## Description

**En tant qu'** utilisateur
**Je veux** que Diva se souvienne de notre conversation
**Afin de** pouvoir faire référence à des éléments précédents

---

## Critères d'acceptation

- [ ] **AC-001** : Stockage local des 10 derniers échanges
- [ ] **AC-002** : Contexte envoyé au cloud (anonymisé)
- [ ] **AC-003** : TTL 24h pour le contexte
- [ ] **AC-004** : Reset possible ("oublie tout")
- [ ] **AC-005** : Persistence entre sessions app

---

## Tâches de développement

### T1 : ConversationStore (1.5h)

```swift
// ConversationStore.swift
import Foundation

struct Message: Codable, Identifiable {
    let id: UUID
    let role: Role
    let content: String
    let timestamp: Date
    
    enum Role: String, Codable {
        case user
        case assistant
    }
}

class ConversationStore: ObservableObject {
    @Published var messages: [Message] = []
    
    private let maxMessages = 10
    private let ttl: TimeInterval = 24 * 60 * 60 // 24h
    private let storageKey = "conversation_context"
    
    init() {
        loadFromDisk()
        pruneExpired()
    }
    
    func add(_ message: Message) {
        messages.append(message)
        if messages.count > maxMessages {
            messages.removeFirst()
        }
        saveToDisk()
    }
    
    func clear() {
        messages.removeAll()
        UserDefaults.standard.removeObject(forKey: storageKey)
    }
    
    private func pruneExpired() {
        let cutoff = Date().addingTimeInterval(-ttl)
        messages.removeAll { $0.timestamp < cutoff }
    }
    
    private func saveToDisk() {
        if let data = try? JSONEncoder().encode(messages) {
            UserDefaults.standard.set(data, forKey: storageKey)
        }
    }
    
    private func loadFromDisk() {
        if let data = UserDefaults.standard.data(forKey: storageKey),
           let saved = try? JSONDecoder().decode([Message].self, from: data) {
            messages = saved
        }
    }
}
```

### T2 : Intégration avec CloudService (1h)

```swift
// Dans CloudService
func query(_ message: String, store: ConversationStore) async throws -> String {
    let context = store.messages.map { ["role": $0.role.rawValue, "content": $0.content] }
    
    // Ajouter le message utilisateur
    store.add(Message(id: UUID(), role: .user, content: message, timestamp: Date()))
    
    let response = try await internalQuery(message, context: context)
    
    // Ajouter la réponse
    store.add(Message(id: UUID(), role: .assistant, content: response, timestamp: Date()))
    
    return response
}
```

### T3 : Commande "oublie tout" (30min)

```swift
// Dans TriageService
if input.lowercased().contains("oublie tout") || input.lowercased().contains("forget everything") {
    conversationStore.clear()
    return TriageResult(
        tier: 1,
        intent: "clear_context",
        confidence: 1.0,
        response: "D'accord, j'ai oublié notre conversation.",
        parameters: [:]
    )
}
```

---

## Tests manuels

| # | Scénario | Résultat attendu |
|---|----------|------------------|
| 1 | "Mon nom est Georges" puis "Comment je m'appelle ?" | "Tu t'appelles Georges" |
| 2 | Fermer et rouvrir l'app | Contexte préservé |
| 3 | "Oublie tout" | Contexte effacé |
| 4 | Attendre 24h | Contexte auto-effacé |

---

## Dépendances

- **Prérequise** : US-012
- **Bloquante pour** : Aucune

---

*Story créée par Bob (SM BMAD) — 2026-03-04*
