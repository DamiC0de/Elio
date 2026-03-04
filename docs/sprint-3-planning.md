# Sprint 3 — Notifications
## Diva MVP

**Dates** : Après Sprint 2 (2 semaines)
**Objectif** : Lecture des notifications de messages

---

## 🎯 Sprint Goal

> L'utilisateur dit "Lis mes messages" → Diva lit les notifications WhatsApp, Messenger, SMS récentes

---

## 📋 Stories du Sprint

| ID | Story | Points | Status |
|----|-------|--------|--------|
| US-015 | Capture notifications | 5 | Ready |
| US-016 | Demande vocale lecture | 3 | Ready |
| US-017 | Filtrage par expéditeur | 3 | Ready |
| US-018 | Filtrage par application | 2 | Ready |
| US-019 | Marquage comme lu | 2 | Ready |
| US-020 | Ouvrir une application | 3 | Ready |
| US-030 | Permission micro (onboarding) | 2 | Ready |
| US-031 | Permission notifications | 2 | Ready |

**Total** : 22 points

---

## 📐 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                NotificationServiceExtension                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   iOS Push                Extension              App Group       │
│   ┌──────────┐          ┌──────────┐          ┌──────────┐     │
│   │ WhatsApp │─────────►│ Intercept│─────────►│ Shared   │     │
│   │ Messenger│          │ Extract  │          │ Container│     │
│   │   SMS    │          │ Forward  │          │          │     │
│   └──────────┘          └──────────┘          └────┬─────┘     │
│                                                     │           │
│                              ┌──────────────────────┘           │
│                              ▼                                   │
│   ┌──────────────────────────────────────────────────────────┐ │
│   │                    Main App                               │ │
│   │  ┌──────────┐    ┌──────────┐    ┌──────────┐           │ │
│   │  │  Read    │───►│ Filter   │───►│   TTS    │           │ │
│   │  │ Command  │    │ by user  │    │  Output  │           │ │
│   │  └──────────┘    │ by app   │    └──────────┘           │ │
│   │                  └──────────┘                            │ │
│   └──────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📝 Stories résumées

### US-015 : Capture notifications (5 pts)
- NotificationServiceExtension
- Extraction : sender, content, app, timestamp
- Stockage App Group (UserDefaults partagé)

### US-016 : Demande vocale lecture (3 pts)
- Commandes : "lis mes messages", "j'ai des messages ?"
- Format : "Tu as 3 messages. Julie sur WhatsApp dit : ..."

### US-017 : Filtrage par expéditeur (3 pts)
- "Messages de Julie"
- Matching fuzzy sur le nom

### US-018 : Filtrage par application (2 pts)
- "Messages WhatsApp"
- Comptage par app

### US-019 : Marquage comme lu (2 pts)
- Marquage auto après lecture
- "Relire le dernier"

### US-020 : Ouvrir application (3 pts)
- "Ouvre WhatsApp"
- URL schemes

### US-030-031 : Permissions onboarding (4 pts)
- Écrans explicatifs avant popup iOS
- Flow permission micro + notifications

---

## ✅ Definition of Done (Sprint)

- [ ] NotificationServiceExtension déployée
- [ ] Lecture vocale fonctionne
- [ ] Filtrage par nom/app fonctionne
- [ ] Deep links ouvrent les apps
- [ ] Onboarding permissions complet

---

*Document généré par Bob (SM BMAD) — 2026-03-04*
