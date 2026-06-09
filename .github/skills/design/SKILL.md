---
name: design
description: >
  Create distinctive, production-grade UI for web (React/HTML) or mobile apps (React Native/Expo).
  Load when the user asks to build screens, components, pages, or any visual interface.
applyTo: "**"
---

This skill guides creation of distinctive, production-grade interfaces that avoid generic AI aesthetics.
Implement real working code with exceptional attention to detail and intentional creative choices.

## Step 0 — Detect Platform

Before anything else, determine the target platform from context (imports, file path, package.json):

| Signal | Platform | Rules section to follow |
|---|---|---|
| `StyleSheet`, `View`, `Text`, `TouchableOpacity`, `.tsx` in `app/(protected)/` or Expo project | **React Native / Expo** | → Mobile App Design |
| `className`, `style={}`, `.css`, HTML tags, `next.config`, Vite/CRA | **Web** | → Web Frontend Design |

Never mix paradigms: no CSS variables in RN, no `StyleSheet` in web.

---

## Design Thinking (all platforms)

Before writing a single line, commit to a clear aesthetic direction:

1. **Purpose**: What problem does this screen/component solve? Who uses it?
2. **Tone**: Choose one direction and push it fully:
   - Brutally minimal · Maximalist · Retro-futuristic · Luxury/refined
   - Playful/toy-like · Editorial · Industrial/utilitarian · Organic/natural
   - Soft/pastel · Dark/dramatic · Clinical/precise · Bold/athletic
3. **Differentiation**: What is the ONE thing a user will remember about this screen?
4. **Constraints**: Platform limits, accessibility, performance requirements.

**Rule**: Intentionality over intensity. Refined minimalism and bold maximalism both work — vague middleground does not.

---

## Mobile App Design (React Native / Expo)

### Layout Fundamentals

- **Flexbox-first**: RN uses flexbox by default. `flexDirection: 'column'` is the default (opposite to web CSS).
- **No box-shadow on Android**: use `elevation` instead. For cross-platform: `Platform.select({ ios: { shadowColor, shadowOffset, shadowOpacity, shadowRadius }, android: { elevation } })`.
- **SafeAreaView**: always wrap root screens with `SafeAreaView` from `react-native-safe-area-context` (not the core one). Use `useSafeAreaInsets()` for fine-grained control.
- **KeyboardAvoidingView**: wrap forms. Use `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`.
- **StatusBar**: set explicitly — `<StatusBar barStyle="light-content" backgroundColor="transparent" translucent />`.

### Typography

Expo fonts via `expo-font` and `useFonts` hook. Load at app root in `_layout.tsx`:

```tsx
import { useFonts } from 'expo-font';

const [loaded] = useFonts({
  'Satoshi-Regular': require('../assets/fonts/Satoshi-Regular.otf'),
  'Satoshi-Bold': require('../assets/fonts/Satoshi-Bold.otf'),
});
```

**Font choices for character** (install via `@expo-google-fonts/*`):
- Display/headings: `DM Serif Display`, `Playfair Display`, `Space Mono`, `Unbounded`, `Bebas Neue`
- Body: `DM Sans`, `Outfit`, `Plus Jakarta Sans`, `Nunito`
- Monospace/data: `JetBrains Mono`, `Space Mono`

Avoid: `System`, `Roboto`, `Arial`, `Helvetica` as primary choices.

### Color System (no CSS variables — use a constants file)

Create `constants/theme.ts`:

```ts
export const colors = {
  background: '#0A0A0F',
  surface: '#141420',
  surfaceElevated: '#1E1E2E',
  border: '#2A2A3A',
  accent: '#6EE7B7',       // primary action
  accentMuted: '#1A3D2E',
  text: '#F0F0FF',
  textMuted: '#6B6B8A',
  danger: '#F87171',
  warning: '#FBBF24',
  success: '#34D399',
} as const;

export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
} as const;

export const radius = {
  sm: 8, md: 16, lg: 24, pill: 999,
} as const;
```

**Dark-first for fitness/sport apps** — dark backgrounds with high-contrast accents are the norm, not the exception.

For system dark mode: `const scheme = useColorScheme()`. Expose via context if needed app-wide.

### Animations (react-native-reanimated)

Use `react-native-reanimated` v3 — not `Animated` from core RN, not CSS.

```tsx
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
  FadeIn, SlideInDown, ZoomIn,
} from 'react-native-reanimated';

// Entry animation on mount
<Animated.View entering={FadeIn.duration(400).delay(index * 80)}>
  ...
</Animated.View>

// Press scale feedback
const scale = useSharedValue(1);
const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
const onPressIn = () => { scale.value = withSpring(0.96); };
const onPressOut = () => { scale.value = withSpring(1); };
```

**High-impact moments**:
- Staggered list entry: `FadeIn.delay(index * 60)` on each item
- FAB press: scale + color pulse
- Screen modals/sheets: `SlideInDown`
- Number/value changes: `withTiming` on displayed value

### Visual Depth & Atmosphere

- **Gradients**: `expo-linear-gradient` for card backgrounds, headers, hero sections.
- **Blur**: `expo-blur` (`BlurView`) for modals, bottom sheets, frosted glass.
- **Noise/texture**: a semi-transparent noise PNG over a gradient background adds tactility.
- **Cards**: slightly lighter `backgroundColor` than screen + border + shadow/elevation:

```tsx
const cardStyle: ViewStyle = {
  backgroundColor: colors.surface,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: colors.border,
  ...Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
    android: { elevation: 8 },
  }),
};
```

### Common App Patterns

**Bottom Sheet / Modal**:
- Complex sheets with snap points: `react-native-bottom-sheet`.
- Simple modals: `Modal` from RN core + `SlideInDown` from Reanimated.

**Lists**:
- Always `FlatList` or `SectionList` — never `ScrollView` + `.map()` for lists > 20 items.
- `keyExtractor` must use stable IDs (not indices for mutable lists).
- `getItemLayout` for fixed-height rows (performance).

**FAB (Floating Action Button)**:
```tsx
<Animated.View style={[fabStyle, animStyle]} entering={ZoomIn.delay(300)}>
  <TouchableOpacity onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}
    accessibilityRole="button" accessibilityLabel="Add entry">
    <Ionicons name="add" size={28} color={colors.text} />
  </TouchableOpacity>
</Animated.View>

// fabStyle:
position: 'absolute', bottom: 32, right: 24,
width: 56, height: 56, borderRadius: 28,
backgroundColor: colors.accent,
justifyContent: 'center', alignItems: 'center',
elevation: 8,
```

**Empty state**: always design — centered illustration/icon + heading + CTA. Not just absent.

**Loading skeleton**: animated placeholder boxes (`withRepeat(withTiming)` on opacity) over spinners for list/card content.

**Pull-to-refresh**: `RefreshControl` on `FlatList` `refreshControl` prop.

**Tab bar**: set in layout with `tabBarStyle`, `tabBarActiveTintColor`, `tabBarInactiveTintColor`. Add `tabBarBackground` for blur on iOS.

### Accessibility (React Native)

- **Valid `accessibilityRole` values**: `button`, `link`, `header`, `image`, `none`, `text`, `checkbox`, `radio`, `switch`, `tab`, `adjustable`, `summary`, `alert`, `combobox`, `menu`, `menubar`, `menuitem`, `progressbar`, `search`, `spinbutton`, `timer`, `toolbar`. **`"note"` is NOT valid — causes tsc error.**
- Icon-only buttons: `accessibilityLabel="Close"` + `accessibilityRole="button"`.
- Decorative icons: `importantForAccessibility="no"` (Android) / `accessible={false}` (iOS).
- Every `TextInput` must have `accessibilityLabel`.
- Minimum touch target: 44×44pt.

---

## Web Frontend Design (React / HTML / CSS)

### Typography

Pair a distinctive display font with a refined body font:
- **Display**: `Playfair Display`, `Cormorant`, `Bebas Neue`, `Anton`, `Cinzel`, `Abril Fatface`
- **Body**: `DM Sans`, `Outfit`, `Lato`, `Source Serif 4`, `Literata`

Avoid: `Inter`, `Roboto`, `Arial`, `system-ui` as primary display choices.

### Color & Theme

- CSS variables in `:root` for the entire token system.
- Dominant background + single sharp accent outperforms balanced multi-color.
- Commit: light or dark. Mixed-mode only if intentional.

### Motion (CSS + React)

- CSS-first: `transition`, `@keyframes`, `animation-delay` for staggered reveals.
- React: Motion library (`motion/react`) for complex sequences.
- One well-orchestrated page-load > scattered micro-interactions.
- Surprise with hover: scale, color shift, underline reveal, clip-path morph.

### Spatial Composition

- Asymmetry over symmetry. Overlap. Break the grid intentionally.
- Generous negative space OR controlled density — never accidental middle ground.
- Diagonal flow, sticky headers, sticky sidebars for hierarchy.

### Backgrounds & Visual Depth

- Gradient meshes, noise textures, geometric SVG patterns.
- `backdrop-filter: blur()` for glass layers.
- Dramatic drop shadows on hero elements.
- Never: flat white/gray with no atmosphere.

---

## Anti-Patterns (all platforms)

| Anti-pattern | Why |
|---|---|
| Inter / Roboto / Arial as primary display font | Generic AI default |
| Purple-blue gradient on white | Clichéd |
| Flat gray cards on white, no depth | No atmosphere |
| Centered card on gradient — "the SaaS layout" | Predictable |
| `console.log` handlers or `// TODO` in UI | Unfinished feature |
| `accessibilityRole="note"` in React Native | Invalid — tsc error |
| `ScrollView` + `.map()` for long RN lists | Performance |
| `box-shadow` on Android without `elevation` | Android renders nothing |
| Same aesthetic repeated across all screens | No differentiation |

---

## Delivery Checklist

- [ ] Platform detected — no CSS in RN, no StyleSheet in web
- [ ] Color tokens in `constants/theme.ts` (RN) or CSS vars (web)
- [ ] Fonts loaded correctly for platform
- [ ] `accessibilityLabel` / `aria-label` on all icon-only interactives
- [ ] No `console.log` handlers
- [ ] Animations: Reanimated (RN) or Motion/CSS (web)
- [ ] `SafeAreaView` + `KeyboardAvoidingView` on RN forms/screens
- [ ] Empty states designed
- [ ] Dark/light theme consistent across all new components