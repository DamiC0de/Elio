# US-003 : Synthèse vocale locale (Piper TTS)

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **ID** | US-003 |
| **Épique** | E1 — Core Voice |
| **Sprint** | Sprint 1 |
| **Estimation** | 5 points |
| **Priorité** | 🔴 MUST |
| **Assigné** | - |
| **Status** | Ready |

---

## Description

**En tant qu'** utilisateur
**Je veux** que Diva me réponde par la voix
**Afin d'** avoir une interaction naturelle et mains-libres

---

## Contexte technique

### Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                     TTS Pipeline                                │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Response Text      PiperService       AVAudioPlayer           │
│  ┌──────────┐      ┌─────────────┐    ┌───────────────┐       │
│  │ "Bonjour │─────►│ Piper ONNX  │───►│ Play audio    │       │
│  │  Georges"│      │ (fr voice)  │    │ to speaker    │       │
│  └──────────┘      └─────────────┘    └───────────────┘       │
│                                                                 │
│  Modèle: fr_FR-siwis-medium (~20MB)                           │
└────────────────────────────────────────────────────────────────┘
```

### Stack

- **Piper** : TTS neural basé sur VITS
- **Runtime** : ONNX Runtime pour iOS
- **Voix** : `fr_FR-siwis-medium` (naturelle, ~20MB)
- **Format sortie** : PCM 22050Hz mono

### Ressources

- [Piper TTS](https://github.com/rhasspy/piper)
- [piper-phonemize](https://github.com/rhasspy/piper-phonemize)
- Voix disponibles : https://huggingface.co/rhasspy/piper-voices

### Fichiers à créer/modifier

```
app/
├── services/
│   └── TTSService.swift          # Service TTS
├── models/
│   ├── fr_FR-siwis-medium.onnx   # Modèle voix
│   └── fr_FR-siwis-medium.json   # Config voix
├── bridges/
│   └── PiperBridge.swift         # Bridge ONNX Runtime
└── Podfile / Package.swift       # onnxruntime-objc
```

---

## Critères d'acceptation

### Fonctionnels

- [ ] **AC-001** : Diva peut prononcer n'importe quel texte français
- [ ] **AC-002** : La voix est naturelle et compréhensible
- [ ] **AC-003** : Le volume s'adapte (speaker vs écouteurs)
- [ ] **AC-004** : La synthèse peut être interrompue
- [ ] **AC-005** : Support des chiffres et abréviations courantes

### Non-fonctionnels

- [ ] **AC-006** : Latence < 300ms pour commencer à parler
- [ ] **AC-007** : Fonctionne 100% offline
- [ ] **AC-008** : RAM utilisée < 100MB pendant synthèse

### Erreurs

- [ ] **AC-009** : Fallback silencieux si modèle non chargé
- [ ] **AC-010** : Gestion interruption audio (appel entrant)

---

## Tâches de développement

### T1 : Intégration ONNX Runtime (1h)

```ruby
# Podfile
pod 'onnxruntime-objc', '~> 1.16.0'
```

```swift
// TTSService.swift
import onnxruntime_objc

class TTSService: ObservableObject {
    private var ortSession: ORTSession?
    private var ortEnv: ORTEnv?
    @Published var isLoaded = false
}
```

### T2 : Chargement modèle Piper (1h)

```swift
func loadModel() throws {
    ortEnv = try ORTEnv(loggingLevel: .warning)
    
    guard let modelPath = Bundle.main.path(forResource: "fr_FR-siwis-medium", ofType: "onnx") else {
        throw TTSError.modelNotFound
    }
    
    let sessionOptions = try ORTSessionOptions()
    try sessionOptions.setGraphOptimizationLevel(.all)
    
    ortSession = try ORTSession(env: ortEnv!, modelPath: modelPath, sessionOptions: sessionOptions)
    isLoaded = true
}
```

### T3 : Phonémisation (2h)

```swift
// Piper utilise espeak-ng pour la phonémisation
// Option 1: Embarquer espeak-ng (complexe)
// Option 2: Utiliser une table de phonèmes pré-calculée
// Option 3: Utiliser piper-phonemize compilé pour iOS

struct Phonemizer {
    // Règles basiques français
    func phonemize(_ text: String) -> [Int64] {
        // Tokenization simplifiée
        // En prod: utiliser piper-phonemize
        return text.lowercased()
            .map { charToPhonemeId[$0] ?? 0 }
    }
}
```

### T4 : Synthèse audio (2h)

```swift
func synthesize(text: String) async throws -> Data {
    guard let session = ortSession else {
        throw TTSError.modelNotLoaded
    }
    
    // 1. Phonémiser le texte
    let phonemeIds = phonemizer.phonemize(text)
    
    // 2. Préparer les tenseurs d'entrée
    let inputTensor = try ORTValue(tensorData: NSMutableData(data: phonemeIds.withUnsafeBytes { Data($0) }),
                                    elementType: .int64,
                                    shape: [1, phonemeIds.count])
    
    // 3. Inférence
    let outputs = try session.run(withInputs: ["input": inputTensor],
                                   outputNames: ["output"],
                                   runOptions: nil)
    
    // 4. Convertir en audio PCM
    let audioData = outputs["output"]!.tensorData()
    return convertToWav(pcmData: audioData, sampleRate: 22050)
}
```

### T5 : Lecture audio (1h)

```swift
import AVFoundation

class AudioPlayer: ObservableObject {
    private var audioPlayer: AVAudioPlayer?
    @Published var isPlaying = false
    
    func play(audioData: Data) throws {
        audioPlayer = try AVAudioPlayer(data: audioData)
        audioPlayer?.delegate = self
        audioPlayer?.play()
        isPlaying = true
    }
    
    func stop() {
        audioPlayer?.stop()
        isPlaying = false
    }
}

extension AudioPlayer: AVAudioPlayerDelegate {
    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        isPlaying = false
    }
}
```

### T6 : Gestion interruptions (1h)

```swift
func setupAudioSession() {
    NotificationCenter.default.addObserver(
        self,
        selector: #selector(handleInterruption),
        name: AVAudioSession.interruptionNotification,
        object: nil
    )
}

@objc func handleInterruption(notification: Notification) {
    guard let info = notification.userInfo,
          let typeValue = info[AVAudioSessionInterruptionTypeKey] as? UInt,
          let type = AVAudioSession.InterruptionType(rawValue: typeValue) else { return }
    
    switch type {
    case .began:
        stop() // Pause TTS
    case .ended:
        // Optionnel: reprendre
        break
    @unknown default:
        break
    }
}
```

---

## Tests requis

### Tests unitaires

```swift
// TTSServiceTests.swift
func testModelLoading() throws {
    let service = TTSService()
    XCTAssertNoThrow(try service.loadModel())
    XCTAssertTrue(service.isLoaded)
}

func testSynthesisProducesAudio() async throws {
    let service = TTSService()
    try service.loadModel()
    
    let audioData = try await service.synthesize(text: "Bonjour")
    
    XCTAssertGreaterThan(audioData.count, 1000) // Non vide
}

func testSynthesisLatency() async throws {
    let service = TTSService()
    try service.loadModel()
    
    let start = CFAbsoluteTimeGetCurrent()
    _ = try await service.synthesize(text: "Bonjour Georges")
    let elapsed = CFAbsoluteTimeGetCurrent() - start
    
    XCTAssertLessThan(elapsed, 0.3) // < 300ms
}
```

### Tests manuels

| # | Scénario | Résultat attendu |
|---|----------|------------------|
| 1 | Synthèse "Bonjour" | Voix claire et naturelle |
| 2 | Synthèse "Il est 14h30" | Chiffres correctement prononcés |
| 3 | Synthèse phrase longue (50 mots) | Pas de coupure, intonation correcte |
| 4 | Interruption pendant synthèse | Arrêt immédiat |
| 5 | Appel entrant pendant synthèse | TTS pause |
| 6 | Avec écouteurs | Volume adapté |

---

## Dépendances

### Prérequises

- Aucune (peut être développé en parallèle de US-001/002)

### Bloquantes pour

- US-016 (Lecture notifications — pour vocaliser les messages)
- Toutes les stories nécessitant une réponse vocale

---

## Definition of Done

- [ ] Code implémenté et compilant
- [ ] Modèle `fr_FR-siwis-medium.onnx` inclus (~20MB)
- [ ] Tests unitaires passent
- [ ] Latence < 300ms validée
- [ ] Tests manuels validés (voix naturelle)
- [ ] Code review approuvée
- [ ] PR mergée dans `main`

---

## Notes

### Alternative : Voix système iOS

Si Piper trop complexe à intégrer, fallback possible sur `AVSpeechSynthesizer` :

```swift
import AVFoundation

let synthesizer = AVSpeechSynthesizer()
let utterance = AVSpeechUtterance(string: "Bonjour")
utterance.voice = AVSpeechSynthesisVoice(language: "fr-FR")
synthesizer.speak(utterance)
```

**Inconvénients** : Voix moins naturelle, dépendance Apple

### Voix recommandées Piper

| Voix | Taille | Qualité | Recommandé |
|------|--------|---------|------------|
| fr_FR-siwis-low | ~15MB | Moyenne | Non |
| fr_FR-siwis-medium | ~20MB | Bonne | ✅ Oui |
| fr_FR-upmc-medium | ~25MB | Très bonne | Si espace ok |

---

*Story créée par Bob (SM BMAD) — 2026-03-04*
