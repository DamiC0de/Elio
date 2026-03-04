# Test Checklist — Diva MVP

**Version** : 1.0
**Date** : 2026-03-04
**Testeur** : ________________
**Device** : ________________
**Build** : ________________

---

## 🔧 Prérequis

- [ ] iPhone avec Expo Go installé
- [ ] Même réseau WiFi que le serveur
- [ ] Serveur Diva actif (`http://72.60.155.227:3001`)
- [ ] Compte Supabase créé

---

## 1️⃣ Onboarding (10%)

| # | Test | Action | Attendu | ✅/❌ | Notes |
|---|------|--------|---------|-------|-------|
| 1.1 | Premier lancement | Ouvrir l'app | Écran Welcome avec logo Diva | | |
| 1.2 | Navigation | Tap "Commencer" | Page permission micro | | |
| 1.3 | Permission micro | Tap "Autoriser" | Popup iOS, puis page suivante | | |
| 1.4 | Skip permission | Tap "Plus tard" | Continue sans bloquer | | |
| 1.5 | Personnalisation | Entrer prénom, choisir ton | Enregistré correctement | | |
| 1.6 | Fin onboarding | Tap "Commencer à parler" | Arrive sur écran principal | | |
| 1.7 | Relancement | Fermer et rouvrir | Directement écran principal | | |

**Score** : ___/7

---

## 2️⃣ Écran Principal (10%)

| # | Test | Action | Attendu | ✅/❌ | Notes |
|---|------|--------|---------|-------|-------|
| 2.1 | Affichage orbe | Ouvrir écran | Orbe violet, pulse lent | | |
| 2.2 | Connexion WS | Attendre 2s | Pas de banner "Connexion..." | | |
| 2.3 | Hint | Observer | "Appuie pour parler" visible | | |
| 2.4 | Settings | Tap ⚙️ | Ouvre page settings | | |

**Score** : ___/4

---

## 3️⃣ Pipeline Vocal — Core (30%)

| # | Test | Action | Attendu | ✅/❌ | Notes |
|---|------|--------|---------|-------|-------|
| 3.1 | Start listening | Tap orbe | Orbe → bleu, "Je t'écoute" | | |
| 3.2 | Audio capture | Parler | Waveform réactif | | |
| 3.3 | Silence detection | Se taire 2.5s | Auto-stop, orbe → cyan | | |
| 3.4 | Transcription | Observer | Texte apparaît (ta phrase) | | |
| 3.5 | Processing | Attendre | Orbe cyan spinning | | |
| 3.6 | Response | Attendre | Orbe → vert, audio joue | | |
| 3.7 | Transcript response | Observer | Texte réponse Diva | | |
| 3.8 | Return to idle | Fin réponse | Orbe → violet | | |
| 3.9 | Cancel | Tap pendant réponse | Audio stop, retour idle | | |

**Score** : ___/9

---

## 4️⃣ Commandes Vocales (20%)

| # | Test | Commande | Attendu | ✅/❌ | Notes |
|---|------|----------|---------|-------|-------|
| 4.1 | Heure | "Quelle heure est-il ?" | Répond l'heure actuelle | | |
| 4.2 | Date | "On est quel jour ?" | Répond la date | | |
| 4.3 | Question simple | "Combien font 2+2 ?" | "4" ou équivalent | | |
| 4.4 | Question complexe | "Explique la photosynthèse" | Explication détaillée | | |
| 4.5 | Conversation | "Je m'appelle X" puis "Comment je m'appelle ?" | Se souvient du nom | | |
| 4.6 | Rappel | "Rappelle-moi dans 5 minutes" | Confirmation + rappel créé | | |
| 4.7 | Météo | "Quel temps fait-il ?" | Info météo | | |

**Score** : ___/7

---

## 5️⃣ Intégrations (15%)

| # | Test | Commande | Attendu | ✅/❌ | Notes |
|---|------|----------|---------|-------|-------|
| 5.1 | Contacts | "Appelle Maman" | Ouvre app téléphone | | |
| 5.2 | Calendar | "Quels sont mes RDV demain ?" | Liste les événements | | |
| 5.3 | Gmail | "Lis mes emails" | Lit les emails récents | | |
| 5.4 | Notifications | "Lis mes messages" | Lit les notifs (Android) | | |

**Score** : ___/4

---

## 6️⃣ Bug Orbe — Regression (5%)

| # | Test | Action | Attendu | ✅/❌ | Notes |
|---|------|--------|---------|-------|-------|
| 6.1 | Speaking state | Écouter réponse complète | Orbe reste VERT jusqu'à la fin | | |
| 6.2 | Pas de flicker | Observer pendant réponse | Pas de flash violet | | |
| 6.3 | Transition finale | Fin de l'audio | Violet seulement après COMPLETED | | |

**Score** : ___/3

---

## 7️⃣ Latence TTS (5%)

| # | Test | Mesure | Cible | Réel | ✅/❌ |
|---|------|--------|-------|------|-------|
| 7.1 | Question courte | Temps avant 1ère syllabe | < 3s | ___s | |
| 7.2 | Question longue | Temps avant 1ère syllabe | < 5s | ___s | |
| 7.3 | Réponse longue | Fluidité streaming | Pas de coupures | | |

**Score** : ___/3

---

## 8️⃣ Erreurs & Edge Cases (5%)

| # | Test | Action | Attendu | ✅/❌ | Notes |
|---|------|--------|---------|-------|-------|
| 8.1 | Mode avion | Couper réseau | Message d'erreur clair | | |
| 8.2 | Serveur down | Arrêter serveur | "Connexion..." puis retry | | |
| 8.3 | Parler en silence | Ne rien dire | "Je n'ai rien entendu" | | |
| 8.4 | Bruit de fond | Environnement bruyant | Pas de transcription parasite | | |
| 8.5 | App en background | Mettre en background | Reconnecte au retour | | |

**Score** : ___/5

---

## 📊 Résumé

| Section | Score | Poids | Pondéré |
|---------|-------|-------|---------|
| Onboarding | /7 | 10% | |
| Écran principal | /4 | 10% | |
| Pipeline vocal | /9 | 30% | |
| Commandes | /7 | 20% | |
| Intégrations | /4 | 15% | |
| Bug orbe | /3 | 5% | |
| Latence | /3 | 5% | |
| Edge cases | /5 | 5% | |
| **Total** | **/42** | 100% | **____%** |

---

## Verdict

- [ ] 🟢 **GO** (> 90%) — Prêt pour les testeurs
- [ ] 🟡 **FIXABLE** (75-90%) — Quelques bugs à corriger
- [ ] 🔴 **NO GO** (< 75%) — Problèmes majeurs

---

## 🐛 Bugs trouvés

| # | Section | Description | Sévérité | Screenshot |
|---|---------|-------------|----------|------------|
| B1 | | | 🔴/🟡/🟢 | |
| B2 | | | | |
| B3 | | | | |
| B4 | | | | |
| B5 | | | | |

---

## 💡 Suggestions UX

| # | Description | Priorité |
|---|-------------|----------|
| S1 | | |
| S2 | | |
| S3 | | |

---

## Signature

**Date du test** : ________________

**Testeur** : ________________

**Validé par** : ________________

---

*Checklist créée par Amelia (BMAD Dev) — 2026-03-04*
