# EL-032 — Notification Reader (Android)

**Épique :** E4 — Intégrations Services
**Sprint :** S3
**Points :** 5
**Priorité :** P1
**Dépendances :** EL-008 (Claude Haiku)

---

## Description

En tant qu'**utilisateur**, je veux que Diva puisse lire mes messages/notifications reçus (WhatsApp, SMS, Gmail, Telegram, etc.) pour les résumer vocalement, afin de gérer mes communications sans toucher mon téléphone.

## Contexte technique

- **Android** : `NotificationListenerService` capture toutes les notifications entrantes
- **iOS** : Non supporté (Apple bloque l'accès aux notifications tierces)
- L'utilisateur accorde une permission unique dans Android Settings → Notification Access
- Le service tourne en background et stocke les 500 dernières notifications
- Le serveur demande les notifications au client via WebSocket quand l'outil est appelé

## Architecture

```
[NotificationListenerService] → [NotificationStore (SharedPreferences)]
                                        ↕
[App foreground] ← WebSocket ← [Server: read_notifications tool]
                                        ↕
                               [Claude: résume et lit vocalement]
```

## Critères d'acceptation

- [x] Module Expo natif Android avec `NotificationListenerService`
- [x] Capture : packageName, appName, title, text, bigText, subText, timestamp, isGroup
- [x] Storage : SharedPreferences, 500 max, newest first
- [x] JS API : `getStatus()`, `requestPermission()`, `getNotifications()`, `onNotification()`
- [x] Config plugin Expo pour auto-register le service dans AndroidManifest
- [x] Tool `read_notifications` ajouté à l'orchestrateur
- [x] Filtrage par app (whatsapp, gmail, sms...) et par contact
- [x] Communication client ↔ serveur via WebSocket
- [ ] Écran permission dans l'onboarding/settings
- [ ] Handler côté app pour `request_notifications` event
- [ ] Tests sur device Android réel

## Apps supportées

| App | Package | Catégorie |
|-----|---------|-----------|
| WhatsApp | com.whatsapp | message |
| Telegram | org.telegram.messenger | message |
| Gmail | com.google.android.gm | email |
| Messages (Google) | com.google.android.apps.messaging | message |
| Messenger | com.facebook.orca | message |
| Discord | com.discord | message |
| Instagram | com.instagram.android | social |
| Outlook | com.microsoft.office.outlook | email |
| Slack | com.Slack | message |
| + toute app avec notification category MESSAGE/EMAIL/SOCIAL |

## Tâches restantes

1. **Handler WebSocket côté app** (~1h)
   - Écouter l'event `request_notifications` du serveur
   - Appeler `getNotifications()` du module natif
   - Renvoyer les résultats via `notifications_response`

2. **UI Permission** (~1h)
   - Card dans Settings pour activer/désactiver
   - Check au démarrage + dans onboarding

3. **Test device** (~2h)
   - Tester sur un vrai Android avec WhatsApp, Gmail, SMS
   - Vérifier que bigText contient bien le message complet
   - Tester la persistance après kill de l'app

## Definition of Done

- [ ] Permission accordée → notifications capturées en background
- [ ] "Lis-moi mes messages WhatsApp" → Diva lit les derniers messages
- [ ] "J'ai reçu un mail de Sophie ?" → Diva filtre par contact
- [ ] Fonctionne même si l'app était fermée (service background)
- [ ] Code mergé sur `main`

---

*Story créée le 2 mars 2026 — Amelia, Dev BMAD*
