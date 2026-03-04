# Sprint 1 — Foundation
## Diva MVP

**Dates** : À définir (2 semaines)
**Objectif** : Prototype fonctionnel capture vocale + réponse

---

## 🎯 Sprint Goal

> L'utilisateur appuie sur l'orbe, parle, voit sa voix transcrite, et entend Diva répondre "Je t'ai entendu dire: [transcription]"

---

## 📋 Stories du Sprint

| ID | Story | Points | Status |
|----|-------|--------|--------|
| US-001 | Capture audio micro | 3 | Ready |
| US-002 | Transcription locale (Whisper) | 5 | Ready |
| US-003 | Synthèse vocale (Piper) | 5 | Ready |
| US-004 | Détection fin de parole (VAD) | 3 | Ready |
| US-024 | Affichage orbe | 3 | Ready |

**Total** : 19 points

---

## 📐 Architecture Sprint 1

```
┌─────────────────────────────────────────────────────────────────┐
│                     Sprint 1 Scope                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│   │   User   │───►│   Orbe   │───►│  Audio   │───►│ Whisper  │ │
│   │   Tap    │    │  (UI)    │    │ Service  │    │  (STT)   │ │
│   └──────────┘    └──────────┘    └────┬─────┘    └────┬─────┘ │
│                                        │               │        │
│                                        │  VAD          │        │
│                                        ▼               │        │
│                                   ┌──────────┐         │        │
│                                   │  Silero  │         │        │
│                                   │   VAD    │         │        │
│                                   └────┬─────┘         │        │
│                                        │               │        │
│                                        │ speech_end    │        │
│                                        ▼               ▼        │
│                                   ┌──────────┐    ┌──────────┐ │
│                                   │  Piper   │◄───│ Response │ │
│                                   │  (TTS)   │    │  Logic   │ │
│                                   └──────────┘    └──────────┘ │
│                                                                  │
│   Modèles inclus:                                               │
│   • whisper-tiny.mlmodelc (~40MB)                               │
│   • silero_vad.onnx (~2MB)                                      │
│   • fr_FR-siwis-medium.onnx (~20MB)                             │
│   Total: ~62MB                                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔗 Dépendances

```
US-001 (Audio)
    │
    ├───► US-002 (Whisper)
    │         │
    │         └───► Response Logic
    │
    └───► US-004 (VAD)
              │
              └───► Trigger end recording

US-003 (Piper) ◄─── Response Logic

US-024 (Orbe) ◄─── Visual feedback
```

### Ordre de développement suggéré

1. **Jour 1-2** : US-024 (Orbe) + US-001 (Audio) en parallèle
2. **Jour 3-4** : US-002 (Whisper)
3. **Jour 5-6** : US-003 (Piper)
4. **Jour 7-8** : US-004 (VAD) + intégration
5. **Jour 9-10** : Tests, polish, démo

---

## ✅ Definition of Done (Sprint)

- [ ] Toutes les stories sont Done
- [ ] L'app compile sans warnings
- [ ] La démo fonctionne sur device réel
- [ ] Les modèles ML sont inclus dans le bundle
- [ ] Le README est à jour
- [ ] Sprint review effectuée

---

## 🚨 Risques identifiés

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| Intégration Piper complexe | Élevé | Moyen | Fallback AVSpeechSynthesizer |
| Taille bundle > 100MB | Moyen | Faible | Modèle tiny, compression |
| Latence Whisper > 500ms | Moyen | Faible | Profiling, optimisation |
| WhisperKit bugs | Moyen | Faible | Fallback whisper.cpp |

---

## 📊 Métriques à suivre

| Métrique | Cible | Mesure |
|----------|-------|--------|
| STT latency | < 500ms | Instruments |
| TTS latency | < 300ms | Instruments |
| VAD accuracy | > 95% | Tests manuels |
| App size | < 100MB | Archive |
| RAM peak | < 400MB | Instruments |

---

## 📝 Notes de sprint

### Setup nécessaire

1. **Xcode 15.2+** avec iOS 17 SDK
2. **CocoaPods** ou **SPM** pour dépendances
3. **Device physique** (simulateur lent pour ML)
4. **Modèles ML** téléchargés depuis HuggingFace

### Commandes utiles

```bash
# Clone et setup
git clone https://github.com/DamiC0de/Diva.git
cd Diva
pod install  # ou swift package resolve

# Build
xcodebuild -workspace Diva.xcworkspace -scheme Diva -sdk iphoneos

# Test
xcodebuild test -workspace Diva.xcworkspace -scheme DivaTests
```

---

*Document généré par Bob (SM BMAD) — 2026-03-04*
