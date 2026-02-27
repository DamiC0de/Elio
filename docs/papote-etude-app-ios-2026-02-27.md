# Papote — Étude App iOS : Coûts, Architecture & Capacités

**Analyste :** Mary (BMAD)
**Date :** 27 février 2026
**Demandé par :** Georges
**Canal :** #📊・études

---

## 1. 🎯 Contexte

Étude de faisabilité pour déployer Papote en tant qu'**application mobile iOS** (au lieu de / en complément du hardware Orange Pi). L'objectif est d'évaluer les coûts d'infrastructure VPS, les capacités techniques sur iOS, et la viabilité financière avec un abonnement à **14,99€/mois**.

---

## 2. 🏗️ Architecture optimale retenue

### Stack technique

| Composant | Solution | Coût |
|-----------|----------|------|
| **LLM (cerveau)** | API Claude Haiku + prompt caching | Variable (API) |
| **STT** | faster-whisper-small (CPU, self-hosted) | Inclus VPS |
| **TTS** | Piper ONNX (CPU, self-hosted) | Inclus VPS |
| **VPS** | Hetzner AX102 (Ryzen 9 7950X3D, 128Go RAM) | ~79€/unité |
| **BDD / Auth** | Supabase (free tier → pro) | 0-25€/mois |
| **App mobile** | React Native + Expo | 0€ |

### Pourquoi cette stack ?

- **Pas de GPU nécessaire** : Piper et faster-whisper-small tournent en CPU pur, ultra légers
- **Claude Haiku** : modèle le moins cher d'Anthropic, suffisant pour un assistant conversationnel
- **Prompt caching** : réduit le coût API de 50-70% (cache reads = 10% du prix base)

---

## 3. 💰 Projection financière

### Hypothèses d'usage

- **Usage intensif** : ~200 interactions vocales/jour/utilisateur (vrai assistant permanent)
- Chaque interaction : ~500 tokens input + ~300 tokens output
- Concurrence en pointe : ~10-15% d'utilisateurs simultanés

### Coûts mensuels par palier

| Poste | 100 users | 1 000 users | 5 000 users | 10 000 users |
|-------|-----------|-------------|-------------|--------------|
| API Claude (avec caching) | ~230€ | ~2 300€ | ~11 500€ | ~23 000€ |
| VPS (STT+TTS) | ~79€ | ~316€ | ~1 500€ | ~3 000€ |
| Infra annexe | ~50€ | ~100€ | ~500€ | ~1 000€ |
| **Total** | **~360€** | **~2 716€** | **~13 500€** | **~27 000€** |

### Revenus et marges (abo 14,99€/mois)

| Users | Revenus/mois | Coûts/mois | Marge brute | Marge % |
|-------|-------------|------------|-------------|---------|
| 100 | 1 499€ | ~360€ | **+1 139€** | 76% |
| 500 | 7 495€ | ~1 600€ | **+5 895€** | 79% |
| 1 000 | 14 990€ | ~2 716€ | **+12 274€** | 82% |
| 5 000 | 74 950€ | ~13 500€ | **+61 450€** | 82% |
| 10 000 | 149 900€ | ~27 000€ | **+122 900€** | 82% |

### Seuil de rentabilité : ~24 utilisateurs payants

---

## 4. 🚀 Stratégie de lancement progressif

### Phase 0 — Beta privée (Mois 1-3)
- **Objectif** : 10-50 testeurs, valider le produit
- **Infra** : 1 seul VPS Hetzner AX52 (49€/mois)
- **Coût total** : ~100€/mois
- **Investissement initial** : ~540€

| Élément | Montant |
|---------|---------|
| 3 mois VPS beta | 300€ |
| Domaine | 15€ |
| Apple Developer (1 an) | 99€ |
| Google Play | 25€ |
| Crédit API Claude | 100€ |
| **Total** | **~540€** |

### Phase 1 — Lancement public (Mois 4-6)
- **Objectif** : 50-200 utilisateurs payants
- **Coût** : ~520€/mois
- **Revenus estimés** : 1 499€/mois (100 users) → **+979€ marge**

### Phase 2 — Croissance (Mois 7-12)
- **Objectif** : 500-1 000 users
- **Coût** : ~2 400€/mois (incluant marketing)
- **Revenus estimés** : 11 243€/mois (750 users) → **+8 843€ marge**

### Phase 3 — Scale (Année 2)
- **Objectif** : 5 000+ users
- **Coût** : ~17 000€/mois (incluant 1 dev + 1 support freelance + marketing)
- **Revenus** : 74 950€/mois → **+57 950€ marge**

### Timeline vers la rentabilité

| Mois | Users | Revenus | Coûts | Résultat |
|------|-------|---------|-------|----------|
| M1-M3 | 0 (beta) | 0€ | 100€/mois | -300€ |
| M4 | 30 | 450€ | 200€ | **+250€ ✅** |
| M6 | 100 | 1 499€ | 520€ | +979€ |
| M9 | 400 | 5 996€ | 1 500€ | +4 496€ |
| M12 | 1 000 | 14 990€ | 2 716€ | +12 274€ |

---

## 5. 📱 Capacités iOS — Ce que Papote peut faire

### Intégrations natives (100% automatique, 0 tap)

| Service | Lire | Écrire/Envoyer | API utilisée |
|---------|------|---------------|--------------|
| **Gmail** | ✅ | ✅ | Gmail API (OAuth2) |
| **Outlook** | ✅ | ✅ | Microsoft Graph (OAuth2) |
| **IMAP générique** | ✅ | ✅ | IMAP/SMTP |
| **Google Calendar** | ✅ | ✅ | Calendar API (OAuth2) |
| **Outlook Calendar** | ✅ | ✅ | Microsoft Graph |
| **Telegram** | ✅ | ✅ | TDLib |
| **Contacts** | ✅ | — | Contacts Framework |
| **Rappels / Timers** | ✅ | ✅ | UserNotifications |
| **Domotique** | ✅ | ✅ | HomeKit + HTTP direct |
| **Musique (Spotify)** | ✅ | ✅ | Spotify iOS SDK |
| **Musique (Apple Music)** | ✅ | ✅ | MusicKit |
| **Localisation** | ✅ | — | CoreLocation |
| **Navigation** | — | ✅ | Deep link Maps/Waze |

### Lancement d'applications tierces (URL Schemes)

Papote peut **ouvrir instantanément** n'importe quelle app et même naviguer vers une page précise :

| App | Action possible | Exemple |
|-----|----------------|---------|
| YouTube | Ouvrir + recherche | `youtube://results?search_query=jazz` |
| Spotify | Ouvrir + jouer | `spotify:search:jazz` |
| Google Maps | Navigation | `comgooglemaps://?daddr=Paris` |
| Instagram | Profil | `instagram://user?username=xxx` |
| WhatsApp | Ouvrir un chat | `whatsapp://send?phone=xxx` |
| Netflix, TikTok, Twitter... | Ouvrir | URL schemes respectifs |

→ **Instantané, invisible, 0 popup** ✅

### Interactions limitées (nécessitent confirmation user)

| Action | Méthode | Interaction user |
|--------|---------|-----------------|
| **Appel téléphonique** | `tel://` URL scheme | 1 tap "Appeler" |
| **Envoyer un SMS** | MFMessageComposeViewController | 1 tap "Envoyer" |
| **Envoyer un WhatsApp** | Deep link + clavier custom Papote | 1-2 taps |
| **Envoyer un iMessage** | MFMessageComposeViewController | 1 tap "Envoyer" |

### Services NON accessibles sur iOS

| Service | Raison | Alternative |
|---------|--------|-------------|
| **WhatsApp (lecture)** | Pas d'API, sandbox iOS | Share Extension + clavier custom |
| **iMessage/SMS (lecture)** | Bloqué par Apple | Share Extension |
| **Messenger (lecture)** | Pas d'API publique | Share Extension |
| **Instagram DM** | Pas d'API | Share Extension |
| **Signal** | Chiffrement E2E, aucune API | Aucune |
| **Notifications d'autres apps** | Réservé au système | — |
| **Contrôle d'apps** (taper, scroller) | Sandbox iOS | Clavier custom |

### Le clavier intelligent Papote (killer feature)

Un clavier tiers iOS avec "Accès complet" qui permet :
- Dicter vocalement → Papote rédige/reformule
- Fonctionne **dans toutes les apps** (WhatsApp, iMessage, Mail, etc.)
- 100% autorisé par Apple ✅
- Compense l'impossibilité d'envoyer des messages automatiquement

---

## 6. 🆚 Comparaison App iOS vs Orange Pi

| Critère | App iOS | Orange Pi |
|---------|---------|-----------|
| **Coût serveur** | 2 700€/mois (1K users) | 0€ |
| **Coût hardware user** | 0€ | ~250€ (payé par l'user) |
| **Restrictions** | Sandbox Apple stricte | Aucune restriction |
| **Contrôle apps** | Limité (URL schemes) | Contrôle total du device |
| **Messages** | Limité (pas WhatsApp auto) | Peut tout intercepter |
| **Latence** | +50-200ms réseau | Ultra-faible (local) |
| **Vie privée** | Données via serveur | 100% local |
| **Facilité d'adoption** | Très facile (télécharger l'app) | Acheter + configurer hardware |
| **Marché cible** | Grand public | Tech-savvy / privacy-conscious |

---

## 7. 💡 Recommandations

1. **Modèle hybride** : App iOS pour le grand public + Orange Pi pour les power users
2. **Focus iOS d'abord** : marché plus large, adoption plus facile, rentabilité plus rapide
3. **Killer features iOS** : emails + calendrier + Telegram + domotique + musique + clavier intelligent
4. **Démarrer lean** : 1 seul VPS, ~540€ d'investissement initial, rentable dès ~24 users
5. **Marge confortable** : 80%+ à partir de 500 users à 14,99€/mois
6. **Le coût principal c'est l'API Claude** (~87%) — baisses de prix du marché = marge qui augmente

---

*Document généré le 27 février 2026 — Mary, Analyste BMAD*
