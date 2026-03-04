# Sprint 2 — Intelligence
## Diva MVP

**Dates** : Après Sprint 1 (2 semaines)
**Objectif** : Triage local + intégration cloud Claude

---

## 🎯 Sprint Goal

> L'utilisateur pose une question simple ("quelle heure est-il ?") → réponse locale instantanée. Question complexe ("explique la relativité") → réponse cloud intelligente.

---

## 📋 Stories du Sprint

| ID | Story | Points | Status |
|----|-------|--------|--------|
| US-009 | Inscription utilisateur | 3 | Ready |
| US-010 | Connexion utilisateur | 3 | Ready |
| US-011 | Triage local (Qwen) | 5 | Ready |
| US-012 | Requêtes Claude API | 5 | Ready |
| US-013 | Contexte conversationnel | 3 | Ready |
| US-022 | Créer un rappel | 3 | Ready |

**Total** : 22 points

---

## 📐 Architecture Sprint 2

```
┌─────────────────────────────────────────────────────────────────┐
│                     Sprint 2 Scope                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │                    Auth Flow                              │  │
│   │  ┌──────────┐    ┌──────────┐    ┌──────────┐           │  │
│   │  │  Email   │───►│  Server  │───►│ Keychain │           │  │
│   │  │ + Pass   │    │  Auth    │    │  Store   │           │  │
│   │  └──────────┘    └──────────┘    └──────────┘           │  │
│   └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │                    Triage Pipeline                        │  │
│   │                                                           │  │
│   │  Transcription    Qwen-0.5B         Decision             │  │
│   │  ┌──────────┐    ┌──────────┐    ┌──────────────┐       │  │
│   │  │ "quelle  │───►│  Triage  │───►│ tier=1: local│       │  │
│   │  │  heure?" │    │   LLM    │    │ tier=2: cloud│       │  │
│   │  └──────────┘    └──────────┘    └──────┬───────┘       │  │
│   │                                         │                │  │
│   │                    ┌────────────────────┼────────┐       │  │
│   │                    │                    │        │       │  │
│   │                    ▼                    ▼        │       │  │
│   │              ┌──────────┐        ┌──────────┐   │       │  │
│   │              │  Local   │        │  Claude  │   │       │  │
│   │              │ Response │        │   API    │   │       │  │
│   │              └──────────┘        └──────────┘   │       │  │
│   │                    │                    │        │       │  │
│   │                    └────────────────────┘        │       │  │
│   │                             │                    │       │  │
│   │                             ▼                    │       │  │
│   │                       ┌──────────┐              │       │  │
│   │                       │ Context  │              │       │  │
│   │                       │  Store   │              │       │  │
│   │                       └──────────┘              │       │  │
│   └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│   Modèles ajoutés:                                              │
│   • qwen2.5-0.5b-q4.mlmodelc (~300MB)                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔗 Dépendances

```
US-009 (Inscription)
    │
    └───► US-010 (Connexion)
              │
              └───► US-012 (Claude API)
                        │
                        └───► US-013 (Contexte)

US-002 (Sprint 1)
    │
    └───► US-011 (Triage)
              │
              ├───► Local actions (US-022 Rappels)
              │
              └───► US-012 (Cloud)
```

---

## ✅ Definition of Done (Sprint)

- [ ] Auth flow complet (inscription + connexion)
- [ ] Triage fonctionne (local vs cloud)
- [ ] Claude API intégrée avec retry
- [ ] Contexte conversationnel (10 derniers messages)
- [ ] Rappels créés via Reminders.app
- [ ] Tests E2E passent

---

*Document généré par Bob (SM BMAD) — 2026-03-04*
