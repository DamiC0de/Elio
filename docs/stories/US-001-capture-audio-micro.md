# US-001 : Capture audio micro

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **ID** | US-001 |
| **Épique** | E1 — Core Voice |
| **Sprint** | Sprint 1 |
| **Estimation** | 3 points |
| **Priorité** | 🔴 MUST |
| **Assigné** | - |
| **Status** | Ready |

---

## Description

**En tant qu'** utilisateur
**Je veux** pouvoir parler à Diva via le micro de mon iPhone
**Afin de** interagir avec l'assistant par la voix

---

## Contexte technique

### Architecture (extrait)

```
┌─────────────────────────────────────────────────────────────────┐
│                        DIVA iOS App                              │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │                    Service Layer                             ││
│  │  ┌────────────┐                                              ││
│  │  │AudioService│ ◄── Cette story                             ││
│  │  │ (Record)   │                                              ││
│  │  └─────┬──────┘                                              ││
│  │        │                                                      ││
│  │        ▼                                                      ││
│  │  ┌─────────────┐                                             ││
│  │  │ STTService  │ ◄── US-002                                  ││
│  │  └─────────────┘                                             ││
│  └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Stack

- **Framework** : AVFoundation (AVAudioEngine)
- **Format audio** : PCM 16-bit, 16kHz, mono
- **Buffer** : 480 samples (30ms) pour VAD
- **Permissions** : `NSMicrophoneUsageDescription` dans Info.plist

### Fichiers à créer/modifier

```
app/
├── services/
│   └── AudioService.swift        # Service principal
├── utils/
│   └── AudioFormat.swift         # Constantes format
└── Info.plist                    # Permission micro
```

---

## Critères d'acceptation

### Fonctionnels

- [ ] **AC-001** : L'app demande la permission micro au premier appui sur le bouton d'enregistrement
- [ ] **AC-002** : L'utilisateur peut démarrer l'enregistrement en appuyant sur l'orbe
- [ ] **AC-003** : L'utilisateur peut arrêter l'enregistrement en relâchant l'orbe (ou second tap)
- [ ] **AC-004** : Un indicateur visuel (orbe bleu) montre que l'enregistrement est actif
- [ ] **AC-005** : L'enregistrement s'arrête automatiquement après 30 secondes
- [ ] **AC-006** : L'audio capturé est au format 16kHz mono PCM (compatible Whisper)

### Non-fonctionnels

- [ ] **AC-007** : Latence de démarrage < 100ms après tap
- [ ] **AC-008** : Consommation CPU < 5% pendant l'enregistrement
- [ ] **AC-009** : Fonctionne en arrière-plan si permission accordée

### Erreurs

- [ ] **AC-010** : Message clair si permission micro refusée
- [ ] **AC-011** : Message clair si micro utilisé par autre app
- [ ] **AC-012** : Retry possible après erreur

---

## Tâches de développement

### T1 : Configuration AVAudioSession (1h)

```swift
// AudioService.swift
import AVFoundation

class AudioService: ObservableObject {
    private let audioEngine = AVAudioEngine()
    private let audioSession = AVAudioSession.sharedInstance()
    
    func setupAudioSession() throws {
        try audioSession.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetooth])
        try audioSession.setActive(true)
    }
}
```

### T2 : Demande de permission (30min)

```swift
func requestPermission() async -> Bool {
    return await AVAudioApplication.requestRecordPermission()
}
```

### T3 : Capture audio avec AVAudioEngine (2h)

```swift
func startRecording(onBuffer: @escaping (AVAudioPCMBuffer) -> Void) throws {
    let inputNode = audioEngine.inputNode
    let format = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 16000, channels: 1, interleaved: true)!
    
    inputNode.installTap(onBus: 0, bufferSize: 480, format: format) { buffer, time in
        onBuffer(buffer)
    }
    
    audioEngine.prepare()
    try audioEngine.start()
}

func stopRecording() {
    audioEngine.inputNode.removeTap(onBus: 0)
    audioEngine.stop()
}
```

### T4 : Timeout automatique (30min)

```swift
private var recordingTimer: Timer?

func startRecording(...) {
    // ...
    recordingTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: false) { [weak self] _ in
        self?.stopRecording()
    }
}
```

### T5 : Gestion des erreurs (1h)

```swift
enum AudioError: Error, LocalizedError {
    case permissionDenied
    case microphoneInUse
    case setupFailed(Error)
    
    var errorDescription: String? {
        switch self {
        case .permissionDenied:
            return "Diva a besoin d'accéder au micro. Va dans Réglages > Diva > Microphone."
        case .microphoneInUse:
            return "Le micro est utilisé par une autre app."
        case .setupFailed(let error):
            return "Erreur audio: \(error.localizedDescription)"
        }
    }
}
```

### T6 : Info.plist (15min)

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Diva utilise le micro pour écouter tes commandes vocales. L'audio est traité localement et n'est jamais envoyé à des serveurs.</string>
```

---

## Tests requis

### Tests unitaires

```swift
// AudioServiceTests.swift
func testAudioSessionConfiguration() {
    let service = AudioService()
    XCTAssertNoThrow(try service.setupAudioSession())
}

func testRecordingStartsAndStops() async {
    let service = AudioService()
    // Mock permission granted
    try! service.startRecording { _ in }
    XCTAssertTrue(service.isRecording)
    service.stopRecording()
    XCTAssertFalse(service.isRecording)
}

func testTimeoutAfter30Seconds() async {
    // Accélérer le timer pour le test
}
```

### Tests manuels

| # | Scénario | Résultat attendu |
|---|----------|------------------|
| 1 | Premier lancement, tap sur orbe | Popup permission micro iOS |
| 2 | Permission accordée, tap sur orbe | Orbe devient bleu, enregistrement démarre |
| 3 | Relâcher l'orbe | Enregistrement s'arrête |
| 4 | Attendre 30s pendant enregistrement | Arrêt automatique |
| 5 | Refuser permission, tap sur orbe | Message d'erreur clair |

---

## Dépendances

### Prérequises

- Aucune (première story)

### Bloquantes pour

- US-002 (Transcription Whisper)
- US-004 (VAD)
- US-005 (Mode mains-libres)

---

## Definition of Done

- [ ] Code implémenté et compilant
- [ ] Tests unitaires passent (coverage > 80%)
- [ ] Tests manuels validés
- [ ] Code review approuvée
- [ ] Pas de warnings Xcode
- [ ] Documentation inline (comments)
- [ ] PR mergée dans `main`

---

## Notes

- Le format 16kHz mono est OBLIGATOIRE pour Whisper
- Prévoir le passage des buffers à US-002 (callback ou Combine publisher)
- L'indicateur visuel sera géré par US-024 (Orbe) — cette story expose juste `isRecording`

---

*Story créée par Bob (SM BMAD) — 2026-03-04*
