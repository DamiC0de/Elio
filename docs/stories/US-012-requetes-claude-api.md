# US-012 : Requêtes Claude API

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **ID** | US-012 |
| **Épique** | E2 — Cloud Integration |
| **Sprint** | Sprint 2 |
| **Estimation** | 5 points |
| **Priorité** | 🔴 MUST |
| **Status** | Ready |

---

## Description

**En tant qu'** utilisateur
**Je veux** que mes questions complexes soient envoyées à Claude
**Afin d'** obtenir des réponses intelligentes et détaillées

---

## Contexte technique

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cloud Pipeline                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  Client  │───►│   Diva   │───►│ Anthropic│───►│  Claude  │  │
│  │  (iOS)   │    │  Server  │    │    API   │    │  Haiku   │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       │                                               │         │
│       │◄──────────────────────────────────────────────┘         │
│                        Streaming response                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Stack

- **API** : POST /chat + WebSocket /chat/stream
- **Auth** : JWT Bearer token
- **Model** : claude-haiku-4-5-20251001
- **Retry** : Exponential backoff (3 tentatives)

---

## Critères d'acceptation

- [ ] **AC-001** : Appel API /chat avec JWT
- [ ] **AC-002** : Streaming de la réponse
- [ ] **AC-003** : Contexte conversationnel envoyé
- [ ] **AC-004** : Timeout 30s
- [ ] **AC-005** : Retry avec backoff (529/503/502)
- [ ] **AC-006** : Gestion erreurs (quota, auth, réseau)

---

## Tâches de développement

### T1 : CloudService (2h)

```swift
// CloudService.swift
class CloudService {
    private let baseURL = "https://api.diva.ai"
    private let keychain = KeychainManager()
    
    func query(_ message: String, context: [Message]) async throws -> String {
        guard let token = keychain.getAccessToken() else {
            throw CloudError.notAuthenticated
        }
        
        var request = URLRequest(url: URL(string: "\(baseURL)/chat")!)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 30
        
        let body = ChatRequest(
            message: message,
            context: ChatContext(
                recentMessages: context.suffix(10).map { $0.content },
                time: ISO8601DateFormatter().string(from: Date())
            )
        )
        request.httpBody = try JSONEncoder().encode(body)
        
        return try await executeWithRetry(request)
    }
}
```

### T2 : Retry avec backoff (1h)

```swift
private func executeWithRetry(_ request: URLRequest, attempt: Int = 0) async throws -> String {
    let maxRetries = 3
    let retryableStatuses = [502, 503, 529]
    
    do {
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw CloudError.invalidResponse
        }
        
        if retryableStatuses.contains(httpResponse.statusCode) && attempt < maxRetries {
            let delay = pow(2.0, Double(attempt)) // 1s, 2s, 4s
            try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            return try await executeWithRetry(request, attempt: attempt + 1)
        }
        
        switch httpResponse.statusCode {
        case 200:
            let result = try JSONDecoder().decode(ChatResponse.self, from: data)
            return result.text
        case 401:
            throw CloudError.unauthorized
        case 429:
            throw CloudError.rateLimited
        default:
            throw CloudError.serverError(httpResponse.statusCode)
        }
    } catch let error as URLError where error.code == .timedOut {
        if attempt < maxRetries {
            return try await executeWithRetry(request, attempt: attempt + 1)
        }
        throw CloudError.timeout
    }
}
```

### T3 : Streaming (WebSocket) (2h)

```swift
func queryStream(
    _ message: String,
    context: [Message],
    onChunk: @escaping (String) -> Void
) async throws {
    guard let token = keychain.getAccessToken() else {
        throw CloudError.notAuthenticated
    }
    
    var urlComponents = URLComponents(string: "\(baseURL)/chat/stream")!
    urlComponents.scheme = "wss"
    
    var request = URLRequest(url: urlComponents.url!)
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    
    let session = URLSession(configuration: .default)
    let webSocket = session.webSocketTask(with: request)
    webSocket.resume()
    
    // Send query
    let query = ChatRequest(message: message, context: ...)
    let data = try JSONEncoder().encode(query)
    try await webSocket.send(.data(data))
    
    // Receive stream
    while true {
        let message = try await webSocket.receive()
        switch message {
        case .string(let text):
            if text == "[DONE]" {
                webSocket.cancel(with: .normalClosure, reason: nil)
                return
            }
            onChunk(text)
        case .data:
            break
        @unknown default:
            break
        }
    }
}
```

---

## Tests manuels

| # | Scénario | Résultat attendu |
|---|-------|------------------|
| 1 | Question simple | Réponse < 5s |
| 2 | Question longue | Streaming visible |
| 3 | Mode avion | Erreur réseau claire |
| 4 | Token expiré | Auto-refresh + retry |
| 5 | Serveur surchargé (529) | Retry automatique |

---

## Dépendances

- **Prérequises** : US-010, US-011
- **Bloquante pour** : US-013

---

*Story créée par Bob (SM BMAD) — 2026-03-04*
