# US-004 : Détection fin de parole (VAD)

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **ID** | US-004 |
| **Épique** | E1 — Core Voice |
| **Sprint** | Sprint 1 |
| **Estimation** | 3 points |
| **Priorité** | 🔴 MUST |
| **Assigné** | - |
| **Status** | Ready |

---

## Description

**En tant qu'** utilisateur
**Je veux** que Diva détecte automatiquement quand j'ai fini de parler
**Afin de** ne pas devoir appuyer sur un bouton pour valider

---

## Contexte technique

### Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                     VAD Pipeline                                │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  AudioService       VADService         Decision                │
│  ┌──────────┐      ┌───────────┐      ┌───────────────┐       │
│  │ PCM 16kHz│─────►│Silero VAD │─────►│ speech_end?   │       │
│  │ 30ms buf │      │ (ONNX)    │      │ confidence    │       │
│  └──────────┘      └───────────┘      └───────────────┘       │
│                                                                 │
│  Silero VAD: ~2MB, très rapide, précis                        │
└────────────────────────────────────────────────────────────────┘
```

### Stack

- **Silero VAD** : Modèle ONNX léger (~2MB)
- **Runtime** : ONNX Runtime (partagé avec Piper)
- **Logique** : Silence > 800ms après parole = fin

### Ressources

- [Silero VAD](https://github.com/snakers4/silero-vad)
- Modèle ONNX : `silero_vad.onnx`

### Fichiers à créer/modifier

```
app/
├── services/
│   └── VADService.swift          # Service VAD
├── models/
│   └── silero_vad.onnx           # Modèle (~2MB)
└── utils/
    └── VADConfig.swift           # Configuration seuils
```

---

## Critères d'acceptation

### Fonctionnels

- [ ] **AC-001** : La fin de parole est détectée après ~800ms de silence
- [ ] **AC-002** : Les pauses naturelles (< 500ms) ne déclenchent pas la fin
- [ ] **AC-003** : Le seuil de détection est configurable
- [ ] **AC-004** : Un callback est appelé quand la parole se termine

### Non-fonctionnels

- [ ] **AC-005** : Latence de détection < 100ms
- [ ] **AC-006** : CPU < 3% en continu
- [ ] **AC-007** : Fonctionne avec bruit de fond modéré

### Erreurs

- [ ] **AC-008** : Fallback sur timeout si VAD échoue

---

## Tâches de développement

### T1 : Intégration Silero VAD (1h)

```swift
// VADService.swift
import onnxruntime_objc

class VADService {
    private var ortSession: ORTSession?
    private var state: [Float] = Array(repeating: 0, count: 128) // Hidden state
    
    private let sampleRate: Int = 16000
    private let windowSize: Int = 512 // 32ms à 16kHz
    
    func loadModel() throws {
        guard let modelPath = Bundle.main.path(forResource: "silero_vad", ofType: "onnx") else {
            throw VADError.modelNotFound
        }
        
        let env = try ORTEnv(loggingLevel: .warning)
        ortSession = try ORTSession(env: env, modelPath: modelPath, sessionOptions: nil)
    }
}
```

### T2 : Analyse frame par frame (2h)

```swift
struct VADResult {
    let isSpeech: Bool
    let confidence: Float
}

func analyze(audioFrame: [Float]) throws -> VADResult {
    guard let session = ortSession else {
        throw VADError.modelNotLoaded
    }
    
    // Input: audio frame + state
    let inputTensor = try ORTValue(tensorData: NSMutableData(data: audioFrame.withUnsafeBytes { Data($0) }),
                                    elementType: .float,
                                    shape: [1, audioFrame.count])
    
    let stateTensor = try ORTValue(tensorData: NSMutableData(data: state.withUnsafeBytes { Data($0) }),
                                    elementType: .float,
                                    shape: [2, 1, 64])
    
    // Inference
    let outputs = try session.run(
        withInputs: ["input": inputTensor, "state": stateTensor],
        outputNames: ["output", "stateN"],
        runOptions: nil
    )
    
    // Update state pour frame suivant
    let newState = outputs["stateN"]!.tensorData()
    state = newState.withUnsafeBytes { Array($0.bindMemory(to: Float.self)) }
    
    // Probability of speech
    let outputData = outputs["output"]!.tensorData()
    let probability = outputData.withUnsafeBytes { $0.load(as: Float.self) }
    
    return VADResult(isSpeech: probability > 0.5, confidence: probability)
}
```

### T3 : Logique de détection fin de parole (1.5h)

```swift
class SpeechEndDetector {
    private var silenceStartTime: Date?
    private var wasSpeaking = false
    
    let silenceThreshold: TimeInterval = 0.8 // 800ms
    let pauseThreshold: TimeInterval = 0.5   // 500ms ignoré
    
    func process(vadResult: VADResult) -> SpeechEndEvent? {
        if vadResult.isSpeech {
            wasSpeaking = true
            silenceStartTime = nil
            return nil
        }
        
        // Silence détecté
        if wasSpeaking {
            if silenceStartTime == nil {
                silenceStartTime = Date()
            }
            
            let silenceDuration = Date().timeIntervalSince(silenceStartTime!)
            
            if silenceDuration >= silenceThreshold {
                wasSpeaking = false
                silenceStartTime = nil
                return .speechEnded
            }
        }
        
        return nil
    }
    
    func reset() {
        wasSpeaking = false
        silenceStartTime = nil
    }
}

enum SpeechEndEvent {
    case speechEnded
}
```

### T4 : Intégration avec AudioService (1h)

```swift
// Dans AudioService
func startRecordingWithVAD(
    onSpeechEnd: @escaping () -> Void,
    onBuffer: @escaping (AVAudioPCMBuffer) -> Void
) throws {
    let vadService = VADService()
    try vadService.loadModel()
    
    let detector = SpeechEndDetector()
    
    startRecording { buffer in
        onBuffer(buffer)
        
        // Analyser chaque frame
        let floatArray = buffer.toFloatArray()
        if let vadResult = try? vadService.analyze(audioFrame: floatArray) {
            if let event = detector.process(vadResult: vadResult) {
                switch event {
                case .speechEnded:
                    onSpeechEnd()
                }
            }
        }
    }
}
```

### T5 : Configuration utilisateur (30min)

```swift
// VADConfig.swift
struct VADConfig {
    var silenceThreshold: TimeInterval = 0.8
    var speechThreshold: Float = 0.5
    var enabled: Bool = true
    
    static var `default` = VADConfig()
}

// Settings
@AppStorage("vad_silence_threshold") var silenceThreshold: Double = 0.8
```

---

## Tests requis

### Tests unitaires

```swift
// VADServiceTests.swift
func testModelLoading() throws {
    let service = VADService()
    XCTAssertNoThrow(try service.loadModel())
}

func testSpeechDetection() throws {
    let service = VADService()
    try service.loadModel()
    
    let speechFrame = loadTestAudio("speech_frame.raw")
    let result = try service.analyze(audioFrame: speechFrame)
    
    XCTAssertTrue(result.isSpeech)
    XCTAssertGreaterThan(result.confidence, 0.7)
}

func testSilenceDetection() throws {
    let service = VADService()
    try service.loadModel()
    
    let silentFrame = Array(repeating: Float(0), count: 512)
    let result = try service.analyze(audioFrame: silentFrame)
    
    XCTAssertFalse(result.isSpeech)
}

func testSpeechEndDetection() {
    let detector = SpeechEndDetector()
    
    // Simulate speaking
    for _ in 0..<10 {
        _ = detector.process(vadResult: VADResult(isSpeech: true, confidence: 0.9))
    }
    
    // Simulate silence
    detector.silenceThreshold = 0.1 // Accélérer pour test
    for _ in 0..<5 {
        let event = detector.process(vadResult: VADResult(isSpeech: false, confidence: 0.1))
        // Devrait détecter speechEnded après ~100ms
    }
}
```

### Tests manuels

| # | Scénario | Résultat attendu |
|---|----------|------------------|
| 1 | Dire une phrase, se taire | Détection après ~800ms |
| 2 | Faire une pause de 300ms | Pas de détection |
| 3 | Parler avec bruit de fond | Détection correcte |
| 4 | Chuchoter | Détection correcte |
| 5 | Configurer seuil à 1.5s | Détection après 1.5s |

---

## Dépendances

### Prérequises

- US-001 (Capture audio micro)

### Bloquantes pour

- US-005 (Mode mains-libres)

---

## Definition of Done

- [ ] Code implémenté et compilant
- [ ] Modèle `silero_vad.onnx` inclus (~2MB)
- [ ] Tests unitaires passent
- [ ] Détection < 100ms après fin de parole
- [ ] Tests manuels validés
- [ ] Code review approuvée
- [ ] PR mergée dans `main`

---

## Notes

- Silero VAD est stateful : garder le state entre les frames
- Le modèle attend des frames de 512 samples (32ms à 16kHz)
- Éviter de charger/décharger le modèle entre les phrases
- Le seuil de 0.5 pour isSpeech est un bon défaut

---

*Story créée par Bob (SM BMAD) — 2026-03-04*
