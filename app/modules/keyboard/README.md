# EL-022 — Elio iOS Custom Keyboard

## Architecture

This is an **iOS Keyboard Extension** that requires `expo-dev-client` (native prebuild).
It cannot run in Expo Go.

### Structure

```
keyboard/
├── README.md
├── ElioKeyboard/           # Native iOS extension (Swift)
│   ├── KeyboardViewController.swift
│   ├── Info.plist
│   └── ElioKeyboard.entitlements
└── types.ts                # Shared types
```

### Communication

- **App → Extension**: App Groups (shared UserDefaults + Keychain)
- **Extension → Server**: Direct HTTPS to API Gateway
- **Auth**: JWT stored in shared Keychain via App Groups

### Setup Requirements

1. Apple Developer account with App Groups capability
2. `expo prebuild` to generate native project
3. Add keyboard extension target in Xcode
4. Configure App Groups entitlement (both main app + extension)
5. Shared Keychain access group

### Features

- AZERTY FR layout
- 🎙️ Elio button: voice dictation → STT → text insertion
- 💡 Suggestion button: contextual completion via Claude
- Dark mode support
- Haptic feedback
- Full Access required (for network requests)

### Limitations

- Cannot access main app's JS runtime
- Limited memory (30MB)
- No background audio recording
- Network requires Full Access permission
