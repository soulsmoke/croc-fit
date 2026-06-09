---
name: "expo"
description: "Conventions and patterns for Expo + React Native development. Load when scaffolding, configuring, implementing features, or debugging Expo projects (web, iOS, Android)."
applyTo: "**/*.ts,**/*.tsx,**/*.json,app.json,eas.json"
---

# Expo (React Native) Skill

> Context7 library ID: `/llmstxt/expo_dev_llms_txt`
> expo-speech-recognition: `/github/nicktindall/cyclon.p2p` (use topic "expo-speech-recognition useSpeechRecognitionEvent")
> SDK current: **Expo SDK 54** (required for `expo/fetch` streaming support)

---

## 1. Scaffold

```bash
npx create-expo-app@latest <name> --template blank-typescript
cd <name>

# add expo-router — file-based routing
npx expo install expo-router react-native-safe-area-context react-native-screens \
  expo-linking expo-constants expo-status-bar
```

`package.json` required entry point:
```json
{
  "main": "expo-router/entry"
}
```

`app.json` required for expo-router:
```json
{
  "expo": {
    "scheme": "agent-ui",
    "web": { "bundler": "metro" }
  }
}
```

yarn 4:
```bash
corepack enable
corepack use yarn@stable
```

`.yarnrc.yml` required — Expo does not support PnP:
```yaml
nodeLinker: node-modules
```

---

## 2. Project structure

```
my-app/
  app/
    _layout.tsx          ← Root layout + Stack/Tabs navigator
    (auth)/
      login.tsx          ← route "/login"
    (protected)/
      index.tsx          ← main screen (route group)
  components/            ← reusable UI components
  hooks/                 ← custom hooks
  lib/                   ← utilities, config, theme
  contexts/              ← React context providers
  app.json
  eas.json
  .env.example
```

**Route groups**: `(name)/` — parentheses exclude name from URL path.
**Nested layout**: each subfolder can have its own `_layout.tsx`.

---

## 3. Navigation — Expo Router

```tsx
// app/_layout.tsx — root layout with Stack + auth guard
import { Stack, router } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function RootLayout() {
  const { token, authMode } = useAuth();

  useEffect(() => {
    if (authMode === 'none') return;  // skip guard
    if (!token) router.replace('/(auth)/login');
  }, [token, authMode]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      {token || authMode === 'none' ? (
        <Stack.Screen name="(chat)/index" />
      ) : (
        <Stack.Screen name="(auth)/login" />
      )}
    </Stack>
  );
}
```

Programmatic navigation:
```tsx
import { router } from 'expo-router';
router.push('/(auth)/login');
router.replace('/(chat)/index');  // no back stack
```

---

## 4. Auth — expo-secure-store

Bearer token auth: `expo-secure-store` on native, `localStorage` on web.

```bash
npx expo install expo-secure-store
```

```ts
// contexts/AuthContext.tsx
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'agent_ui_token';

async function saveToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
}

async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function deleteToken(): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}
```

**AuthContext:**
```tsx
interface AuthContextValue {
  token: string | null;
  authMode: 'none' | 'bearer';
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const config = useConfig();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (config.authMode === 'none') return;
    getToken().then(setToken);
  }, [config.authMode]);

  const login = async (newToken: string) => {
    await saveToken(newToken);
    setToken(newToken);
  };

  const logout = async () => {
    await deleteToken();
    setToken(null);
    router.replace('/(auth)/login');
  };

  return (
    <AuthContext.Provider value={{ token, authMode: config.authMode, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

**Validate bearer token**: `GET /health` → `{ status: "ok" }` → 200 = valid.

---

## 5. Config — validazione con Zod

```bash
yarn add zod
```

Versioned JSON config + Zod schema + `EXPO_PUBLIC_*` overrides.

```ts
// lib/config.ts
import { z } from 'zod';
import rawConfig from '../app.config.json';

const ConfigSchema = z.object({
  apiUrl: z.string().url(),
  // add app-specific fields
});

export type AppConfig = z.infer<typeof ConfigSchema>;

const merged = {
  ...rawConfig,
  ...(process.env['EXPO_PUBLIC_API_URL'] && { apiUrl: process.env['EXPO_PUBLIC_API_URL'] }),
};

export const config: AppConfig = ConfigSchema.parse(merged);
```

**⚠️ Fatal Zod error at bootstrap** — fail fast with clear message.

> Full agent-ui schema (agentName, authMode, theme, avatarUrl, STT/TTS) → `.github/skills/agent-ui/SKILL.md`.

---

## 6. SSE Streaming — expo/fetch (SDK 52+)

```bash
# expo/fetch included in Expo SDK 52+ — no install needed
```

```ts
// lib/api.ts
import { fetch } from 'expo/fetch';  // ⚠️ NOT global fetch
import { Platform } from 'react-native';
import Constants from 'expo-constants';

function resolveApiUrl(rawUrl: string): string {
  if (Platform.OS === 'ios' && __DEV__) {
    const metroHost =
      Constants.expoConfig?.hostUri?.split(':')[0] ||
      (Constants as any).expoGoConfig?.debuggerHost?.split(':')[0] ||
      (Constants as any).platform?.hostUri?.split(':')[0];
    if (metroHost && metroHost !== 'localhost' && metroHost !== '127.0.0.1') {
      return rawUrl.replace(/localhost|127\.0\.0\.1/, metroHost);
    }
  }
  return rawUrl;
}

export async function streamChat(
  req: ChatRequest,
  onToken: (accumulated: string) => void,
  accessToken?: string,
  signal?: AbortSignal,
): Promise<{ response: string }> {
  const apiUrl = resolveApiUrl(config.apiUrl);

  const response = await fetch(`${apiUrl}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(req),
    signal,
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const json = JSON.parse(line.slice(6));
        if (typeof json['chunk'] === 'string') {
          accumulated += json['chunk'];
          onToken(accumulated);
        }
      } catch { /* partial chunk */ }
    }
  }

  return { response: accumulated };
}

export async function postChat(req: ChatRequest & { clear_context?: boolean }, accessToken?: string): Promise<void> {
  const apiUrl = resolveApiUrl(config.apiUrl);
  await fetch(`${apiUrl}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(req),
  });
}
```

**⚠️ `import { fetch } from 'expo/fetch'`** — global RN fetch does not support `ReadableStream`. Explicit import required.

**⚠️ Line buffer** — iOS URLSession can split SSE mid-line. `lines.pop()` preserves incomplete line for next chunk.

---

## 7. iOS URLSession batching

iOS URLSession delivers many tokens per `reader.read()`. React 19 batches `setState` → UI blocked. Fix: mutable buffer + 60fps flush.

```tsx
// useSSEChat hook pattern
const contentBuffer = useRef({ value: '' });
const renderIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

// before streamChat: start flush interval
renderIntervalRef.current = setInterval(() => {
  const current = contentBuffer.current.value;
  if (current) {
    setMessages((prev) =>
      prev.map((m) => (m.id === assistantId ? { ...m, content: current } : m)),
    );
  }
}, 16);

// onToken: write to buffer (not setState)
await streamChat(req, (accumulated) => {
  contentBuffer.current.value = accumulated;
}, accessToken, abortRef.current.signal);

// after streamChat: stop interval + final update
clearInterval(renderIntervalRef.current);
renderIntervalRef.current = null;
setMessages((prev) =>
  prev.map((m) => (m.id === assistantId ? { ...m, content: contentBuffer.current.value } : m)),
);
contentBuffer.current.value = '';
```

---

## 8. Theme

```bash
npx expo install @react-native-async-storage/async-storage
```

Pattern: `ThemeProvider` (Context) + `useTheme()` + `AsyncStorage` for persistence + `useColorScheme()` for OS preference.

```ts
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_KEY = 'app_theme_mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  const effective = mode === 'system'
    ? (systemScheme === 'light' ? 'light' : 'dark')
    : mode;

  const setMode = useCallback(async (next: ThemeMode) => {
    await AsyncStorage.setItem(THEME_KEY, next);
    setModeState(next);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') setModeState(saved);
    });
  }, []);

  return <ThemeContext.Provider value={{ mode, effective, setMode }}>{children}</ThemeContext.Provider>;
}
```

> Full agent-ui theme (ThemeColors, buildDark/buildLight, hexToRgba, makeStyles) → `.github/skills/agent-ui/SKILL.md`.

---

## 9. Voice Input

```bash
npx expo install expo-audio expo-speech expo-haptics expo-speech-recognition
```

`app.json` plugins:
```json
["expo-audio", {
  "microphonePermission": "Allow <App> to use the microphone."
}],
["expo-speech-recognition", {
  "microphonePermission": "Allow <App> to use the microphone.",
  "speechRecognitionPermission": "Allow <App> to use speech recognition."
}]
```

**iOS infoPlist** (under `expo.ios` in `app.json`):
```json
"infoPlist": {
  "NSSpeechRecognitionUsageDescription": "Used for Push to Talk.",
  "NSMicrophoneUsageDescription": "Used for Push to Talk."
}
```

**Android permissions** (under `expo.android` in `app.json`):
```json
"permissions": ["android.permission.RECORD_AUDIO", "android.permission.MODIFY_AUDIO_SETTINGS"]
```

### Push-to-talk pattern

```tsx
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useRef, useState } from 'react';

const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'processing'>('idle');
const [liveText, setLiveText] = useState('');
const finalRef = useRef('');

// "start" = recognition started (NOT onPressIn — native delay ~50-200ms)
useSpeechRecognitionEvent('start', () => setVoiceState('listening'));

// result: use isFinal to distinguish interim from final
useSpeechRecognitionEvent('result', (event) => {
  const text = event.results[0]?.transcript ?? '';
  setLiveText(text);
  if (event.isFinal) finalRef.current = text;
});

// "end" fires after stop() AND abort()
useSpeechRecognitionEvent('end', () => {
  const text = finalRef.current.trim();
  if (text) onTranscript(text);
  finalRef.current = '';
  setVoiceState('idle');
  setLiveText('');
});

// "aborted" and "no-speech" are expected — do not show error
useSpeechRecognitionEvent('error', (event) => {
  if (event.error !== 'aborted' && event.error !== 'no-speech') {
    setTimeout(() => setVoiceState('idle'), 5000);
  }
});

const startRecognition = async () => {
  const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  if (!granted) return;
  ExpoSpeechRecognitionModule.start({
    lang: config.locale,
    interimResults: true,
    continuous: false,
    addsPunctuation: true,
    contextualStrings: config.contextualStrings,
    iosTaskHint: 'dictation',
    iosCategory: {
      category: 'playAndRecord',
      categoryOptions: ['defaultToSpeaker', 'allowBluetooth'],
      mode: 'measurement',
    },
  });
};

const stopRecognition = () => {
  if (voiceState === 'listening') ExpoSpeechRecognitionModule.stop();
  else ExpoSpeechRecognitionModule.abort();
};
```

**STT Web:**
```ts
// useSpeechRecognition.ts — web branch
if (Platform.OS === 'web') {
  const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) return { supported: false };
  const recognition = new SpeechRecognition();
  recognition.lang = config.locale;
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.onresult = (event) => { /* accumulate transcript */ };
  recognition.onend = () => { /* call onTranscript(final) */ };
}
```

### TTS

```tsx
import * as Speech from 'expo-speech';

const ttsEnabledRef = useRef(false);  // ref avoids re-render during streaming

const speakResponse = useCallback((text: string) => {
  if (!ttsEnabledRef.current) return;
  const clean = text.replace(/[*_`#>~\[\]]/g, '').trim();
  if (!clean) return;
  Speech.stop();
  setIsSpeaking(true);
  Speech.speak(clean, {
    language: config.locale,
    onDone: () => setIsSpeaking(false),
    onError: () => setIsSpeaking(false),
    onStopped: () => setIsSpeaking(false),
  });
}, [config.locale]);

// Toggle
const toggleTts = () => {
  ttsEnabledRef.current = !ttsEnabledRef.current;
  setTtsEnabled(ttsEnabledRef.current);
  if (!ttsEnabledRef.current) Speech.stop();
};

// Cleanup on unmount
useEffect(() => () => { Speech.stop(); }, []);
```

---

## 10. Layout — React Native

No HTML/CSS. Use `StyleSheet` only:

```tsx
import { View, Text, TextInput, FlatList, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';

const styles = StyleSheet.create({
  container: { flex: 1 },
  input: {
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
});
```

**Keyboard** (prevent iOS keyboard from covering input):
```tsx
<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : undefined}
  style={{ flex: 1 }}
>
  {/* content + input */}
</KeyboardAvoidingView>
```

**Safe area** (iPhone notch, Android gesture bar):
```tsx
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
```

**FlatList for chat** (virtualized — do not use ScrollView):
```tsx
<FlatList
  ref={flatListRef}
  data={messages}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <ChatMessage message={item} />}
  onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
/>
```

---

## 11. Environment Variables

Prefix **`EXPO_PUBLIC_`** (not `VITE_`, not `NEXT_PUBLIC_`):
```bash
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_AGENT_NAME=My Agent
EXPO_PUBLIC_AUTH_MODE=none
EXPO_PUBLIC_LOCALE=it-IT
EXPO_PUBLIC_PRIMARY_COLOR=#b2d600
```

Access: `process.env['EXPO_PUBLIC_*']` (not `import.meta.env`).

**Secrets** (do not expose to client) — EAS Secrets:
```bash
eas secret:create --scope project --name MY_SECRET --value "value"
```

---

## 12. Device Testing — Expo Go vs native build

```bash
npx expo start                          # dev server + QR code
npx expo start --ios                    # iOS simulator (Expo Go)
npx expo run:ios                        # local native build (PTT/SSE working)
npx expo run:android                    # local native build Android
eas build --platform android --profile preview  # internal APK
eas update --channel production         # OTA update without store
```

| Command | OAuth | SSE streaming | expo-speech-recognition |
|---|---|---|---|
| `expo start --ios` (Expo Go) | ❌ | ❌ | ❌ |
| `expo run:ios` (build nativa) | ✅ | ✅ | ✅ |
| EAS build | ✅ | ✅ | ✅ |

**Runtime detection:**
```ts
import Constants from 'expo-constants';
const isExpoGo = Constants.appOwnership === 'expo';
// show PTT fallback if Expo Go
```

**⚠️ PTT does not work in Expo Go** — `expo-speech-recognition` requires native build. Use `npx expo run:ios` for voice development.

---

## 13. EAS Build

```json
// eas.json
{
  "cli": { "version": ">= 16.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  }
}
```

---

## 14. Markdown

```bash
yarn add react-native-markdown-display
```

```tsx
import Markdown from 'react-native-markdown-display';

<Markdown
  style={{ body: { color: colors.textPrimary, fontSize: 15 } }}
  rules={{
    fence: (node) => {
      // extend: add custom renderer per language
      return <Text key={node.key}>{node.content}</Text>;
    },
  }}
>
  {message.content}
</Markdown>
```

---

## 15. ⚠️ Critical Rules

### expo/fetch — SSE
- `import { fetch } from 'expo/fetch'` — required for ReadableStream
- Global RN fetch does not support streaming → silent failure
- **Expo Go does not support `expo/fetch`** → native build required

### iOS URLSession batching
- iOS delivers many SSE tokens per `reader.read()`
- React 19 batches `setState` inside loop → UI not updated during streaming
- **Fix**: mutable buffer (`useRef`) + `setInterval(16ms)` flush — see § 7

### SSE line buffer
- iOS can split SSE mid-line → buffer required: `buffer += decoded; lines = buffer.split('\n'); buffer = lines.pop()`
- Without buffer: `JSON.parse` fails on incomplete lines → lost tokens

### resolveApiUrl — iOS device
`localhost` does not reach Mac from physical device — use LAN IP:
```bash
ipconfig getifaddr en0  # find Mac IP
# or: resolveApiUrl() auto-detects from Constants.expoConfig.hostUri
```

### React Native is not a browser
- No `<div>`, `<p>`, `<span>` — use `<View>`, `<Text>`, `<ScrollView>`
- No CSS/SCSS — use `StyleSheet.create()`
- All text must be inside `<Text>`, not directly in `<View>`

### Audio session — STT + TTS coexistence
- `iosCategory: { category: 'record' }` blocks TTS after recording
- **Always use `playAndRecord` + `defaultToSpeaker`** when STT and TTS coexist
- `defaultToSpeaker` valid ONLY with `playAndRecord` — with `record` causes AudioSession error

### expo-speech-recognition — gotchas
- `requiresOnDeviceRecognition: true` causes timeout on iOS simulator — **omit it**
- Set `recognizing` state in `'start'` event, NOT in `onPressIn` (native delay ~50-200ms)
- Call `onTranscript` in `'end'` event, NOT in `'result'` (use `isFinal` only to update the ref)
- `'aborted'` and `'no-speech'` are expected — do not show to user

### Environment variables
- Prefix `EXPO_PUBLIC_` (not `VITE_`, not `NEXT_PUBLIC_`)
- Not accessible dynamically — Metro tree-shakes at build time

### Native rebuild required
After changing plugins in `app.json` (permissions, scheme, config plugins):
```bash
npx expo run:ios  # regenerates build with new native permissions
# OTA update (eas update) is NOT sufficient for native changes
```

### FlatList vs ScrollView
- Long lists → always `FlatList` (virtualized)
- `ScrollView` with many items → memory leak + perf degradation
