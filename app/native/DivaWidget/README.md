# Diva iOS Widget

Home screen widget for quick access to Diva.

## Features

- **Small Widget**: Tap to open Diva and start listening
- **Medium Widget**: Shows last interaction + tap to listen

## Setup (after expo prebuild)

### 1. Run expo prebuild
```bash
cd app
npx expo prebuild --platform ios
```

### 2. Open Xcode
```bash
open ios/Diva.xcworkspace
```

### 3. Add Widget Extension Target

1. File → New → Target → "Widget Extension"
2. Product Name: `DivaWidget`
3. Bundle Identifier: `com.diva.app.widget`
4. Include Configuration Intent: No
5. Delete generated files and copy from `native/DivaWidget/`

### 4. Configure App Group

Both main app and widget need the same App Group:

1. Select each target → Signing & Capabilities
2. Add "App Groups" capability
3. Add group: `group.com.diva.app`

### 5. Handle Deep Link in App

The widget uses `diva://listen` URL to open the app and start listening.

In `app/_layout.tsx`:
```typescript
import * as Linking from 'expo-linking';

useEffect(() => {
  const handleUrl = (event: { url: string }) => {
    if (event.url === 'diva://listen') {
      // Start voice session
      startListening();
    }
  };
  
  Linking.addEventListener('url', handleUrl);
  
  // Check initial URL
  Linking.getInitialURL().then((url) => {
    if (url === 'diva://listen') {
      startListening();
    }
  });
}, []);
```

### 6. Update Widget Data from App

When the user interacts with Diva, save the last interaction:

```typescript
import { NativeModules, Platform } from 'react-native';

function saveLastInteraction(text: string) {
  if (Platform.OS === 'ios') {
    // This requires a native module to write to App Group UserDefaults
    // Or use react-native-shared-group-preferences
    NativeModules.SharedDefaults?.set('lastInteraction', text, 'group.com.diva.app');
  }
}
```

## Widget Sizes

| Size | Dimensions | Use Case |
|------|------------|----------|
| Small | 2x2 | Quick tap to listen |
| Medium | 4x2 | Last interaction + listen |

## Files

- `DivaWidget.swift` - Widget implementation (WidgetKit)
- `Info.plist` - Extension configuration
