# Elio — Backlog MVP

**Scrum Master :** Bob (BMAD)
**Date :** 27 février 2026
**Sprint duration :** 2 semaines
**MVP target :** 4 sprints = 8 semaines

---

## Épiques

| # | Épique | Stories | Priorité |
|---|--------|---------|----------|
| E1 | Infrastructure & Backend | 5 | P0 |
| E2 | Pipeline vocal | 6 | P0 |
| E3 | App React Native | 5 | P0 |
| E4 | Intégrations services | 5 | P1 |
| E5 | Clavier intelligent | 3 | P1 |
| E6 | Mémoire & Personnalité | 4 | P1 |
| E7 | Onboarding & UX | 3 | P2 |
| | **Total** | **31 stories** | |

---

## Stories détaillées

### E1 — Infrastructure & Backend

| ID | Story | Points | Sprint |
|----|-------|--------|--------|
| EL-001 | Setup VPS Hetzner + API Gateway Fastify | 5 | S1 |
| EL-002 | Setup Supabase (BDD + Auth + RLS) | 5 | S1 |
| EL-003 | Auth flow (magic link + Apple Sign In) | 5 | S1 |
| EL-004 | Billing & Subscription (RevenueCat) | 8 | S2 |
| EL-005 | Monitoring & Logging (Sentry + Pino) | 3 | S2 |

### E2 — Pipeline vocal

| ID | Story | Points | Sprint |
|----|-------|--------|--------|
| EL-006 | STT Worker (faster-whisper-small) | 8 | S1 |
| EL-007 | TTS Worker (Piper ONNX FR) | 5 | S1 |
| EL-008 | Intégration Claude Haiku + prompt caching | 5 | S1 |
| EL-009 | Orchestrateur de requêtes | 8 | S2 |
| EL-010 | Wake word Porcupine ("Hey Elio") | 5 | S2 |
| EL-011 | Optimisation latence pipeline (<2s) | 5 | S3 |

### E3 — App React Native

| ID | Story | Points | Sprint |
|----|-------|--------|--------|
| EL-012 | Setup projet Expo + Navigation | 3 | S1 |
| EL-013 | Écran principal (conversation + PTT) | 8 | S2 |
| EL-014 | Écran settings | 5 | S3 |
| EL-015 | Écran services connectés | 5 | S2 |
| EL-016 | Notifications & rappels (APNs) | 5 | S3 |

### E4 — Intégrations services

| ID | Story | Points | Sprint |
|----|-------|--------|--------|
| EL-017 | Gmail (lire + envoyer, OAuth2) | 8 | S2 |
| EL-018 | Google Calendar (CRUD, OAuth2) | 5 | S2 |
| EL-019 | Contacts iOS | 3 | S2 |
| EL-020 | Météo & Recherche web | 3 | S3 |
| EL-021 | Lancement d'apps (URL Schemes) | 3 | S3 |

### E5 — Clavier intelligent

| ID | Story | Points | Sprint |
|----|-------|--------|--------|
| EL-022 | Clavier custom iOS (base + vocal) | 13 | S3 |
| EL-023 | Mode rédaction assistée | 5 | S4 |
| EL-024 | Mode traduction clavier | 3 | S4 |

### E6 — Mémoire & Personnalité

| ID | Story | Points | Sprint |
|----|-------|--------|--------|
| EL-025 | Extraction de mémoire (faits + embeddings) | 8 | S3 |
| EL-026 | Rappel contextuel RAG (recherche sémantique) | 8 | S3 |
| EL-027 | Personnalité configurable (system prompt) | 3 | S2 |
| EL-028 | Gestion mémoire user (CRUD + export RGPD) | 5 | S4 |

### E7 — Onboarding & UX

| ID | Story | Points | Sprint |
|----|-------|--------|--------|
| EL-029 | Écrans onboarding (4 étapes) | 5 | S3 |
| EL-030 | Tutorial interactif premier usage | 3 | S4 |
| EL-031 | Widget iOS + Live Activities | 5 | S4 |

---

## Planning sprints

| Sprint | Dates | Stories | Points | Focus |
|--------|-------|---------|--------|-------|
| S1 | Sem 1-2 | EL-001→003, 006→008, 012 | 36 | Fondations |
| S2 | Sem 3-4 | EL-004→005, 009→010, 013, 015, 017→019, 027 | 53 | Core |
| S3 | Sem 5-6 | EL-011, 014, 016, 020→022, 025→026, 029 | 49 | Polish |
| S4 | Sem 7-8 | EL-023→024, 028, 030→031 | 21 | Finition |

**Total : 159 points / 31 stories / 8 semaines**

---

*Document généré le 27 février 2026 — Bob, Scrum Master BMAD*
