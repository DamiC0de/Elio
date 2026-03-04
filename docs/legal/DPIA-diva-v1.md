# Data Protection Impact Assessment (DPIA)
## Application Diva — Assistant Vocal Privacy-First

**Version**: 1.0
**Date**: 2026-03-04
**Responsable**: [À compléter]
**DPO Contact**: [À compléter]

---

## 1. Description du traitement

### 1.1 Nature du traitement
Diva est une application mobile d'assistant vocal personnel qui :
- Capture et traite la voix de l'utilisateur pour exécuter des commandes
- Lit les notifications de l'appareil (messages, rappels)
- Génère des réponses vocales via synthèse vocale (TTS)
- Peut envoyer des messages au nom de l'utilisateur

### 1.2 Portée du traitement
| Élément | Description |
|---------|-------------|
| Données concernées | Voix, transcriptions, notifications, contacts, calendrier |
| Volume estimé | 50-5000 utilisateurs (phase MVP à production) |
| Fréquence | Continue (utilisation quotidienne) |
| Durée conservation | Voir section 3.4 |

### 1.3 Contexte du traitement
- **Secteur** : Application grand public (B2C)
- **Territoire** : International (EU, US, autres)
- **Technologie** : iOS native + Backend cloud

### 1.4 Finalités du traitement
1. **Exécution de commandes vocales** : rappels, minuteries, envoi de messages
2. **Assistance contextuelle** : réponses aux questions, résumés
3. **Personnalisation** : adaptation aux préférences utilisateur
4. **Amélioration du service** : correction de bugs (logs anonymisés uniquement)

---

## 2. Évaluation de la nécessité et proportionnalité

### 2.1 Base légale
| Traitement | Base légale (Art. 6) | Justification |
|------------|---------------------|---------------|
| Capture vocale | Consentement (6.1.a) | Opt-in explicite à l'installation |
| Lecture notifications | Consentement (6.1.a) | Permission iOS explicite |
| Envoi messages | Consentement (6.1.a) | Confirmation avant envoi |
| Traitement cloud | Consentement (6.1.a) | Opt-in séparé |

### 2.2 Données biométriques (Art. 9)
La voix constitue une donnée biométrique car elle permet l'identification unique.
- **Base légale** : Consentement explicite (Art. 9.2.a)
- **Mitigation** : Traitement local privilégié, pas de stockage d'empreintes vocales

### 2.3 Principe de minimisation
| Donnée | Nécessité | Justification |
|--------|-----------|---------------|
| Audio brut | Oui | Transcription STT |
| Transcription | Oui | Compréhension commande |
| Notifications | Optionnel | Lecture sur demande |
| Contacts | Optionnel | Envoi messages |
| Localisation | Non collectée | - |
| Historique navigation | Non collectée | - |

### 2.4 Limitation de la conservation
| Donnée | Durée | Justification |
|--------|-------|---------------|
| Audio brut (local) | Immédiat (non stocké) | Traité en streaming |
| Transcription (local) | Session uniquement | Effacé à la fermeture |
| Contexte conversation | 24 heures | Continuité conversation |
| Données envoyées cloud | 0 (éphémère) | Pas de persistence |
| Compte utilisateur | Jusqu'à suppression | Fonctionnement service |

---

## 3. Évaluation des risques

### 3.1 Identification des risques

| Risque | Probabilité | Impact | Niveau |
|--------|-------------|--------|--------|
| Interception données en transit | Faible | Élevé | 🟡 Moyen |
| Accès non autorisé serveur | Faible | Élevé | 🟡 Moyen |
| Capture voix tiers (bystanders) | Moyen | Moyen | 🟡 Moyen |
| Fuite données API tierce | Faible | Élevé | 🟡 Moyen |
| Inférence données sensibles | Moyen | Moyen | 🟡 Moyen |
| Perte de données | Très faible | Faible | 🟢 Faible |

### 3.2 Risques spécifiques voix

#### Capture de tiers non consentants
- **Scénario** : L'utilisateur active Diva, une personne à proximité parle
- **Impact** : Traitement de données personnelles sans consentement
- **Mitigation** : 
  - Traitement 100% local par défaut
  - Indicateur visuel/sonore d'écoute active
  - Pas de stockage audio

#### Inférence de données sensibles
- **Scénario** : L'analyse vocale révèle état émotionnel, santé, origine
- **Impact** : Traitement de données Art. 9 non déclarées
- **Mitigation** :
  - Pas d'analyse vocale au-delà de la transcription
  - Pas de profilage émotionnel
  - Modèle STT ne conserve pas de métadonnées vocales

### 3.3 Matrice de risque finale

```
Impact
   ^
 4 |     [R3]      [R1,R2,R4]
 3 |  [R5]
 2 |        [R6]
 1 |
   +-------------------> Probabilité
     1    2    3    4

R1: Interception transit
R2: Accès non autorisé
R3: Fuite API tierce
R4: Capture tiers
R5: Inférence sensible
R6: Perte données
```

---

## 4. Mesures d'atténuation

### 4.1 Mesures techniques

| Mesure | Risque adressé | Implementation |
|--------|----------------|----------------|
| Chiffrement TLS 1.3 | R1 | Toutes communications |
| Chiffrement AES-256 | R2 | Données au repos |
| Architecture local-first | R3, R4 | 80% traitement sur device |
| Authentification JWT | R2 | Tokens signés, expiration courte |
| Pas de logs voix | R1, R4, R5 | Audio jamais persisté |
| HTTPS pinning | R1 | Certificats épinglés |

### 4.2 Mesures organisationnelles

| Mesure | Description |
|--------|-------------|
| DPA sous-traitants | Contrat Anthropic avec SCCs |
| Formation équipe | Sensibilisation RGPD |
| Procédure breach | Notification < 72h |
| Audit annuel | Revue des pratiques |

### 4.3 Privacy by Design

1. **Local-first** : Le traitement reste sur l'appareil sauf nécessité
2. **Minimisation** : Seules les données nécessaires sont collectées
3. **Éphémère** : Pas de stockage permanent des données sensibles
4. **Transparence** : L'utilisateur sait ce qui est traité où
5. **Contrôle** : Opt-out cloud, suppression compte facile

---

## 5. Droits des personnes concernées

### 5.1 Implémentation des droits

| Droit | Article | Implémentation | Délai |
|-------|---------|----------------|-------|
| Information | 13, 14 | Privacy Policy in-app | Immédiat |
| Accès | 15 | Export données (JSON) | 30 jours |
| Rectification | 16 | Édition profil | Immédiat |
| Effacement | 17 | Suppression compte | 30 jours |
| Limitation | 18 | Pause du service | Immédiat |
| Portabilité | 20 | Export standard | 30 jours |
| Opposition | 21 | Opt-out cloud | Immédiat |

### 5.2 Procédure de demande
1. L'utilisateur contacte : privacy@[domain].com
2. Vérification d'identité sous 7 jours
3. Traitement de la demande sous 30 jours
4. Confirmation par email

---

## 6. Transferts internationaux

### 6.1 Flux de données

```
[iPhone EU] --TLS--> [Serveur Relay EU] --TLS--> [API Anthropic US]
                           |
                      Pas de stockage
```

### 6.2 Garanties pour transferts US

| Mécanisme | Status |
|-----------|--------|
| SCCs (Standard Contractual Clauses) | ✅ Inclus DPA Anthropic |
| TIA (Transfer Impact Assessment) | ✅ Ce document |
| Mesures supplémentaires | ✅ Chiffrement E2E |

### 6.3 Évaluation du transfert vers US (Anthropic)

**Risques identifiés** :
- Accès potentiel par autorités US (FISA 702, EO 12333)

**Mesures compensatoires** :
- Données anonymisées avant envoi (pas d'identifiant utilisateur)
- Pas de stockage côté Anthropic (traitement éphémère)
- Chiffrement E2E jusqu'au point de traitement
- Option opt-out cloud pour utilisateurs sensibles

---

## 7. Consultation préalable

### 7.1 Nécessité de consultation CNIL
Selon l'Art. 36 RGPD, une consultation préalable est requise si les risques résiduels restent élevés après mitigation.

**Conclusion** : Les mesures d'atténuation ramènent tous les risques à un niveau acceptable (🟢 ou 🟡). Pas de consultation préalable requise.

### 7.2 Personnes consultées

| Rôle | Date | Avis |
|------|------|------|
| DPO | [À compléter] | [À compléter] |
| Équipe technique | 2026-03-04 | Favorable |
| Équipe produit | 2026-03-04 | Favorable |

---

## 8. Conclusion

### 8.1 Décision
Le traitement peut être mis en œuvre moyennant l'application des mesures décrites.

### 8.2 Actions requises avant lancement

| Action | Responsable | Deadline |
|--------|-------------|----------|
| Implémenter chiffrement E2E | Dev | MVP |
| Créer écrans consentement | Dev | MVP |
| Publier Privacy Policy | Legal | MVP |
| Configurer export données | Dev | MVP+30j |
| Nommer DPO ou référent | Direction | MVP |

### 8.3 Revue périodique
Ce DPIA sera revu :
- À chaque modification significative du traitement
- Au minimum une fois par an
- En cas d'incident de sécurité

---

**Signatures**

| Rôle | Nom | Date | Signature |
|------|-----|------|-----------|
| Responsable traitement | | | |
| DPO | | | |
| Directeur technique | | | |

---

*Document généré conformément aux lignes directrices CNIL et EDPB sur les DPIA*
