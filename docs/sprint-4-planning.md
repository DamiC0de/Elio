# Sprint 4 — Polish
## Diva MVP

**Dates** : Après Sprint 3 (2 semaines)
**Objectif** : Finitions UI, onboarding complet, QA

---

## 🎯 Sprint Goal

> L'app est prête pour les premiers testeurs : onboarding fluide, UI polish, bugs corrigés

---

## 📋 Stories du Sprint

| ID | Story | Points | Status |
|----|-------|--------|--------|
| US-025 | États visuels orbe | 5 | Ready |
| US-026 | Visualisation waveform | 3 | Ready |
| US-027 | Affichage texte transcrit | 2 | Ready |
| US-028 | Affichage réponse Diva | 2 | Ready |
| US-029 | Écran bienvenue | 2 | Ready |
| US-032 | Création compte rapide | 3 | Ready |
| US-033 | Tutoriel interactif | 3 | Ready |
| US-034 | Écran principal post-onboarding | 2 | Ready |

**Total** : 22 points

---

## 📐 Focus UI

### États visuels orbe (US-025)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Orb States                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   IDLE              LISTENING         PROCESSING                │
│   ┌──────┐          ┌──────┐          ┌──────┐                 │
│   │ 💜   │          │ 💙   │          │ 🩵   │                 │
│   │ Pulse│          │ Wave │          │ Spin │                 │
│   │ slow │          │ react│          │ fast │                 │
│   └──────┘          └──────┘          └──────┘                 │
│                                                                  │
│   SPEAKING          ERROR                                        │
│   ┌──────┐          ┌──────┐                                    │
│   │ 💚   │          │ ❤️   │                                    │
│   │ Wave │          │ Flash│                                    │
│   │ audio│          │ shake│                                    │
│   └──────┘          └──────┘                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Onboarding Flow (US-029 → US-034)

```
Welcome → Micro Permission → Notif Permission → Signup → Tutorial → Home
   │            │                   │              │          │        │
   ▼            ▼                   ▼              ▼          ▼        ▼
  Logo      Explain +           Explain +       Email/     3 tips   Orbe
  Tagline   Request iOS         Request iOS    Sign Apple   Test    Ready
```

---

## 📝 Stories résumées

### US-025 : États visuels orbe (5 pts)
- Idle: violet pulsant lentement
- Listening: bleu ondulant
- Processing: cyan spinning
- Speaking: vert avec waveform
- Error: rouge flash
- Transitions fluides

### US-026 : Waveform (3 pts)
- Anneau réactif au volume
- Synchronisé avec audio input/output
- Intégré à l'orbe

### US-027-028 : Affichage texte (4 pts)
- Transcription streaming sous l'orbe
- Réponse Diva synchronisée TTS
- Copiable (long press)

### US-029 : Bienvenue (2 pts)
- Logo Diva
- Tagline "Ton assistant vocal privé"
- CTA "Commencer"

### US-032 : Signup rapide (3 pts)
- Email + password seulement
- Sign in with Apple
- Skip possible (local only)

### US-033 : Tutoriel (3 pts)
- 3 écrans max
- Exemples de commandes
- Test vocal "Dis Bonjour Diva"
- Skippable

### US-034 : Post-onboarding (2 pts)
- Transition fluide
- Hint "Appuie ou dis Hey Diva"
- Never show again

---

## 🐛 Buffer QA

| Tâche | Estimation |
|-------|------------|
| Bug fixes Sprint 1-3 | 3-5 pts |
| Performance tuning | 2-3 pts |
| Accessibility audit | 2 pts |
| Memory leak check | 2 pts |
| Crash reporting setup | 2 pts |

---

## ✅ Definition of Done (MVP)

- [ ] Toutes les stories MUST terminées
- [ ] Onboarding flow complet
- [ ] 0 crash en 24h de test
- [ ] App Store ready (icons, screenshots)
- [ ] Privacy policy publiée
- [ ] TestFlight build uploadée

---

*Document généré par Bob (SM BMAD) — 2026-03-04*
