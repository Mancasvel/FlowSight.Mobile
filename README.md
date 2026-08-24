# FlowSight Mobile

**Privacy-first work activity tracking for iOS and Android.**

Companion app to [FlowSight Desktop](https://github.com/Mancasvel/FlowSight.AI) — tracks focus time, identifies work patterns, and provides AI coaching, all while keeping your data private.

---

## Tech Stack

### Frontend — Cross-Platform Native

| Technology | Version | Purpose |
|-----------|---------|---------|
| **React Native** | 0.79 | Native UI framework — compiles to real iOS (UIKit) and Android (Views) components, not WebView |
| **Expo SDK** | 53 | Build toolchain, native module system, OTA updates, EAS Build |
| **Expo Router** | v5 | File-based routing with typed routes, deep links, and universal links |
| **TypeScript** | 5.6 | Strict mode, zero `any`, full type safety across the codebase |
| **React** | 19.0 | UI library with concurrent features |

### State & Data

| Technology | Purpose |
|-----------|---------|
| **expo-sqlite** | Local offline database — stores activity events, sync queue, preferences, coach history |
| **expo-secure-store** | Secure token storage — backed by Keychain (iOS) and Android Keystore |
| **Supabase JS** | Auth (PKCE), Postgres queries, Edge Functions, Realtime |
| **Zustand** | Minimal state management for ephemeral UI state only (no remote data duplication) |
| **Zod** | Runtime payload validation at all network/storage boundaries |

### UI & Motion

| Technology | Purpose |
|-----------|---------|
| **react-native-reanimated** | 60fps animations running on the native UI thread |
| **react-native-gesture-handler** | Native gesture recognition (swipe, pan, pinch) |
| **react-native-svg** | Charts and data visualization (no heavy charting library) |
| **expo-haptics** | Discrete haptic feedback on timer start/pause/stop |
| **expo-localization** | i18n ready, English as canonical language |

### Native Modules (Platform-Specific)

| Module | iOS | Android |
|--------|-----|---------|
| **flowsight-device-activity** | Swift — Family Controls / Screen Time API | Kotlin — UsageStatsManager |
| **Auth** | ASWebAuthenticationSession | Custom Tabs |
| **Storage** | Keychain | Android Keystore |

### Backend

| Technology | Purpose |
|-----------|---------|
| **Supabase Auth** | Email/password + Google OAuth with PKCE flow |
| **Supabase Postgres** | Cloud data with Row Level Security (RLS) |
| **Supabase Edge Functions** | AI Coach (Azure OpenAI), Insights (OpenRouter), Notion OAuth, Privacy rights |
| **Supabase Storage** | File storage (if needed) |

### Testing

| Tool | Purpose |
|------|---------|
| **Vitest** | Unit tests for pure logic (focus-spec, contracts, format) |
| **React Native Testing Library** | Component tests |
| **Maestro** | E2E flow tests |
| **XCUITest / Espresso** | Native module tests (permissions, secure storage) |

### Build & Deploy

| Tool | Purpose |
|------|---------|
| **EAS Build** | Cloud builds for iOS and Android with 3 channels (development, preview, production) |
| **EAS Submit** | Automated submission to App Store and Play Store |
| **GitHub Actions** | CI/CD — lint, typecheck, test, build on every push |

---

## Features

- **Manual timer** — Start/stop focus sessions with category labels
- **Deep Focus detection** — Canonical semantics ported from the desktop Rust agent
- **Insights** — Daily/weekly summaries, category breakdowns, fragmentation metrics
- **AI Coach** — Cloud-powered work pattern coaching (requires subscription)
- **Integrations** — Jira, Linear, Notion (requires subscription)
- **Offline-first** — All data stored locally, syncs when online
- **Privacy-first** — Per-purpose consent, no screenshots, no keystrokes

---

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Start development
npx expo start

# Run on specific platform
npx expo run:ios
npx expo run:android
```

## Testing

```bash
# Run all tests (43 tests)
npm test

# Run with coverage
npm run test:coverage

# Type check
npm run typecheck
```

## Building

```bash
# Preview build (TestFlight / Internal Testing)
npm run build:preview:ios
npm run build:preview:android

# Production build
npm run build:production:ios
npm run build:production:android
```

---

## Project Structure

```
FlowSight.Mobile/
├── app/                          # Expo Router screens
│   ├── (tabs)/                   # Tab navigation (Today/Insights/Coach/You)
│   ├── onboarding.tsx            # 6-step onboarding flow
│   ├── auth.tsx                  # Login/register modal
│   └── settings.tsx              # Settings screen
├── src/
│   ├── components/               # 9 reusable UI components
│   ├── hooks/                    # useTimer, useAuth
│   ├── services/                 # Business logic (10 services)
│   │   ├── auth.ts               # Supabase Auth PKCE
│   │   ├── timer.ts              # Manual timer with persistence
│   │   ├── sync.ts               # Offline-first sync queue
│   │   ├── coach.ts              # AI Coach chat
│   │   ├── entitlements.ts       # Server-side plan management
│   │   ├── integrations.ts       # Jira, Linear, Notion
│   │   ├── report.ts             # Deterministic + cloud reports
│   │   ├── profile.ts            # User profile & preferences
│   │   └── device.ts             # Device registration
│   ├── storage/                  # SQLite + SecureStore
│   ├── theme/                    # Design tokens + ThemeProvider
│   ├── contracts/                # Zod schemas + Supabase types
│   ├── focus-spec/               # Focus semantics (TS port of Rust)
│   ├── api-client/               # Supabase client wrapper
│   ├── privacy/                  # Consent, export, deletion
│   └── utils/                    # Format utilities
├── modules/
│   └── flowsight-device-activity/
│       ├── ios/                  # Swift — Family Controls
│       ├── android/              # Kotlin — UsageStatsManager
│       └── src/                  # Shared API
├── __tests__/                    # 43 tests (focus-spec, contracts, format)
├── .github/workflows/            # CI/CD (ci.yml, release.yml)
├── docs/                         # Architecture, security, DPIA
├── eas.json                      # EAS Build config
└── vitest.config.ts              # Test config
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FlowSight Mobile                      │
│                                                         │
│  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌────────┐       │
│  │ Today   │ │ Insights │ │ Coach  │ │  You   │       │
│  │ (timer) │ │ (stats)  │ │ (chat) │ │(profile│       │
│  └────┬────┘ └────┬─────┘ └───┬────┘ └───┬────┘       │
│       │           │           │          │             │
│  ┌────▼───────────▼───────────▼──────────▼───────────┐ │
│  │              Services Layer                        │ │
│  │  Timer · Sync · Coach · Report · Integrations     │ │
│  └────┬───────────┬───────────┬──────────┬───────────┘ │
│       │           │           │          │             │
│  ┌────▼───────────▼───────────▼──────────▼───────────┐ │
│  │              Storage Layer                         │ │
│  │  SQLite (offline) · SecureStore (Keychain)        │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────┘
                          │ HTTPS/TLS
                          ▼
                  ┌──────────────┐
                  │  Supabase    │
                  │  Auth · RLS  │
                  │  Edge Funcs  │
                  └──────────────┘
```

---

## Privacy

- **No screenshots** — Manual timer only, no screen capture
- **No keystrokes** — No keyboard monitoring
- **Per-purpose consent** — Tracking, sync, cloud AI, analytics are separate opt-ins
- **Local-first** — All data stored in SQLite, syncs only with consent
- **Secure storage** — Tokens in Keychain/Keystore, never AsyncStorage
- **No secrets in bundle** — Only EXPO_PUBLIC_* variables (Supabase URL + anon key)

See [PRIVACY.md](PRIVACY.md) for the full privacy notice.

---

## Related Repositories

| Repository | Purpose |
|-----------|---------|
| [FlowSight.AI](https://github.com/Mancasvel/FlowSight.AI) | Desktop agent (Tauri + Rust + Windows) |
| [FlowSight.Mobile](https://github.com/Mancasvel/FlowSight.Mobile) | Mobile app (React Native + Expo) — this repo |

---

## License

AGPL-3.0 — See [LICENSE](LICENSE)
