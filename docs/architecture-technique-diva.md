# Architecture Technique — Diva
## Assistant Vocal Privacy-First

**Version** : 1.0
**Date** : 2026-03-04
**Auteur** : Winston (Architecte BMAD)
**Status** : Draft

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Stack technique](#2-stack-technique)
3. [Architecture Tier 1 — Local (iOS)](#3-architecture-tier-1--local-ios)
4. [Architecture Tier 2 — Cloud](#4-architecture-tier-2--cloud)
5. [Architecture V1.1 — Screen Recording & Mac](#5-architecture-v11--screen-recording--mac)
6. [Flux de communication](#6-flux-de-communication)
7. [Schémas de données](#7-schémas-de-données)
8. [Sécurité](#8-sécurité)
9. [Performance & Latence](#9-performance--latence)
10. [ADRs](#10-adrs)

---

## 1. Vue d'ensemble

### 1.1 Architecture globale

```
┌─────────────────────────────────────────────────────────────────────┐
│                           DIVA ECOSYSTEM                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────┐         ┌─────────────────────┐           │
│  │   iPhone (Tier 1)   │         │   Cloud (Tier 2)    │           │
│  │                     │  E2E    │                     │           │
│  │  ┌───────────────┐  │ ◄─────► │  ┌───────────────┐  │           │
│  │  │  Voice Input  │  │  TLS    │  │  API Gateway  │  │           │
│  │  └───────┬───────┘  │         │  └───────┬───────┘  │           │
│  │          ▼          │         │          ▼          │           │
│  │  ┌───────────────┐  │         │  ┌───────────────┐  │           │
│  │  │ Whisper (STT) │  │         │  │ Claude Haiku  │  │           │
│  │  └───────┬───────┘  │         │  └───────┬───────┘  │           │
│  │          ▼          │         │          ▼          │           │
│  │  ┌───────────────┐  │         │  ┌───────────────┐  │           │
│  │  │ Triage (LLM)  │──┼────────►│  │   Response    │  │           │
│  │  └───────┬───────┘  │         │  └───────────────┘  │           │
│  │          ▼          │         │                     │           │
│  │  ┌───────────────┐  │         └─────────────────────┘           │
│  │  │  Piper (TTS)  │  │                                           │
│  │  └───────────────┘  │         ┌─────────────────────┐           │
│  │                     │  WiFi   │   Mac (V1.1)        │           │
│  │  ┌───────────────┐  │ ◄─────► │                     │           │
│  │  │ Notifications │  │  Local  │  ┌───────────────┐  │           │
│  │  │ Deep Links    │  │         │  │  Automation   │  │           │
│  │  └───────────────┘  │         │  │  Messages.app │  │           │
│  │                     │         │  │  WhatsApp Web │  │           │
│  └─────────────────────┘         │  └───────────────┘  │           │
│                                  └─────────────────────┘           │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Principes architecturaux

| Principe | Description |
|----------|-------------|
| **Privacy-first** | Données locales par défaut, cloud uniquement si nécessaire |
| **Local-first** | 80% du traitement sur device |
| **Zero-persistence cloud** | Aucune donnée stockée côté serveur |
| **E2E encryption** | Chiffrement de bout en bout pour toute donnée en transit |
| **Graceful degradation** | Fonctionne offline avec capacités réduites |

---

## 2. Stack technique

### 2.1 Tier 1 — iOS

| Composant | Technologie | Version | Justification |
|-----------|-------------|---------|---------------|
| **Framework** | Swift / SwiftUI | 5.9+ | Performance native, accès APIs iOS |
| **STT** | Whisper.cpp | tiny/base | ONNX optimisé pour ARM, ~40MB |
| **TTS** | Piper | - | ONNX, voix naturelles, ~20MB |
| **LLM Triage** | llama.cpp | - | Qwen2.5-0.5B quantifié, ~300MB |
| **Storage local** | SQLite | 3.x | Rapide, embarqué, chiffré |
| **Networking** | URLSession | - | Native iOS, pinning certs |
| **Audio** | AVFoundation | - | Capture/playback natif |
| **Notifications** | NotificationServiceExtension | - | Accès contenu notifications |

### 2.2 Tier 2 — Cloud

| Composant | Technologie | Justification |
|-----------|-------------|---------------|
| **Runtime** | Node.js 20 LTS | Async I/O, écosystème riche |
| **Framework** | Fastify | Performance, TypeScript natif |
| **LLM** | Claude Haiku (Anthropic API) | Coût/performance optimal |
| **Auth** | JWT + refresh tokens | Stateless, sécurisé |
| **Hosting** | VPS EU (Hetzner/OVH) | RGPD, coût maîtrisé |

### 2.3 V1.1 — Additions

| Composant | Technologie | Justification |
|-----------|-------------|---------------|
| **Screen Recording** | ReplayKit | API native iOS |
| **OCR Cloud** | GPU Marketplace + Vision model | Coût variable, TEE |
| **Mac App** | Swift / AppKit | Automation native macOS |
| **Mac Automation** | AppleScript + Accessibility | Contrôle apps tierces |
| **Local Sync** | Bonjour + TLS | Découverte + sécurité |

---

## 3. Architecture Tier 1 — Local (iOS)

### 3.1 Diagramme de composants

```
┌─────────────────────────────────────────────────────────────────┐
│                        DIVA iOS App                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │    Views     │  │  ViewModels  │  │   Services   │           │
│  │  (SwiftUI)   │◄─┤  (ObsObj)    │◄─┤              │           │
│  └──────────────┘  └──────────────┘  └──────┬───────┘           │
│                                             │                    │
│  ┌──────────────────────────────────────────┼──────────────────┐│
│  │                    Service Layer         │                  ││
│  │                                          ▼                  ││
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐            ││
│  │  │AudioService│  │ LLMService │  │ TTSService │            ││
│  │  │ (Record)   │  │ (Triage)   │  │ (Piper)    │            ││
│  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘            ││
│  │        │               │               │                    ││
│  │  ┌─────▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐            ││
│  │  │ STTService │  │ CloudSync  │  │NotifService│            ││
│  │  │ (Whisper)  │  │ (API)      │  │ (Extension)│            ││
│  │  └────────────┘  └────────────┘  └────────────┘            ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Data Layer                               ││
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐            ││
│  │  │  SQLite    │  │  Keychain  │  │  UserDef   │            ││
│  │  │ (Context)  │  │ (Secrets)  │  │ (Prefs)    │            ││
│  │  └────────────┘  └────────────┘  └────────────┘            ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    ML Models (Core ML)                      ││
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐            ││
│  │  │whisper.mlm │  │qwen-0.5b.ml│  │ piper.onnx │            ││
│  │  └────────────┘  └────────────┘  └────────────┘            ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Pipeline vocal

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  Micro  │───►│ Whisper │───►│ Triage  │───►│ Action  │───►│  Piper  │
│ (Audio) │    │  (STT)  │    │  (LLM)  │    │(Execute)│    │  (TTS)  │
└─────────┘    └─────────┘    └────┬────┘    └─────────┘    └─────────┘
                                   │
                              tier=1? ──► Local execution
                                   │
                              tier=2? ──► Cloud API
```

### 3.3 Triage local — Logique de décision

```swift
struct TriageResult {
    let tier: Int           // 1 = local, 2 = cloud
    let confidence: Float   // 0.0 - 1.0
    let intent: String      // "reminder", "message", "query", etc.
    let response: String?   // Réponse si tier 1
}

// Règles de triage
func triage(input: String) -> TriageResult {
    // Règles statiques (instant, pas de LLM)
    if input.matches(/rappelle.?moi|reminder/i) {
        return TriageResult(tier: 1, confidence: 1.0, intent: "reminder")
    }
    if input.matches(/quelle heure|what time/i) {
        return TriageResult(tier: 1, confidence: 1.0, intent: "time")
    }
    
    // LLM local pour cas ambigus
    let llmResult = localLLM.classify(input)
    
    if llmResult.tier == 1 && llmResult.confidence > 0.8 {
        return llmResult  // Exécution locale
    } else {
        return TriageResult(tier: 2, ...)  // Envoi cloud
    }
}
```

### 3.4 Gestion des notifications

```
┌─────────────────────────────────────────────────────────────┐
│              NotificationServiceExtension                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. iOS reçoit notification push (WhatsApp, Messenger, etc.) │
│                          │                                   │
│                          ▼                                   │
│  2. Extension intercepte AVANT affichage                     │
│                          │                                   │
│                          ▼                                   │
│  3. Extraction contenu : sender, message, app, timestamp     │
│                          │                                   │
│                          ▼                                   │
│  4. Stockage temporaire (App Group shared container)         │
│                          │                                   │
│                          ▼                                   │
│  5. App principale lit et traite (si active)                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Architecture Tier 2 — Cloud

### 4.1 Diagramme serveur

```
┌─────────────────────────────────────────────────────────────────┐
│                      DIVA Cloud Server                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                     API Gateway (Fastify)                  │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │ │
│  │  │  /auth   │  │  /chat   │  │  /ocr    │  │ /health  │   │ │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────────┘   │ │
│  └───────┼─────────────┼─────────────┼───────────────────────┘ │
│          │             │             │                          │
│  ┌───────▼─────────────▼─────────────▼───────────────────────┐ │
│  │                    Service Layer                          │ │
│  │                                                           │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │ │
│  │  │ AuthService │  │  LLMService │  │  OCRService │       │ │
│  │  │ (JWT)       │  │ (Anthropic) │  │ (V1.1)      │       │ │
│  │  └─────────────┘  └──────┬──────┘  └─────────────┘       │ │
│  │                          │                                │ │
│  │                          ▼                                │ │
│  │                   ┌─────────────┐                        │ │
│  │                   │  Anthropic  │                        │ │
│  │                   │     API     │                        │ │
│  │                   └─────────────┘                        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    NO PERSISTENT STORAGE                  │ │
│  │           (Sessions en mémoire, TTL 24h max)              │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 API Endpoints

| Endpoint | Méthode | Description | Auth |
|----------|---------|-------------|------|
| `/auth/register` | POST | Création compte | - |
| `/auth/login` | POST | Obtention tokens | - |
| `/auth/refresh` | POST | Renouvellement token | Refresh |
| `/chat` | POST | Requête LLM | JWT |
| `/chat/stream` | WS | Streaming réponse | JWT |
| `/ocr` | POST | OCR frames (V1.1) | JWT |
| `/health` | GET | Health check | - |

### 4.3 Format requête /chat

```typescript
interface ChatRequest {
  message: string;           // Transcription de la requête
  context?: {
    recentMessages?: string[]; // Derniers échanges (anonymisés)
    currentApp?: string;       // App active (optionnel)
    time?: string;             // Heure locale
  };
  settings?: {
    language: 'fr' | 'en';
    verbosity: 'concise' | 'normal';
  };
}

interface ChatResponse {
  text: string;              // Réponse textuelle
  actions?: Action[];        // Actions à exécuter localement
  shouldSpeak: boolean;      // Doit être vocalisé
}

interface Action {
  type: 'open_app' | 'create_reminder' | 'send_message' | 'deep_link';
  params: Record<string, any>;
}
```

---

## 5. Architecture V1.1 — Screen Recording & Mac

### 5.1 Screen Recording Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCREEN RECORDING PIPELINE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ ReplayKit│───►│ Compress │───►│ Encrypt  │───►│  Send    │  │
│  │ (Capture)│    │ (HEVC)   │    │ (E2E)    │    │ (HTTPS)  │  │
│  └──────────┘    └──────────┘    └──────────┘    └────┬─────┘  │
│                                                       │         │
│                              ┌────────────────────────┘         │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    CLOUD GPU (TEE Enclave)                  ││
│  │                                                             ││
│  │  ┌──────────┐    ┌──────────┐    ┌──────────┐             ││
│  │  │ Decrypt  │───►│   OCR    │───►│ Extract  │             ││
│  │  │          │    │ (Vision) │    │  Text    │             ││
│  │  └──────────┘    └──────────┘    └────┬─────┘             ││
│  │                                       │                    ││
│  │                                       ▼                    ││
│  │                               ┌──────────┐                 ││
│  │                               │  DELETE  │ ◄── IMMÉDIAT   ││
│  │                               │  FRAMES  │                 ││
│  │                               └──────────┘                 ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                  │
│  │ Receive  │◄───│ Encrypt  │◄───│   LLM    │                  │
│  │  (iOS)   │    │ Response │    │ Analysis │                  │
│  └──────────┘    └──────────┘    └──────────┘                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Mac Companion Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      MAC COMPANION APP                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Automation Layer                         ││
│  │                                                             ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        ││
│  │  │ AppleScript │  │ Accessibility│  │  Browser    │        ││
│  │  │  Engine     │  │    API      │  │ Automation  │        ││
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        ││
│  │         │                │                │                ││
│  │         ▼                ▼                ▼                ││
│  │  ┌─────────────────────────────────────────────────┐      ││
│  │  │              App Controllers                    │      ││
│  │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐        │      ││
│  │  │  │Messages │  │WhatsApp │  │Messenger│        │      ││
│  │  │  │   .app  │  │  Web    │  │   Web   │        │      ││
│  │  │  └─────────┘  └─────────┘  └─────────┘        │      ││
│  │  └─────────────────────────────────────────────────┘      ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Sync Layer (Local WiFi)                  ││
│  │                                                             ││
│  │  ┌─────────────┐              ┌─────────────┐              ││
│  │  │   Bonjour   │◄────────────►│   iPhone    │              ││
│  │  │  Discovery  │    TLS       │    Diva     │              ││
│  │  └─────────────┘              └─────────────┘              ││
│  │                                                             ││
│  │  Protocol: Custom TCP + TLS 1.3                            ││
│  │  Discovery: _diva._tcp.local                               ││
│  │  Auth: QR code pairing + device certificate                ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Security Layer                           ││
│  │                                                             ││
│  │  • Touch ID / Password required for activation              ││
│  │  • Auto-lock after 5 min inactivity                        ││
│  │  • No data persistence (RAM only)                          ││
│  │  • Secure enclave for pairing keys                         ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Protocole de synchronisation Mac ↔ iPhone

```
┌─────────┐                                    ┌─────────┐
│  iPhone │                                    │   Mac   │
└────┬────┘                                    └────┬────┘
     │                                              │
     │  1. Bonjour Discovery                        │
     │  ◄──────────────────────────────────────────►│
     │                                              │
     │  2. TLS Handshake + Cert Verification        │
     │  ◄──────────────────────────────────────────►│
     │                                              │
     │  3. QR Code Pairing (first time)             │
     │  ────────────────────────────────────────────►│
     │                                              │
     │  4. Pairing Confirmation                     │
     │  ◄────────────────────────────────────────────│
     │                                              │
     │  5. Command: "Read WhatsApp from Julie"      │
     │  ────────────────────────────────────────────►│
     │                                              │
     │  6. Mac opens WhatsApp, reads messages       │
     │                                              │
     │  7. Response: [messages array]               │
     │  ◄────────────────────────────────────────────│
     │                                              │
```

---

## 6. Flux de communication

### 6.1 Flux MVP — Commande vocale simple

```
┌──────┐      ┌─────────┐      ┌────────┐      ┌───────┐
│ User │      │ iPhone  │      │ Triage │      │ Piper │
└──┬───┘      └────┬────┘      └───┬────┘      └───┬───┘
   │               │               │               │
   │  "Rappelle-   │               │               │
   │   moi dans    │               │               │
   │   10 min"     │               │               │
   │──────────────►│               │               │
   │               │               │               │
   │               │  Whisper STT  │               │
   │               │──────────────►│               │
   │               │               │               │
   │               │               │  tier=1       │
   │               │               │  (local)      │
   │               │◄──────────────│               │
   │               │               │               │
   │               │  Create       │               │
   │               │  Reminder     │               │
   │               │  (iOS API)    │               │
   │               │               │               │
   │               │  "D'accord"   │               │
   │               │──────────────────────────────►│
   │               │               │               │
   │  Audio        │               │               │
   │◄──────────────│               │               │
   │               │               │               │
```

### 6.2 Flux MVP — Requête cloud

```
┌──────┐      ┌─────────┐      ┌────────┐      ┌───────┐      ┌───────┐
│ User │      │ iPhone  │      │ Triage │      │ Cloud │      │Claude │
└──┬───┘      └────┬────┘      └───┬────┘      └───┬───┘      └───┬───┘
   │               │               │               │               │
   │  "Explique-   │               │               │               │
   │   moi la      │               │               │               │
   │   relativité" │               │               │               │
   │──────────────►│               │               │               │
   │               │               │               │               │
   │               │  Whisper STT  │               │               │
   │               │──────────────►│               │               │
   │               │               │               │               │
   │               │               │  tier=2       │               │
   │               │               │  (cloud)      │               │
   │               │               │               │               │
   │               │  E2E Request  │               │               │
   │               │──────────────────────────────►│               │
   │               │               │               │               │
   │               │               │               │  API Call     │
   │               │               │               │──────────────►│
   │               │               │               │               │
   │               │               │               │  Response     │
   │               │               │               │◄──────────────│
   │               │               │               │               │
   │               │  E2E Response │               │               │
   │               │◄──────────────────────────────│               │
   │               │               │               │               │
   │  Audio (TTS)  │               │               │               │
   │◄──────────────│               │               │               │
```

### 6.3 Flux V1.1 — Screen Recording

```
┌──────┐      ┌─────────┐      ┌────────┐      ┌─────────┐
│ User │      │ iPhone  │      │  GPU   │      │  LLM    │
└──┬───┘      └────┬────┘      └───┬────┘      └────┬────┘
   │               │               │                │
   │  "Résume ce   │               │                │
   │   qui est à   │               │                │
   │   l'écran"    │               │                │
   │──────────────►│               │                │
   │               │               │                │
   │               │  Start        │                │
   │               │  ReplayKit    │                │
   │               │               │                │
   │               │  Frames E2E   │                │
   │               │──────────────►│                │
   │               │               │                │
   │               │               │  OCR in TEE   │
   │               │               │────────────────│
   │               │               │                │
   │               │               │  Text          │
   │               │               │───────────────►│
   │               │               │                │
   │               │               │  DELETE FRAMES │
   │               │               │ (immediately)  │
   │               │               │                │
   │               │               │  Analysis      │
   │               │◄──────────────────────────────│
   │               │               │                │
   │  Audio        │               │                │
   │◄──────────────│               │                │
```

---

## 7. Schémas de données

### 7.1 Données locales (SQLite)

```sql
-- Contexte de conversation (TTL 24h)
CREATE TABLE conversation_context (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,           -- 'user' | 'assistant'
    content TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    expires_at INTEGER NOT NULL   -- Auto-delete après 24h
);

-- Notifications capturées (TTL session)
CREATE TABLE captured_notifications (
    id TEXT PRIMARY KEY,
    app_bundle_id TEXT NOT NULL,  -- com.whatsapp.WhatsApp
    sender TEXT,
    content TEXT,
    timestamp INTEGER NOT NULL,
    read INTEGER DEFAULT 0
);

-- Préférences utilisateur
CREATE TABLE user_preferences (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Pas de stockage d'audio, pas de logs vocaux
```

### 7.2 Données cloud (en mémoire uniquement)

```typescript
// Session en mémoire (Map<sessionId, Session>)
interface Session {
  userId: string;
  context: Message[];      // Derniers 10 messages max
  createdAt: Date;
  expiresAt: Date;         // TTL 24h
}

// Aucune base de données persistante
// Aucun log de contenu
// Seuls logs : métriques anonymisées (latence, erreurs)
```

### 7.3 Données Mac (RAM uniquement)

```swift
// Aucune persistence
// Données transitent en RAM uniquement

struct MacSession {
    let pairedDeviceId: String
    let pairingKey: Data        // Stocké dans Secure Enclave
    var lastActivity: Date
}

// Messages lus = transmis immédiatement, jamais stockés
```

---

## 8. Sécurité

### 8.1 Chiffrement

| Donnée | En transit | Au repos |
|--------|------------|----------|
| Requêtes API | TLS 1.3 + E2E | N/A (pas stocké) |
| Screen frames | TLS 1.3 + E2E (AES-256-GCM) | N/A (détruit immédiatement) |
| Sync Mac-iPhone | TLS 1.3 local | N/A (RAM only) |
| SQLite local | N/A | SQLCipher (AES-256) |
| Keychain | N/A | iOS Secure Enclave |

### 8.2 Clés et secrets

```
┌─────────────────────────────────────────────────────────────────┐
│                        KEY HIERARCHY                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    iOS Secure Enclave                       ││
│  │                                                             ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        ││
│  │  │ Device Key  │  │ Pairing Key │  │ E2E Master  │        ││
│  │  │ (hardware)  │  │ (Mac sync)  │  │ (cloud)     │        ││
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        ││
│  │         │                │                │                ││
│  └─────────┼────────────────┼────────────────┼────────────────┘│
│            │                │                │                  │
│            ▼                ▼                ▼                  │
│     ┌──────────┐     ┌──────────┐     ┌──────────┐            │
│     │ SQLite   │     │ Mac TLS  │     │ Cloud    │            │
│     │ Encrypt  │     │ Session  │     │ E2E      │            │
│     └──────────┘     └──────────┘     └──────────┘            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.3 Authentification

```
┌─────────────────────────────────────────────────────────────────┐
│                        AUTH FLOW                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Registration                                                 │
│     ┌────────┐                      ┌────────┐                  │
│     │ Client │ ────email/pass─────► │ Server │                  │
│     │        │ ◄──access+refresh─── │        │                  │
│     └────────┘                      └────────┘                  │
│                                                                  │
│  2. API Request                                                  │
│     ┌────────┐                      ┌────────┐                  │
│     │ Client │ ──JWT (15min TTL)──► │ Server │                  │
│     │        │ ◄────response─────── │        │                  │
│     └────────┘                      └────────┘                  │
│                                                                  │
│  3. Token Refresh                                                │
│     ┌────────┐                      ┌────────┐                  │
│     │ Client │ ──refresh (7d TTL)─► │ Server │                  │
│     │        │ ◄──new access+ref─── │        │                  │
│     └────────┘                      └────────┘                  │
│                                                                  │
│  JWT Claims:                                                     │
│  {                                                               │
│    "sub": "user_id",                                            │
│    "iat": timestamp,                                            │
│    "exp": timestamp + 15min,                                    │
│    "scope": ["chat", "ocr"]                                     │
│  }                                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.4 TEE (Trusted Execution Environment) pour OCR

```
┌─────────────────────────────────────────────────────────────────┐
│                    TEE ENCLAVE (OCR)                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    SECURE BOUNDARY                        │  │
│  │                                                           │  │
│  │   • Code attesté (hash vérifié)                          │  │
│  │   • Mémoire isolée (inaccessible depuis l'hôte)         │  │
│  │   • Clés de déchiffrement uniquement dans l'enclave     │  │
│  │   • Pas de persistance (RAM cleared on exit)            │  │
│  │                                                           │  │
│  │   ┌─────────┐   ┌─────────┐   ┌─────────┐               │  │
│  │   │Decrypt  │──►│  OCR    │──►│ Encrypt │               │  │
│  │   │ Frame   │   │ Process │   │ Result  │               │  │
│  │   └─────────┘   └─────────┘   └─────────┘               │  │
│  │                      │                                    │  │
│  │                      ▼                                    │  │
│  │                ┌───────────┐                             │  │
│  │                │  DELETE   │                             │  │
│  │                │  (secure) │                             │  │
│  │                └───────────┘                             │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Garanties:                                                      │
│  • L'opérateur cloud ne peut pas voir les frames                │
│  • Seul le code attesté peut accéder aux données               │
│  • Audit trail via attestation reports                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Performance & Latence

### 9.1 Objectifs

| Métrique | Cible | Priorité |
|----------|-------|----------|
| STT latency (Whisper) | < 500ms | P0 |
| Triage decision | < 100ms | P0 |
| TTS latency (Piper) | < 300ms | P0 |
| Cloud round-trip | < 2s | P1 |
| Screen OCR | < 3s | P2 |
| End-to-end (local) | < 1.5s | P0 |
| End-to-end (cloud) | < 4s | P1 |

### 9.2 Optimisations

| Technique | Gain | Appliqué à |
|-----------|------|------------|
| Core ML (ANE) | 3-5x | Whisper, LLM triage |
| Quantization (INT8) | 2-4x, -75% RAM | Tous les modèles |
| Streaming STT | -300ms perçu | Whisper |
| Streaming TTS | -200ms perçu | Piper |
| Connection pooling | -100ms | Cloud API |
| Frame compression | -50% bandwidth | Screen recording |

### 9.3 Budgets mémoire

| Composant | RAM | Stockage |
|-----------|-----|----------|
| Whisper tiny | ~150MB | ~40MB |
| Qwen-0.5B (Q4) | ~400MB | ~300MB |
| Piper | ~50MB | ~20MB |
| App overhead | ~100MB | ~50MB |
| **Total** | **~700MB** | **~410MB** |

---

## 10. ADRs (Architecture Decision Records)

### ADR-001: Local-first architecture

**Status**: Accepted
**Date**: 2026-03-04

**Context**: Diva doit être privacy-first tout en offrant des capacités IA avancées.

**Decision**: Architecture 2-tiers avec traitement local par défaut (80%) et cloud uniquement pour les requêtes complexes (20%).

**Consequences**:
- (+) Privacy maximale
- (+) Fonctionne offline
- (+) Latence réduite pour cas simples
- (-) Capacités limitées en local
- (-) Taille de l'app plus importante (~500MB)

---

### ADR-002: Whisper + Piper pour STT/TTS locaux

**Status**: Accepted
**Date**: 2026-03-04

**Context**: Besoin de STT/TTS performants fonctionnant 100% offline sur iOS.

**Decision**: Whisper.cpp (tiny/base) pour STT, Piper pour TTS.

**Alternatives considérées**:
- Apple Speech: Moins précis, pas de contrôle
- Cloud STT/TTS: Viole le principe privacy-first

**Consequences**:
- (+) 100% offline
- (+) Qualité acceptable
- (+) Modèles optimisés pour mobile
- (-) ~60MB de modèles supplémentaires

---

### ADR-003: Qwen-0.5B pour triage local

**Status**: Accepted
**Date**: 2026-03-04

**Context**: Besoin d'un LLM capable de classifier les intentions et répondre aux requêtes simples.

**Decision**: Qwen2.5-0.5B quantifié (INT4/INT8) via llama.cpp.

**Alternatives considérées**:
- Phi-3 mini (3.8B): Trop lourd pour mobile
- TinyLlama (1.1B): Moins performant
- Règles statiques: Trop rigides

**Consequences**:
- (+) Bon compromis taille/performance
- (+) Multilingue (FR/EN)
- (+) ~300MB quantifié
- (-) Capacités limitées vs cloud LLM

---

### ADR-004: Zero-persistence cloud

**Status**: Accepted
**Date**: 2026-03-04

**Context**: Conformité RGPD et confiance utilisateur.

**Decision**: Aucune donnée persistée côté cloud. Sessions en mémoire avec TTL 24h.

**Consequences**:
- (+) RGPD compliant
- (+) Pas de risque de fuite de données stockées
- (-) Pas d'historique cross-device
- (-) Perte de contexte après 24h

---

### ADR-005: NotificationServiceExtension pour accès messages

**Status**: Accepted
**Date**: 2026-03-04

**Context**: iOS ne permet pas l'accès direct aux messages des autres apps.

**Decision**: Utiliser NotificationServiceExtension pour intercepter les notifications entrantes.

**Limitations**:
- Accès uniquement aux NOUVEAUX messages
- Pas d'accès à l'historique

**Mitigation**: Screen recording (V1.1) + Mac companion pour accès complet.

---

### ADR-006: Screen Recording via ReplayKit (V1.1)

**Status**: Accepted
**Date**: 2026-03-04

**Context**: Besoin d'accéder au contenu visuel de n'importe quelle app.

**Decision**: Utiliser ReplayKit pour capture écran + OCR cloud dans TEE.

**Risks**:
- Capture de données sensibles (mots de passe, etc.)
- Transmission de frames au cloud

**Mitigations**:
- Indicateur visuel permanent
- Consentement explicite séparé
- TEE pour OCR (opérateur n'a pas accès)
- Zero persistence des frames

---

### ADR-007: Mac Companion via Bonjour + TLS (V1.1)

**Status**: Accepted
**Date**: 2026-03-04

**Context**: Pour atteindre 100% des use cases, besoin d'automation sur macOS.

**Decision**: App Mac native communiquant avec iPhone via Bonjour (mDNS) + TLS local.

**Consequences**:
- (+) Accès complet aux messages (Messages.app, WhatsApp Web, etc.)
- (+) Aucune donnée ne quitte le réseau local
- (-) Nécessite un Mac
- (-) Deux apps à maintenir

---

## Annexes

### A. Glossaire

| Terme | Définition |
|-------|------------|
| STT | Speech-to-Text (reconnaissance vocale) |
| TTS | Text-to-Speech (synthèse vocale) |
| TEE | Trusted Execution Environment (enclave sécurisée) |
| E2E | End-to-End (chiffrement de bout en bout) |
| ANE | Apple Neural Engine (accélérateur ML) |
| RGPD | Règlement Général sur la Protection des Données |

### B. Références

- [Whisper.cpp](https://github.com/ggerganov/whisper.cpp)
- [Piper TTS](https://github.com/rhasspy/piper)
- [llama.cpp](https://github.com/ggerganov/llama.cpp)
- [Apple ReplayKit](https://developer.apple.com/documentation/replaykit)
- [Anthropic Claude API](https://docs.anthropic.com)

---

*Document généré par Winston (Architecte BMAD) — 2026-03-04*
