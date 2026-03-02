# EL-032 — Notification Reader Module

## Overview
Expo native module that captures incoming notifications from other apps (WhatsApp, Telegram, Gmail, SMS, etc.) using Android's `NotificationListenerService`.

**Platform:** Android only (iOS returns empty/unavailable gracefully)

## How it works
1. User grants "Notification Access" permission in Android Settings
2. `DivaNotificationListenerService` runs in background, captures all message/email/social notifications
3. Notifications stored in `SharedPreferences` (last 500, newest first)
4. JS API exposes `getNotifications()`, `getStatus()`, `onNotification()` for real-time events
5. Orchestrator wires this as a tool so Diva can read messages on voice command

## Setup

### 1. Add to app.json plugins
```json
{
  "plugins": [
    "./modules/notification-reader/app.plugin"
  ]
}
```

### 2. Prebuild
```bash
npx expo prebuild --platform android
```

### 3. Usage in app
```typescript
import { getStatus, requestPermission, getNotifications } from './modules/notification-reader/src';

// Check permission
const status = await getStatus();
if (!status.isPermissionGranted) {
  await requestPermission(); // Opens Android settings
}

// Read WhatsApp messages
const messages = await getNotifications({
  packageNames: ['com.whatsapp'],
  limit: 10,
});
```

## Server-side tool integration
The orchestrator exposes `read_notifications` and `read_messages` tools so the user can say:
- "Lis-moi mes messages WhatsApp"
- "J'ai reçu des mails ?"
- "Qu'est-ce que Sophie m'a envoyé ?"

The app sends captured notifications to the server via WebSocket when requested.

## Files
```
notification-reader/
├── android/
│   ├── build.gradle
│   ├── src/main/
│   │   ├── AndroidManifest.xml
│   │   └── java/expo/modules/notificationreader/
│   │       ├── DivaNotificationListenerService.java  ← Background service
│   │       ├── NotificationReaderModule.java          ← RN Bridge
│   │       └── NotificationStore.java                 ← Storage
├── src/
│   └── index.ts                                       ← JS API
├── types.ts                                           ← TypeScript types
├── app.plugin.js                                      ← Expo config plugin
├── expo-module.config.json
└── README.md
```
