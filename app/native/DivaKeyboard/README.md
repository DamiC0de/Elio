# Diva Keyboard Extension

Custom iOS keyboard that allows voice input processed by Diva AI.

## Setup Instructions (after expo prebuild)

### 1. Run expo prebuild
```bash
cd app
npx expo prebuild --platform ios
```

### 2. Open Xcode project
```bash
open ios/Diva.xcworkspace
```

### 3. Add Keyboard Extension Target

1. File → New → Target → "Keyboard Extension"
2. Product Name: `DivaKeyboard`
3. Bundle Identifier: `com.diva.app.keyboard`
4. Language: Swift
5. Delete the generated files and copy files from `native/DivaKeyboard/`

### 4. Configure App Group

Both targets need the same App Group:

**For Diva (main app):**
1. Select Diva target → Signing & Capabilities
2. Add "App Groups" capability
3. Add group: `group.com.diva.app`

**For DivaKeyboard:**
1. Select DivaKeyboard target → Signing & Capabilities
2. Add "App Groups" capability
3. Add group: `group.com.diva.app`

### 5. Configure Keychain Sharing

Both targets need Keychain Sharing:

1. Add "Keychain Sharing" capability to both targets
2. Use access group: `group.com.diva.app`

### 6. Build and Test

1. Build for your device (not simulator - keyboard extensions don't work well in simulator)
2. Go to Settings → General → Keyboard → Keyboards → Add New Keyboard
3. Select "Diva"
4. Enable "Allow Full Access" (required for network and microphone)

## Files

- `KeyboardViewController.swift` - Main keyboard UI and logic
- `Info.plist` - Extension configuration

## Features

- Voice input with microphone button
- Audio sent to Diva server for processing
- Response inserted directly into text field
- Shared authentication via App Group keychain
