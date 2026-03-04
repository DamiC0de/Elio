# Registre des Activités de Traitement
## Application Diva — Article 30 RGPD

**Responsable de traitement** : [Nom de l'entreprise]
**Date de création** : 4 mars 2026
**Dernière mise à jour** : 4 mars 2026

---

## Traitement 1 : Commandes vocales (Local)

| Champ | Valeur |
|-------|--------|
| **Nom du traitement** | Exécution des commandes vocales |
| **Finalité** | Permettre à l'utilisateur de contrôler son appareil par la voix |
| **Base légale** | Consentement (Art. 6.1.a) |
| **Catégories de personnes** | Utilisateurs de l'application |
| **Catégories de données** | Voix (audio), transcription textuelle |
| **Données sensibles** | Oui - données biométriques (voix) |
| **Source des données** | Collecte directe (microphone) |
| **Destinataires** | Aucun (traitement local uniquement) |
| **Transferts hors UE** | Non |
| **Durée de conservation** | Non conservé (traitement temps réel) |
| **Mesures de sécurité** | Chiffrement local, pas de stockage |

---

## Traitement 2 : Traitement Cloud (Optionnel)

| Champ | Valeur |
|-------|--------|
| **Nom du traitement** | Traitement avancé des requêtes complexes |
| **Finalité** | Fournir des réponses intelligentes aux questions complexes |
| **Base légale** | Consentement explicite (Art. 6.1.a) |
| **Catégories de personnes** | Utilisateurs ayant activé l'option cloud |
| **Catégories de données** | Transcription textuelle anonymisée, contexte conversation |
| **Données sensibles** | Non (anonymisées avant envoi) |
| **Source des données** | Traitement local préalable |
| **Destinataires** | Anthropic (sous-traitant API) |
| **Transferts hors UE** | Oui - USA (Anthropic) |
| **Garanties transfert** | SCCs + DPA Anthropic |
| **Durée de conservation** | 0 (éphémère) côté Anthropic, 24h contexte serveur |
| **Mesures de sécurité** | TLS 1.3, anonymisation, pas de logs |

---

## Traitement 3 : Lecture des notifications

| Champ | Valeur |
|-------|--------|
| **Nom du traitement** | Lecture des notifications à l'utilisateur |
| **Finalité** | Permettre la lecture vocale des messages reçus |
| **Base légale** | Consentement (Art. 6.1.a) - permission iOS |
| **Catégories de personnes** | Utilisateurs, expéditeurs des notifications |
| **Catégories de données** | Contenu des notifications (messages, alertes) |
| **Données sensibles** | Potentiellement (dépend du contenu) |
| **Source des données** | Système iOS (NotificationService) |
| **Destinataires** | Aucun (lecture locale) |
| **Transferts hors UE** | Non |
| **Durée de conservation** | Non conservé par Diva |
| **Mesures de sécurité** | Traitement local, pas de stockage |

---

## Traitement 4 : Gestion des contacts

| Champ | Valeur |
|-------|--------|
| **Nom du traitement** | Accès au carnet d'adresses |
| **Finalité** | Permettre l'envoi de messages aux contacts |
| **Base légale** | Consentement (Art. 6.1.a) - permission iOS |
| **Catégories de personnes** | Utilisateurs, contacts du répertoire |
| **Catégories de données** | Noms, numéros de téléphone, emails |
| **Données sensibles** | Non |
| **Source des données** | Carnet d'adresses iOS |
| **Destinataires** | Aucun (accès local uniquement) |
| **Transferts hors UE** | Non |
| **Durée de conservation** | Non conservé (accès en lecture seule) |
| **Mesures de sécurité** | Accès via API iOS sécurisée |

---

## Traitement 5 : Gestion du calendrier

| Champ | Valeur |
|-------|--------|
| **Nom du traitement** | Création et lecture d'événements |
| **Finalité** | Permettre la gestion vocale du calendrier |
| **Base légale** | Consentement (Art. 6.1.a) - permission iOS |
| **Catégories de personnes** | Utilisateurs |
| **Catégories de données** | Événements, rappels, dates |
| **Données sensibles** | Non |
| **Source des données** | Calendrier iOS |
| **Destinataires** | Aucun |
| **Transferts hors UE** | Non |
| **Durée de conservation** | Non conservé par Diva |
| **Mesures de sécurité** | Accès via API iOS sécurisée |

---

## Traitement 6 : Gestion des comptes utilisateurs

| Champ | Valeur |
|-------|--------|
| **Nom du traitement** | Création et gestion des comptes |
| **Finalité** | Authentification, personnalisation |
| **Base légale** | Exécution du contrat (Art. 6.1.b) |
| **Catégories de personnes** | Utilisateurs inscrits |
| **Catégories de données** | Email, préférences, identifiant unique |
| **Données sensibles** | Non |
| **Source des données** | Saisie utilisateur |
| **Destinataires** | Hébergeur (sous-traitant) |
| **Transferts hors UE** | Non (hébergement EU) |
| **Durée de conservation** | Jusqu'à suppression du compte + 30 jours |
| **Mesures de sécurité** | Chiffrement, hachage mot de passe |

---

## Traitement 7 : Logs techniques

| Champ | Valeur |
|-------|--------|
| **Nom du traitement** | Journalisation technique |
| **Finalité** | Débogage, sécurité, statistiques agrégées |
| **Base légale** | Intérêt légitime (Art. 6.1.f) |
| **Catégories de personnes** | Utilisateurs |
| **Catégories de données** | IP anonymisée, type appareil, version app, erreurs |
| **Données sensibles** | Non |
| **Source des données** | Collecte automatique |
| **Destinataires** | Aucun (usage interne) |
| **Transferts hors UE** | Non |
| **Durée de conservation** | 90 jours |
| **Mesures de sécurité** | Anonymisation IP, accès restreint |

---

## Sous-traitants

| Sous-traitant | Traitement | Localisation | Garanties | DPA signé |
|---------------|------------|--------------|-----------|-----------|
| Anthropic | API LLM | USA | SCCs | ✅ Oui |
| [Hébergeur] | Infrastructure | EU | RGPD natif | ✅ Oui |

---

## Historique des modifications

| Date | Version | Modification | Auteur |
|------|---------|--------------|--------|
| 2026-03-04 | 1.0 | Création initiale | Mary (Analyste BMAD) |

---

*Document conforme à l'Article 30 du RGPD - Registre des activités de traitement*
