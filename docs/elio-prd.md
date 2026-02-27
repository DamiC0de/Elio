# Elio — Product Requirements Document (PRD)

**PM :** John (BMAD)
**Version :** 1.0 — Draft
**Date :** 27 février 2026
**Statut :** En review

---

## 1. 🎯 Vision & Positionnement

### Vision

> **Elio est un compagnon IA vocal qui vit dans ton téléphone, comprend tout, et agit pour toi.**

Elio n'est pas un chatbot. Ce n'est pas un assistant vocal limité comme Siri. C'est un vrai compagnon intelligent qui contrôle ton téléphone, gère ta vie numérique, et converse naturellement sur tous les sujets.

### Positionnement marché

| | Siri | ChatGPT Voice | Gemini Live | **Elio** |
|---|---|---|---|---|
| Conversation naturelle | ❌ Limité | ✅ | ✅ | ✅ |
| Contrôle du téléphone | ✅ (basique) | ❌ | ❌ | ✅ |
| Intégrations (email, agenda) | ⚠️ Apple only | ❌ | ⚠️ Google only | ✅ Multi-provider |
| Domotique | ⚠️ HomeKit only | ❌ | ⚠️ Google Home | ✅ HomeKit + WiFi |
| Musique | Apple Music | ❌ | YouTube Music | ✅ Spotify + Apple Music |
| Mémoire contextuelle | ❌ | ⚠️ Limité | ⚠️ Limité | ✅ Mémoire longue terme |
| Clavier intelligent | ❌ | ❌ | ❌ | ✅ |
| Recherche approfondie | ❌ | ✅ | ✅ | ✅ |

**Différenciateur clé** : Elio combine conversation IA de niveau Claude + contrôle du téléphone + intégrations multi-provider. Aucun concurrent ne fait les trois.

### Pitch (une phrase)

*"Hey Elio" — Ton compagnon IA qui comprend tout et contrôle ton téléphone.*

---

## 2. 👥 Personas & Use Cases

### Persona 1 — Sophie, 28 ans, Cheffe de projet
- **Profil** : Active, toujours en réunion, 3 apps de messagerie, 2 boîtes mail
- **Pain point** : Noyée sous les emails et notifications, pas le temps de tout gérer
- **Usage clé** : Résumé de mails, gestion agenda, réponses vocales aux emails
- **Fréquence** : 150-200 interactions/jour

### Persona 2 — Marc, 45 ans, Artisan plombier
- **Profil** : Pas très tech, mains souvent occupées/sales, iPhone basique
- **Pain point** : Taper sur un écran est compliqué sur le terrain
- **Usage clé** : Appels mains libres, notes vocales, clavier intelligent dans WhatsApp
- **Fréquence** : 50-80 interactions/jour

### Persona 3 — Léa, 22 ans, Étudiante
- **Profil** : Digital native, budget serré, adore la tech
- **Pain point** : Besoin d'aide pour les cours, rédaction, organisation
- **Usage clé** : Recherches, rédaction assistée, musique, rappels
- **Fréquence** : 100-150 interactions/jour

### Persona 4 — Pierre, 72 ans, Retraité veuf
- **Profil** : Seul depuis 2 ans, enfants loin, pas à l'aise avec la tech
- **Pain point** : Solitude, besoin de quelqu'un à qui parler au quotidien
- **Usage clé** : Conversation, compagnie, rappels bienveillants, lien avec la famille
- **Fréquence** : 50-100 interactions/jour, conversations longues

### Persona 5 — Amina, 19 ans, Étudiante loin de chez elle
- **Profil** : Première année de fac à 500km de sa famille, se sent seule le soir
- **Pain point** : Isolement, besoin d'écoute et de soutien au quotidien
- **Usage clé** : Conversation empathique, aide aux devoirs, musique, divertissement
- **Fréquence** : 80-120 interactions/jour, surtout le soir

### Persona 6 — Monique, 78 ans, Alzheimer stade léger
- **Profil** : Diagnostic depuis 1 an, vit seule, fille à 1h de route
- **Pain point** : Oublis quotidiens, isolement, famille inquiète
- **Usage clé** : Rappels médicaments, ancrage mémoriel (photos, prénoms), alertes proches, compagnie
- **Fréquence** : 30-60 interactions/jour (dont beaucoup initiées par Elio)

### Persona 7 — Nathalie, 52 ans, Aidante familiale
- **Profil** : Fille de Monique, travaille à temps plein, culpabilise
- **Pain point** : Pas assez présente, inquiète pour sa mère
- **Usage clé** : Dashboard aidant (état quotidien, alertes), communication facilitée avec sa mère via Elio
- **Fréquence** : Consultation dashboard 2-3x/jour + messages vocaux

### Note : Le use case "compagnon" et "santé"

Le marché de la compagnie IA est gigantesque : 15 millions de personnes seules en France, 5 millions de personnes âgées isolées, 1,2 million de personnes avec Alzheimer, 11 millions d'aidants familiaux. Elio se différencie des apps de compagnon IA (Replika, Character.ai) car il combine conversation empathique + actions concrètes (mails, appels, domotique, alertes proches). Ce n'est pas juste un chatbot, c'est un compagnon qui **fait** des choses pour toi.

**⚠️ Cadre légal santé** : Elio n'est PAS un dispositif médical. Pas de diagnostic. Données de santé = HDS obligatoire en France. Stratégie : compagnon bienveillant d'abord, partenariats santé (France Alzheimer) en v2, certification HDS en v3 si nécessaire.

---

## 3. 🔧 Spécifications fonctionnelles

### 3.1 Interaction vocale

| Spec | Détail |
|------|--------|
| **Wake word** | "Hey Elio" (personnalisable) |
| **Technologie wake word** | Porcupine (Picovoice) — on-device |
| **STT** | faster-whisper-small (self-hosted CPU) |
| **TTS** | Piper ONNX (self-hosted CPU) |
| **LLM** | Claude Haiku (API Anthropic) + prompt caching |
| **Latence cible** | <2s entre fin de parole et début de réponse |
| **Langue MVP** | Français |
| **Mode écoute** | Always-on / Smart / Manuel (paramétrable) |

### 3.2 Personnalité & Ton

| Paramètre | Par défaut | Personnalisable |
|-----------|-----------|----------------|
| **Ton** | Amical, décontracté | Amical / Neutre / Professionnel |
| **Tutoiement** | Oui | Oui / Non |
| **Verbosité** | Normal | Concis / Normal / Détaillé |
| **Humour** | Léger | On / Off |
| **Voix** | À définir | 3-4 voix au choix |
| **Nom** | Elio | Possibilité de personnaliser le wake word |

### 3.3 Intégrations natives (100% automatique)

| Service | Lire | Écrire | API |
|---------|------|--------|-----|
| **Gmail** | ✅ | ✅ | Gmail API (OAuth2) |
| **Outlook** | ✅ | ✅ | Microsoft Graph (OAuth2) |
| **IMAP générique** | ✅ | ✅ | IMAP/SMTP |
| **Google Calendar** | ✅ | ✅ | Calendar API (OAuth2) |
| **Outlook Calendar** | ✅ | ✅ | Microsoft Graph |
| **Telegram** | ✅ | ✅ | TDLib |
| **Contacts** | ✅ | — | Contacts Framework |
| **Rappels / Timers** | ✅ | ✅ | UserNotifications |
| **Domotique** | ✅ | ✅ | HomeKit + HTTP (Tuya, Shelly) |
| **Spotify** | ✅ | ✅ | Spotify iOS SDK |
| **Apple Music** | ✅ | ✅ | MusicKit |
| **Localisation** | ✅ | — | CoreLocation |
| **Navigation** | — | ✅ | Deep link Maps/Waze/Google Maps |

### 3.4 Lancement d'applications (URL Schemes)

Elio peut ouvrir instantanément n'importe quelle app installée et naviguer vers une page précise :
- YouTube (recherche), Spotify (playlist), Google Maps (navigation)
- Instagram (profil), WhatsApp (chat), Netflix, TikTok, Twitter/X...
- Instantané, invisible, 0 popup

### 3.5 Actions avec confirmation utilisateur (1 tap)

| Action | Méthode | UX |
|--------|---------|-----|
| Appel téléphonique | `tel://` URL scheme | 1 tap "Appeler" |
| Envoyer un SMS/iMessage | MFMessageComposeViewController | 1 tap "Envoyer" |

### 3.6 Clavier intelligent Elio

**Killer feature** pour compenser les limites iOS sur la messagerie.

- Clavier tiers iOS avec "Accès complet"
- Fonctionne dans **toutes les apps** (WhatsApp, iMessage, Mail, Messenger...)
- L'utilisateur dicte → Elio comprend le contexte et rédige/reformule
- Modes : Dictée simple / Rédaction assistée / Reformulation / Traduction
- 100% autorisé par Apple ✅

### 3.7 Mémoire & Contexte

| Spec | Détail |
|------|--------|
| **Stockage** | Supabase + pgvector |
| **Types de mémoire** | Préférences, faits, conversations, rappels |
| **Recherche** | Sémantique (embeddings vectoriels) |
| **Extraction auto** | Après chaque conversation, Elio extrait les faits importants |
| **Rétention** | Configurable par l'utilisateur (effacer, consulter, exporter) |
| **Privacy** | Possibilité de désactiver la mémoire |

### 3.8 Mode Compagnon & Sécurité émotionnelle

| Spec | Détail |
|------|--------|
| **Empathie** | Elio adapte son ton en détectant l'état émotionnel |
| **Écoute active** | Reformulation, questions ouvertes, encouragements |
| **Mémoire affective** | Se souvient des proches, des événements importants |
| **Détection de détresse** | Si l'utilisateur exprime une détresse → suggestion bienveillante de ressources (3114, SOS Amitié) sans être intrusif |
| **Rappels bienveillants** (v2) | "Ça fait quelques jours que t'as pas appelé ta fille, ça te dit ?" (optionnel) |

### 3.9 Recherche & Conversation IA

- Conversation naturelle sur tous les sujets (propulsé par Claude)
- Recherche web approfondie sur demande
- Résumé de pages web, articles, documents
- Brainstorming, aide à la rédaction, traduction
- Calculs, conversions, infos pratiques (météo, actus)

---

## 4. 📱 App Companion & UX

### 4.1 Onboarding (3 minutes)

| Étape | Écran | Action |
|-------|-------|--------|
| 1 | Bienvenue | Elio se présente vocalement |
| 2 | Connexion services | OAuth Gmail, Calendar, Telegram (2 clics chacun) |
| 3 | Choix de voix | L'user teste 3-4 voix |
| 4 | Premier essai | "Dis Hey Elio, qu'est-ce que tu sais faire ?" |

### 4.2 Interface principale

- **Écran principal** : Bouton push-to-talk central + historique conversations
- **Barre de statut** : Indicateur d'écoute (wake word actif)
- **Settings** : Services connectés, personnalité, voix, mémoire, wake word
- **Widget iOS** : Accès rapide depuis l'écran d'accueil
- **Live Activities** : Infos en temps réel (prochaine réunion, météo)

---

## 5. 🏗️ Architecture technique

### Stack

| Composant | Solution |
|-----------|----------|
| **App mobile** | React Native + Expo |
| **Wake word** | Porcupine (Picovoice) — on-device |
| **STT** | faster-whisper-small — self-hosted CPU (Hetzner) |
| **TTS** | Piper ONNX — self-hosted CPU (Hetzner) |
| **LLM** | Claude Haiku API + prompt caching |
| **BDD** | Supabase (PostgreSQL + pgvector + Auth + Storage) |
| **VPS** | Hetzner AX102 (Ryzen 9, 128Go RAM) |
| **Orchestration** | API Node.js/Python sur VPS |

### Flux d'une requête vocale

```
[User] "Hey Elio, lis mes mails"
   ↓
[iPhone] Porcupine détecte "Hey Elio" (on-device)
   ↓
[iPhone] Enregistre l'audio de la commande
   ↓
[VPS] faster-whisper → texte : "lis mes mails"
   ↓
[VPS] Claude Haiku → comprend l'intent, fetch Gmail API
   ↓
[VPS] Piper TTS → génère l'audio de la réponse
   ↓
[iPhone] Lecture audio : "T'as 3 mails non lus..."
```

---

## 6. 💰 Business Model

### Pricing

| Plan | Prix | Contenu |
|------|------|---------|
| **Elio Free** | 0€ | 10 interactions/jour, features de base |
| **Elio Pro** | **14,99€/mois** | Illimité, toutes les intégrations, mémoire, clavier |
| **Elio Annual** | **119,99€/an** (~10€/mois) | Idem Pro, -33% |
| **Elio Care** | **24,99€/mois** | Pro + Dashboard aidant, alertes proches, rappels médicaments, rapport quotidien |

### Projections financières

| Users payants | Revenus/mois | Coûts/mois | Marge brute | Marge % |
|---------------|-------------|------------|-------------|---------|
| 100 | 1 499€ | ~360€ | +1 139€ | 76% |
| 500 | 7 495€ | ~1 600€ | +5 895€ | 79% |
| 1 000 | 14 990€ | ~2 716€ | +12 274€ | 82% |
| 5 000 | 74 950€ | ~13 500€ | +61 450€ | 82% |
| 10 000 | 149 900€ | ~27 000€ | +122 900€ | 82% |

**Seuil de rentabilité : ~24 utilisateurs payants**
**Investissement initial : ~540€**

### Répartition des coûts

- ~87% : API Claude (LLM)
- ~10% : VPS (STT + TTS)
- ~3% : Infra annexe (BDD, CDN, monitoring)

---

## 7. 🚀 Roadmap

### Phase 0 — MVP / Beta privée (Mois 1-3)
- App iOS de base avec conversation vocale
- Wake word "Hey Elio"
- Intégrations : Gmail, Google Calendar, Contacts, Rappels
- Clavier intelligent (v1)
- Météo, recherche web
- 10-50 beta testeurs

### Phase 1 — Lancement public (Mois 4-6)
- App Store release
- Ajout : Outlook, Telegram, Domotique (HomeKit), Spotify
- Mémoire contextuelle (v1)
- Personnalisation de la voix et du ton
- Tier Free + Pro à 14,99€

### Phase 2 — Croissance (Mois 7-12)
- Apple Music (MusicKit)
- IMAP générique (Free, Orange, Yahoo...)
- Clavier intelligent v2 (reformulation, traduction)
- Live Activities / Widgets
- Mode always-on optimisé batterie
- Marketing : ProductHunt, réseaux sociaux, influenceurs tech FR

### Phase 3 — Scale (Année 2)
- Internationalisation (EN, ES, DE)
- Version Android
- Orange Pi companion (hardware dédié, 0 restriction)
- Intégrations avancées (réservations, shopping)
- Multi-utilisateurs (profil famille)
- Domotique étendue (Zigbee/Z-Wave via Home Assistant)

---

## 8. 🔒 Sécurité & Privacy

| Mesure | Détail |
|--------|--------|
| **Audio** | Wake word 100% on-device, aucun audio envoyé avant activation |
| **Données** | Chiffrées en transit (TLS) et au repos |
| **OAuth** | Tokens stockés de manière sécurisée, jamais de mots de passe |
| **Mémoire** | Consultable, exportable, supprimable par l'utilisateur |
| **RGPD** | Droit à l'effacement, export des données, consentement explicite |
| **Hébergement** | Serveurs EU (Hetzner, Allemagne) |

---

## 9. 📊 Métriques de succès

| Métrique | Cible MVP | Cible M12 |
|----------|-----------|-----------|
| **DAU** | 30 | 1 000 |
| **Rétention J7** | >40% | >60% |
| **Rétention J30** | >25% | >45% |
| **Interactions/user/jour** | >20 | >50 |
| **Conversion Free→Pro** | >5% | >10% |
| **NPS** | >30 | >50 |
| **Churn mensuel** | <15% | <8% |
| **Note App Store** | >4.0 | >4.5 |

---

## 10. ⚠️ Risques & Mitigations

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| Apple rejette l'app | Critique | Faible | Respecter scrupuleusement les guidelines |
| Coûts API Claude explosent | Élevé | Moyen | Prompt caching, rate limiting, fallback modèle local |
| Latence trop élevée | Élevé | Moyen | Optimiser le pipeline, serveurs multi-régions |
| Marque Elio contestée | Moyen | Faible | Déposer rapidement à l'EUIPO |
| Porcupine pricing change | Moyen | Faible | Fallback vers OpenWakeWord |
| Concurrents (Apple Intelligence) | Élevé | Moyen | Avance sur multi-provider et mémoire |

---

*Document généré le 27 février 2026 — John, PM BMAD*
*Sources : Étude Mary (papote-etude-app-ios-2026-02-27.md), Brainstorming #études*
