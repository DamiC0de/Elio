# US-002 : Transcription locale (Whisper)

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **ID** | US-002 |
| **Épique** | E1 — Core Voice |
| **Sprint** | Sprint 1 |
| **Estimation** | 5 points |
| **Priorité** | 🔴 MUST |
| **Assigné** | - |
| **Status** | Ready |

---

## Description

**En tant qu'** utilisateur
**Je veux** que ma voix soit transcrite en texte sur mon appareil
**Afin de** préserver ma vie privée et avoir une réponse rapide

---

## Contexte technique

### Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                     STT Pipeline                                │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  AudioService     WhisperService      TranscriptionResult      │
│  ┌──────────┐     ┌──────────────┐    ┌───────────────────┐   │
│  │ PCM 16kHz│────►│ whisper.cpp  │───►│ text: String      │   │
│  │ buffers  │     │ (Core ML)    │    │ confidence: Float │   │
│  └──────────┘     └──────────────┘    │ language: String  │   │
│                                        └───────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

### Stack

- **Whisper.cpp** : Implémentation C++ optimisée
- **Modèle** : `whisper-tiny` (~40MB) ou `whisper-base` (~75MB)
- **Format** : Core ML (.mlmodelc) pour accélération ANE
- **Binding Swift** : Via C bridge ou SPM package

### Ressources

- [whisper.cpp](https://github.com/ggerganov/whisper.cpp)
- [WhisperKit (Apple)](https://github.com/argmaxinc/WhisperKit) — alternative native
- Modèles Core ML : https://huggingface.co/ggerganov/whisper.cpp

### Fichiers à créer/modifier

```
app/
├── services/
│   └── WhisperService.swift      # Service STT
├── models/
│   └── whisper-tiny.mlmodelc/    # Modèle Core ML
├── bridges/
│   └── WhisperBridge.swift       # Bridge C si whisper.cpp
└── Package.swift                 # Dépendance WhisperKit
```

---

## Critères d'acceptation

### Fonctionnels

- [ ] **AC-001** : L'audio enregistré est transcrit en texte
- [ ] **AC-002** : La transcription fonctionne en français
- [ ] **AC-003** : La transcription fonctionne en anglais
- [ ] **AC-004** : Le texte s'affiche progressivement (streaming)
- [ ] **AC-005** : La langue est détectée automatiquement

### Non-fonctionnels

- [ ] **AC-006** : Latence < 500ms pour 5 secondes d'audio
- [ ] **AC-007** : Précision > 90% sur phrases simples
- [ ] **AC-008** : Fonctionne 100% offline
- [ ] **AC-009** : RAM utilisée < 200MB pendant transcription

### Erreurs

- [ ] **AC-010** : Message si modèle non chargé
- [ ] **AC-011** : Gestion audio vide/silencieux

---

## Tâches de développement

### T1 : Intégration WhisperKit (2h)

```swift
// Package.swift
dependencies: [
    .package(url: "https://github.com/argmaxinc/WhisperKit", from: "0.5.0")
]
```

```swift
// WhisperService.swift
import WhisperKit

class WhisperService: ObservableObject {
    private var whisperKit: WhisperKit?
    @Published var isLoaded = false
    
    func loadModel() async throws {
        whisperKit = try await WhisperKit(model: "tiny")
        isLoaded = true
    }
}
```

### T2 : Transcription basique (2h)

```swift
struct TranscriptionResult {
    let text: String
    let confidence: Float
    let language: String
    let segments: [TranscriptionSegment]
}

struct TranscriptionSegment {
    let text: String
    let start: Double
    let end: Double
}

func transcribe(audioBuffer: AVAudioPCMBuffer) async throws -> TranscriptionResult {
    guard let whisper = whisperKit else {
        throw WhisperError.modelNotLoaded
    }
    
    let result = try await whisper.transcribe(audioBuffer: audioBuffer)
    
    return TranscriptionResult(
        text: result.text,
        confidence: result.confidence ?? 0.0,
        language: result.language ?? "unknown",
        segments: result.segments.map { ... }
    )
}
```

### T3 : Streaming (transcription progressive) (2h)

```swift
func transcribeStreaming(
    audioBuffer: AVAudioPCMBuffer,
    onPartialResult: @escaping (String) -> Void
) async throws -> TranscriptionResult {
    // Utiliser le mode streaming de WhisperKit
    let result = try await whisperKit?.transcribe(
        audioBuffer: audioBuffer,
        decodeOptions: DecodingOptions(
            task: .transcribe,
            language: nil, // auto-detect
            suppressBlank: true,
            withoutTimestamps: false
        ),
        callback: { progress in
            if let partial = progress.text {
                onPartialResult(partial)
            }
            return true // continue
        }
    )
    
    return TranscriptionResult(...)
}
```

### T4 : Optimisation mémoire (1h)

```swift
// Décharger le modèle quand pas utilisé depuis 60s
private var unloadTimer: Timer?

func scheduleUnload() {
    unloadTimer?.invalidate()
    unloadTimer = Timer.scheduledTimer(withTimeInterval: 60, repeats: false) { [weak self] _ in
        self?.unloadModel()
    }
}

func unloadModel() {
    whisperKit = nil
    isLoaded = false
}
```

### T5 : Gestion erreurs (1h)

```swift
enum WhisperError: Error, LocalizedError {
    case modelNotLoaded
    case transcriptionFailed(Error)
    case audioTooShort
    case silentAudio
    
    var errorDescription: String? {
        switch self {
        case .modelNotLoaded:
            return "Le modèle de reconnaissance vocale n'est pas chargé."
        case .transcriptionFailed(let error):
            return "Erreur de transcription: \(error.localizedDescription)"
        case .audioTooShort:
            return "L'enregistrement est trop court."
        case .silentAudio:
            return "Je n'ai rien entendu. Parle plus fort."
        }
    }
}
```

---

## Tests requis

### Tests unitaires

```swift
// WhisperServiceTests.swift
func testModelLoading() async throws {
    let service = WhisperService()
    try await service.loadModel()
    XCTAssertTrue(service.isLoaded)
}

func testTranscriptionFrench() async throws {
    let service = WhisperService()
    try await service.loadModel()
    
    let audioBuffer = loadTestAudio("bonjour_diva.wav")
    let result = try await service.transcribe(audioBuffer: audioBuffer)
    
    XCTAssertTrue(result.text.lowercased().contains("bonjour"))
    XCTAssertEqual(result.language, "fr")
}

func testTranscriptionEnglish() async throws {
    // Similar avec "hello diva"
}

func testSilentAudioHandling() async throws {
    let silentBuffer = generateSilentBuffer(duration: 2.0)
    let service = WhisperService()
    try await service.loadModel()
    
    do {
        _ = try await service.transcribe(audioBuffer: silentBuffer)
        XCTFail("Should throw silentAudio error")
    } catch WhisperError.silentAudio {
        // Expected
    }
}
```

### Tests manuels

| # | Scénario | Résultat attendu |
|---|----------|------------------|
| 1 | Dire "Bonjour Diva" | Texte "Bonjour Diva" affiché |
| 2 | Dire "What time is it" | Texte anglais correct, langue = "en" |
| 3 | Parler pendant 10s | Transcription progressive visible |
| 4 | Ne rien dire | Message "Je n'ai rien entendu" |
| 5 | Bruit de fond sans parole | Pas de transcription parasite |

### Benchmark performance

| Durée audio | Latence max | RAM max |
|-------------|-------------|---------|
| 2s | 200ms | 150MB |
| 5s | 500ms | 180MB |
| 10s | 900ms | 200MB |

---

## Dépendances

### Prérequises

- US-001 (Capture audio micro)

### Bloquantes pour

- US-011 (Triage local)
- US-016 (Lecture notifications — pour comprendre "lis mes messages")

---

## Definition of Done

- [ ] Code implémenté et compilant
- [ ] Modèle whisper-tiny inclus dans le bundle (~40MB)
- [ ] Tests unitaires passent
- [ ] Benchmark latence validé (< 500ms pour 5s)
- [ ] Tests manuels FR/EN validés
- [ ] Code review approuvée
- [ ] PR mergée dans `main`

---

## Notes

- **WhisperKit** est recommandé car optimisé pour Apple Silicon et Core ML
- Si taille app critique, utiliser `tiny` (~40MB) sinon `base` (~75MB) plus précis
- Le modèle doit être chargé au démarrage app (cold start ~2s)
- Prévoir cache du modèle en mémoire entre les requêtes

---

*Story créée par Bob (SM BMAD) — 2026-03-04*
