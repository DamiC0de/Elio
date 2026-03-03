# Wake Word Detection - "Diva"

Allows hands-free activation of Diva by saying "Diva".

## Options

### Option 1: Porcupine (Recommended)

**Pros:** Low battery usage, high accuracy, offline
**Cons:** Requires API key ($), custom wake word needs training

#### Setup

1. Create account at [Picovoice Console](https://console.picovoice.ai/)
2. Get Access Key
3. Train custom "Diva" wake word (or use built-in keywords)
4. Add to `.env`:
   ```
   EXPO_PUBLIC_PORCUPINE_ACCESS_KEY=your_key_here
   ```
5. Install package:
   ```bash
   npm install @picovoice/porcupine-react-native
   ```

### Option 2: Native Speech Recognition (Free Fallback)

**Pros:** Free, no API key needed
**Cons:** Higher battery usage, requires internet (iOS)

#### Setup

1. Install package:
   ```bash
   npm install @react-native-voice/voice
   ```
2. Add permissions to app.json:
   ```json
   {
     "expo": {
       "ios": {
         "infoPlist": {
           "NSSpeechRecognitionUsageDescription": "Diva uses speech recognition to detect wake words"
         }
       }
     }
   }
   ```

## Usage in App

The `useWakeWord` hook automatically selects the best available method:

```typescript
import { useWakeWord } from './hooks/useWakeWord';

function App() {
  const { isListening, isAvailable, detectionMethod } = useWakeWord({
    mode: 'always_on', // 'always_on' | 'smart' | 'manual'
    onWakeWordDetected: () => {
      // Start voice session
      startListening();
    },
    enabled: true,
  });
  
  return (
    <Text>
      Wake word: {isAvailable ? `Active (${detectionMethod})` : 'Not available'}
    </Text>
  );
}
```

## Modes

- **always_on**: Listens continuously, even in background (battery intensive)
- **smart**: Listens when app is active, pauses in background
- **manual**: User must tap to speak (no wake word)

## Battery Considerations

| Method | Battery Impact | Accuracy | Offline |
|--------|---------------|----------|---------|
| Porcupine | Low | High | Yes |
| Voice | High | Medium | No (iOS) |
| Manual | None | N/A | N/A |

Recommend using "smart" mode for balance between convenience and battery life.
