# Architecture Diva v1 — Privacy-First Voice Assistant

**Date**: 2026-03-04
**Status**: Validé
**Auteur**: Mary (Analyste BMAD)

## Vue d'ensemble

Diva est un assistant vocal privacy-first avec une architecture 2-tiers :
- **Tier 1 (Local)** : Traitement sur iPhone, 80% des requêtes
- **Tier 2 (Cloud)** : Traitement cloud sécurisé, 20% des requêtes complexes

## Architecture Tier 1 — Local (iPhone)

### Composants
| Composant | Rôle | Taille |
|-----------|------|--------|
| Whisper tiny/base | STT (Speech-to-Text) | ~40MB |
| Piper | TTS (Text-to-Speech) | ~20MB |
| Qwen2.5-0.5B | Triage & réponses simples | ~300MB |
| SQLite | Contexte local | Variable |
| Core ML | Accélération hardware | Native |

### Capacités locales
- ✅ Rappels, timers, alarmes
- ✅ Lecture messages (notifications)
- ✅ Envoi messages template
- ✅ Gestion contacts, calendrier
- ✅ Commandes simples (météo, heure, etc.)

### Critères de triage
Le mini-LLM local classifie chaque requête :
```json
{
  "tier": 1,           // 1=local, 2=cloud
  "confidence": 0.92,
  "reason": "simple_action",
  "response": "D'accord, je te rappelle dans 10 minutes."
}
```

Si `tier=1` ET `confidence > 0.8` → exécution locale
Sinon → envoi au cloud (chiffré E2E)

## Architecture Tier 2 — Cloud

### Option retenue (MVP)
**API Claude (Anthropic)**
- Modèle : Claude Haiku 4.5
- Coût estimé : ~$20-40/mois pour 50 users
- Avantages : Simple, pas d'infra, DPA RGPD

### Mesures de privacy
1. Chiffrement E2E client ↔ serveur relay
2. Pas de logs côté serveur
3. Données anonymisées avant envoi API
4. Option opt-out cloud pour users sensibles
5. Pas de persistence des données utilisateur

### Capacités cloud
- ✅ Résumé de conversations
- ✅ Génération de réponses intelligentes
- ✅ Analyse contextuelle complexe
- ✅ Questions ouvertes / raisonnement

## Pricing & Scaling

| Phase | Users | Infrastructure | Coût/mois |
|-------|-------|----------------|-----------|
| MVP Test | 50 | API Claude | ~$30 |
| Beta | 500 | GPU Marketplace | ~$150 |
| Production | 5000+ | Confidential Computing | ~$800+ |

## Conformité

- **GDPR** : Données minimisées, consentement explicite, droit à l'oubli
- **International** : Architecture compatible multi-région
- **Privacy by design** : Local-first, cloud uniquement si nécessaire

## Décisions techniques

1. **Mini-LLM pour triage** : Qwen2.5-0.5B (équilibre taille/performance)
2. **STT local** : Whisper tiny pour latence minimale
3. **TTS local** : Piper pour offline capability
4. **Backend MVP** : Serveur relay simple + API Anthropic
5. **Stockage** : SQLite local, pas de sync cloud des données personnelles

## Prochaines étapes

1. [ ] Spec technique détaillée (Winston)
2. [ ] Stories Tier 1 local (John)
3. [ ] POC triage local sur iOS (Amelia)
4. [ ] Setup serveur relay (Amelia)

---

*Document généré par le framework BMAD*
