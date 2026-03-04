# US-011 : Triage local (Qwen)

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **ID** | US-011 |
| **Épique** | E2 — Cloud Integration |
| **Sprint** | Sprint 2 |
| **Estimation** | 5 points |
| **Priorité** | 🔴 MUST |
| **Status** | Ready |

---

## Description

**En tant qu'** utilisateur
**Je veux** que les requêtes simples soient traitées localement
**Afin de** préserver ma vie privée et obtenir des réponses rapides

---

## Contexte technique

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Triage Pipeline                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Input              Qwen-0.5B           Decision                │
│  ┌──────────┐      ┌───────────┐      ┌────────────────┐       │
│  │"quelle   │─────►│ Classify  │─────►│ tier: 1 or 2   │       │
│  │ heure?"  │      │ + Intent  │      │ intent: "time" │       │
│  └──────────┘      └───────────┘      │ response: opt  │       │
│                                        └────────────────┘       │
│                                                                  │
│  Tier 1 (Local):                     Tier 2 (Cloud):            │
│  • Heure/date                        • Questions complexes     │
│  • Rappels/timers                    • Explications            │
│  • Calculs simples                   • Conversations           │
│  • Commandes système                 • Créativité              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Stack

- **Modèle** : Qwen2.5-0.5B quantifié (Q4_K_M)
- **Runtime** : llama.cpp via llama.swift
- **Taille** : ~300MB

---

## Critères d'acceptation

- [ ] **AC-001** : Classification tier 1 vs tier 2
- [ ] **AC-002** : Extraction intent (time, reminder, calculate, etc.)
- [ ] **AC-003** : Réponse directe si tier 1 + confidence > 0.8
- [ ] **AC-004** : Latence < 200ms
- [ ] **AC-005** : Fonctionne 100% offline

---

## Tâches de développement

### T1 : Intégration llama.swift (1h)

```swift
// Package.swift
dependencies: [
    .package(url: "https://github.com/ggerganov/llama.cpp", from: "b1234")
]
```

### T2 : TriageService (2h)

```swift
// TriageService.swift
struct TriageResult {
    let tier: Int              // 1 = local, 2 = cloud
    let intent: String         // "time", "reminder", "calculate", "query"
    let confidence: Float
    let response: String?      // Réponse si tier 1
    let parameters: [String: String] // Ex: reminder_time, calculation
}

class TriageService {
    private var model: LlamaModel?
    
    func loadModel() throws {
        guard let modelPath = Bundle.main.path(forResource: "qwen2.5-0.5b-q4", ofType: "gguf") else {
            throw TriageError.modelNotFound
        }
        model = try LlamaModel(path: modelPath)
    }
    
    func classify(input: String) async throws -> TriageResult {
        // 1. Règles statiques (instant, pas de LLM)
        if let staticResult = tryStaticRules(input) {
            return staticResult
        }
        
        // 2. LLM classification
        let prompt = buildClassificationPrompt(input)
        let output = try await model?.generate(prompt: prompt, maxTokens: 50)
        
        return parseTriageOutput(output ?? "")
    }
}
```

### T3 : Règles statiques (30min)

```swift
private func tryStaticRules(_ input: String) -> TriageResult? {
    let lowered = input.lowercased()
    
    // Heure
    if lowered.contains("quelle heure") || lowered.contains("what time") {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        let time = formatter.string(from: Date())
        return TriageResult(
            tier: 1,
            intent: "time",
            confidence: 1.0,
            response: "Il est \(time).",
            parameters: [:]
        )
    }
    
    // Date
    if lowered.contains("quel jour") || lowered.contains("quelle date") {
        let formatter = DateFormatter()
        formatter.dateStyle = .full
        formatter.locale = Locale(identifier: "fr_FR")
        let date = formatter.string(from: Date())
        return TriageResult(
            tier: 1,
            intent: "date",
            confidence: 1.0,
            response: "Nous sommes le \(date).",
            parameters: [:]
        )
    }
    
    // Rappel (extraire la durée)
    if let match = lowered.range(of: #"rappelle.?moi.+dans\s+(\d+)\s+(minute|heure|seconde)"#, options: .regularExpression) {
        // Parse et retourner avec intent "reminder"
        return TriageResult(
            tier: 1,
            intent: "reminder",
            confidence: 0.95,
            response: nil, // Action à exécuter
            parameters: ["duration": "..."]
        )
    }
    
    return nil // Pas de règle statique → LLM
}
```

### T4 : Prompt de classification (1h)

```swift
private func buildClassificationPrompt(_ input: String) -> String {
    """
    Tu es un assistant qui classifie les requêtes utilisateur.
    
    Catégories:
    - TIER_1: Questions simples (heure, date, rappels, timers, calculs)
    - TIER_2: Questions complexes (explications, conversations, créativité)
    
    Requête: "\(input)"
    
    Réponds au format JSON:
    {"tier": 1 ou 2, "intent": "...", "confidence": 0.0-1.0}
    """
}

private func parseTriageOutput(_ output: String) -> TriageResult {
    // Parser le JSON de sortie
    guard let data = output.data(using: .utf8),
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
        return TriageResult(tier: 2, intent: "unknown", confidence: 0.5, response: nil, parameters: [:])
    }
    
    return TriageResult(
        tier: json["tier"] as? Int ?? 2,
        intent: json["intent"] as? String ?? "unknown",
        confidence: Float(json["confidence"] as? Double ?? 0.5),
        response: nil,
        parameters: [:]
    )
}
```

### T5 : Intégration pipeline (1h)

```swift
// VoiceOrchestrator.swift
func processTranscription(_ text: String) async throws -> String {
    let triageResult = try await triageService.classify(input: text)
    
    if triageResult.tier == 1 && triageResult.confidence > 0.8 {
        // Exécution locale
        if let response = triageResult.response {
            return response
        } else {
            return try await executeLocalAction(triageResult)
        }
    } else {
        // Envoi au cloud
        return try await cloudService.query(text, context: conversationContext)
    }
}
```

---

## Tests requis

### Tests unitaires

```swift
func testStaticTimeRule() async throws {
    let service = TriageService()
    let result = try await service.classify(input: "Quelle heure est-il ?")
    
    XCTAssertEqual(result.tier, 1)
    XCTAssertEqual(result.intent, "time")
    XCTAssertEqual(result.confidence, 1.0)
    XCTAssertNotNil(result.response)
}

func testComplexQueryGoesToCloud() async throws {
    let service = TriageService()
    try service.loadModel()
    
    let result = try await service.classify(input: "Explique-moi la théorie de la relativité")
    
    XCTAssertEqual(result.tier, 2)
}

func testTriageLatency() async throws {
    let service = TriageService()
    try service.loadModel()
    
    let start = CFAbsoluteTimeGetCurrent()
    _ = try await service.classify(input: "Quelle heure ?")
    let elapsed = CFAbsoluteTimeGetCurrent() - start
    
    XCTAssertLessThan(elapsed, 0.2) // < 200ms
}
```

### Tests manuels

| # | Input | Tier attendu | Intent |
|---|-------|--------------|--------|
| 1 | "Quelle heure est-il ?" | 1 | time |
| 2 | "Rappelle-moi dans 10 minutes" | 1 | reminder |
| 3 | "2 + 2" | 1 | calculate |
| 4 | "Explique la relativité" | 2 | query |
| 5 | "Raconte une histoire" | 2 | creative |
| 6 | "Bonjour comment ça va ?" | 2 | conversation |

---

## Dépendances

- **Prérequise** : US-002 (Transcription)
- **Bloquante pour** : US-012 (Cloud API)

---

## Definition of Done

- [ ] Modèle qwen2.5-0.5b-q4.gguf inclus (~300MB)
- [ ] Règles statiques implémentées
- [ ] Classification LLM fonctionne
- [ ] Latence < 200ms validée
- [ ] Tests passent

---

*Story créée par Bob (SM BMAD) — 2026-03-04*
