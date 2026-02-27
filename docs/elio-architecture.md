# Elio — Architecture Technique

**Architecte :** Winston (BMAD)
**Version :** 1.0
**Date :** 27 février 2026
**Source :** PRD Elio v1.0 + Étude Mary

---

## 1. Vue d'ensemble

```
┌─────────────────────────────────────┐
│           📱 iPhone (Client)         │
│                                     │
│  ┌─────────┐  ┌──────────────────┐  │
│  │Porcupine│  │  React Native +  │  │
│  │(Wake    │──│  Expo            │  │
│  │ Word)   │  │                  │  │
│  └─────────┘  │  - Audio capture │  │
│               │  - WebSocket     │  │
│               │  - Clavier Elio  │  │
│               │  - UI/UX         │  │
│               └────────┬─────────┘  │
└────────────────────────┼────────────┘
                         │ WebSocket + REST
                         ▼
┌─────────────────────────────────────┐
│        🖥️ API Gateway (VPS)         │
│        Node.js / Fastify            │
│                                     │
│  ┌──────┐ ┌───────┐ ┌───────────┐  │
│  │Auth  │ │Router │ │Rate Limit │  │
│  │JWT   │ │Intent │ │& Billing  │  │
│  └──────┘ └───┬───┘ └───────────┘  │
└───────────────┼─────────────────────┘
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
┌────────┐ ┌────────┐ ┌──────────┐
│  STT   │ │  LLM   │ │   TTS    │
│Whisper │ │Claude  │ │  Piper   │
│(CPU)   │ │Haiku   │ │  (CPU)   │
│        │ │(API)   │ │          │
└────────┘ └───┬────┘ └──────────┘
               │
          ┌────┴─────┐
          ▼          ▼
    ┌──────────┐ ┌──────────────┐
    │Supabase  │ │ Intégrations │
    │PostgreSQL│ │ Gmail, Cal,  │
    │+pgvector │ │ Telegram,    │
    │+Auth     │ │ Spotify...   │
    └──────────┘ └──────────────┘
```

---

## 2. Stack technique

| Composant | Technologie | Justification |
|-----------|-------------|---------------|
| **App mobile** | React Native + Expo | Cross-platform, hot reload, large écosystème |
| **Wake word** | Porcupine (Picovoice) | On-device, <4% CPU, supporte FR |
| **STT** | faster-whisper-small (CTranslate2) | CPU only, 4x plus rapide que Whisper, int8 quantized |
| **LLM** | Claude Haiku (Anthropic API) | Meilleur rapport qualité/prix, prompt caching |
| **TTS** | Piper ONNX | CPU only, ~5-10x realtime, voix FR naturelle |
| **BDD** | Supabase (PostgreSQL + pgvector) | Auth intégré, Realtime, RLS, vecteurs |
| **API Gateway** | Node.js + Fastify | Performance, WebSocket natif, TypeScript |
| **Infra** | Hetzner (serveurs dédiés EU) | RGPD, prix compétitif, bare-metal |

---

## 3. Flux requête vocale

```
User        iPhone       API GW       STT        Claude      Actions     TTS
 │            │            │           │           │           │          │
 │──"Hey Elio"│            │           │           │           │          │
 │            │──detect──▶ │           │           │           │          │
 │            │  (local)   │           │           │           │          │
 │──"Lis mes ─│            │           │           │           │          │
 │   mails"   │            │           │           │           │          │
 │            │──audio───▶ │           │           │           │          │
 │            │ (WS)       │──audio──▶ │           │           │          │
 │            │            │           │──text───▶ │           │          │
 │            │            │           │"lis mes   │           │          │
 │            │            │           │ mails"    │──fetch──▶ │          │
 │            │            │           │           │ Gmail API │          │
 │            │            │           │           │◀─mails───│          │
 │            │            │           │           │──résumé─▶ │          │
 │            │            │           │           │           │──text──▶ │
 │            │            │           │           │           │          │
 │            │◀──────────audio stream──────────────────────────│         │
 │◀──parle────│            │           │           │           │          │
```

**Budget latence (<2s) :**
- STT : ~300ms
- Claude Haiku (TTFT avec cache) : ~500ms
- Action externe (Gmail) : ~300ms
- TTS (Piper) : ~200ms
- Réseau (aller-retour) : ~200ms
- **Total estimé : ~1.5s** ✅

---

## 4. Schéma BDD

### Table `users`
| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID PK | Identifiant unique |
| email | TEXT UNIQUE | Email de connexion |
| display_name | TEXT | Prénom affiché |
| subscription_tier | ENUM | free, pro, annual, care |
| settings | JSONB | Voix, ton, verbosité, tutoiement, wake_word |
| created_at | TIMESTAMPTZ | Date création |

### Table `connected_services`
| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID PK | |
| user_id | FK → users | |
| service_type | ENUM | gmail, outlook, imap, google_cal, telegram, spotify, etc. |
| credentials | JSONB | Tokens OAuth chiffrés AES-256 |
| status | ENUM | active, expired, revoked |
| created_at | TIMESTAMPTZ | |

### Table `conversations`
| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID PK | |
| user_id | FK → users | |
| started_at | TIMESTAMPTZ | |
| ended_at | TIMESTAMPTZ | |
| message_count | INT | |
| mood_detected | TEXT | Optionnel, état émotionnel détecté |

### Table `messages`
| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID PK | |
| conversation_id | FK → conversations | |
| role | ENUM | user, assistant |
| content | TEXT | |
| audio_url | TEXT | Optionnel (Supabase Storage) |
| tokens_in | INT | |
| tokens_out | INT | |
| created_at | TIMESTAMPTZ | |

### Table `memories`
| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID PK | |
| user_id | FK → users | |
| category | ENUM | preference, fact, person, event, reminder |
| content | TEXT | Ex: "L'user préfère le jazz" |
| embedding | VECTOR(1536) | pgvector, pour recherche sémantique |
| source_conversation_id | FK → conversations | |
| relevance_score | FLOAT | |
| created_at | TIMESTAMPTZ | |

### Table `care_contacts` (tier Care)
| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID PK | |
| patient_user_id | FK → users | |
| caregiver_user_id | FK → users | |
| relationship | TEXT | Ex: "fille" |
| alert_level | ENUM | info, warning, urgent |
| daily_report | BOOLEAN | Default true |

---

## 5. Sécurité

### Row Level Security (RLS)
- Chaque user ne voit que SES données
- Les caregivers voient les données patient (tier Care, relation validée)
- Tokens OAuth chiffrés AES-256 (clé serveur, jamais en clair en BDD)

### Auth
- Supabase Auth (email magic link + social login Apple/Google)
- JWT pour sessions API
- Refresh token rotation
- Rate limiting par user et par tier

### Données sensibles
- Audio : traité en mémoire, jamais stocké sauf demande explicite
- Embeddings mémoire : liés au user_id, RLS enforced
- RGPD : droit effacement, export, consentement explicite
- Hébergement EU (Hetzner, Allemagne)

---

## 6. Communication

| Type | Protocole | Usage |
|------|-----------|-------|
| Audio streaming | **WebSocket** (bidirectionnel) | Envoi audio user → réception audio réponse |
| API REST | **HTTPS** | Auth, settings, services, billing |
| Realtime | **Supabase Realtime** (WS) | Notifications, alertes Care, sync |
| Push | **APNs** | Rappels quand app en background |

---

## 7. Infrastructure (1 000 users)

| Rôle | Specs Hetzner | Nb | Prix/mois |
|------|---------------|-----|-----------|
| API Gateway | CX32 (4 vCPU, 16Go) | 2 | ~30€ |
| STT Workers | AX52 (Ryzen 7, 8c/16t, 64Go) | 2 | ~98€ |
| TTS Workers | AX52 (Ryzen 7, 8c/16t, 64Go) | 1 | ~49€ |
| Supabase | AX102 (Ryzen 9, 16c/32t, 128Go) | 1 | ~79€ |
| **Total** | | **6** | **~350€/mois** |

Scaling : ajouter des workers STT/TTS horizontalement. L'API Gateway scale via load balancer.

---

## 8. ADR (Architecture Decision Records)

### ADR-001 : WebSocket pour le streaming audio
- **Décision** : WebSocket bidirectionnel
- **Raison** : Latence minimale, streaming continu, half-duplex naturel
- **Alternative rejetée** : gRPC (complexité React Native), REST polling (latence)

### ADR-002 : Claude Haiku API plutôt que LLM local
- **Décision** : API Anthropic avec prompt caching
- **Raison** : Qualité supérieure, pas de GPU, cache reads à 10% du prix
- **Risque** : Dépendance API externe
- **Mitigation** : Fallback local Llama 3.2 3B quantifié si API down

### ADR-003 : pgvector pour la mémoire sémantique
- **Décision** : pgvector intégré à PostgreSQL Supabase
- **Raison** : Pas de BDD vectorielle séparée, SQL + vecteurs dans une seule base
- **Alternative rejetée** : Pinecone (coût), Weaviate (complexité ops)

### ADR-004 : Porcupine plutôt qu'OpenWakeWord
- **Décision** : Picovoice Porcupine pour le wake word
- **Raison** : SDK React Native officiel, <4% CPU, wake words custom, supporte FR
- **Risque** : Pricing Picovoice peut changer
- **Mitigation** : OpenWakeWord en fallback (mais plus lourd)

---

*Document généré le 27 février 2026 — Winston, Architecte BMAD*
