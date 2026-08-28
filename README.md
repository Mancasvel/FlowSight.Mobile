# FlowSight Mobile

**Privacy-first work activity tracking for iPhone.**

Companion app to [FlowSight Desktop](https://github.com/Mancasvel/FlowSight.AI) — tracks focus time, identifies work patterns, and provides AI coaching, all while keeping your data private. iOS only (iPhone, iOS 16+).

---

## Tech Stack

### Frontend — iPhone

| Technology | Version | Purpose |
|-----------|---------|---------|
| **React Native** | 0.79 | Native UIKit UI |
| **Expo SDK** | 53 | Toolchain, native modules, EAS Build |
| **Expo Router** | v5 | File-based routing with typed routes |
| **TypeScript** | 5.8 | Strict mode |
| **React** | 19.0 | UI library |

### State & Data

| Technology | Purpose |
|-----------|---------|
| **expo-sqlite** | Local offline database — stores activity events, sync queue, preferences, coach history |
| **expo-secure-store** | Secure token storage — Keychain |
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

### Native (iPhone)

| Module | Implementation |
|--------|----------------|
| **flowsight-device-activity** | Swift — Family Controls / DeviceActivity report |
| **Auth** | ASWebAuthenticationSession |
| **Storage** | Keychain |

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
| **XCUITest** | Native module tests (permissions, Keychain) |

### Build & Deploy

| Tool | Purpose |
|------|---------|
| **EAS Build** | Cloud iPhone builds (development, preview, production) |
| **EAS Submit** | App Store submission |
| **GitHub Actions** | CI — lint, typecheck, test |

---

## Features

- **Manual timer** — Start/stop focus sessions; iOS Screen Time report after Stop (native build)
- **Deep Focus detection** — Canonical semantics ported from the desktop Rust agent
- **Insights** — Daily/weekly summaries, category breakdowns, fragmentation metrics
- **AI Coach** — Cloud-powered work pattern coaching (requires subscription)
- **Integrations** — Jira, Linear, Notion (requires subscription)
- **Offline-first** — All data stored locally, syncs when online
- **Privacy-first** — Per-purpose consent, no screenshots, no keystrokes

---

## Quick Start (iPhone)

Expo Go cannot read Screen Time. Use a native development build on a physical iPhone.

```bash
npm install
cp .env.example .env
# Fill EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY

# One-time: generate native iOS project and install on a connected iPhone
npx expo prebuild -p ios
npx expo run:ios --device

# Later sessions (native app already installed)
npm start
```

In Xcode, enable **Family Controls (Development)** on:

- `ai.flowsight.mobile`
- `ai.flowsight.mobile.DeviceActivityReport`
- `ai.flowsight.mobile.DeviceActivityMonitor`

First Start: Screen Time permission, then pick apps once. Stop shows time per app.

## Testing

```bash
npm test
npm run typecheck
```

## App Store

1. In [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list), enable Family Controls on the three App IDs above. For TestFlight/App Store, request [Family Controls distribution](https://developer.apple.com/contact/request/family-controls-distribution) for each ID.
2. Set `submit.production.ios.ascAppId` in `eas.json` to your App Store Connect app id.
3. Build and submit:

```bash
npm run build:production:ios
npm run submit:ios
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
│       ├── ios/                  # Swift — Family Controls + report extension
│       └── src/                  # JS API
├── __tests__/                    # Unit tests (focus-spec, contracts, format, timer)
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
- **Secure storage** — Tokens in Keychain, never AsyncStorage
- **No secrets in bundle** — Only EXPO_PUBLIC_* variables (Supabase URL + anon key)

See [PRIVACY.md](PRIVACY.md) for the full privacy notice.

---

## Related Repositories

| Repository | Purpose |
|-----------|---------|
| [FlowSight.AI](https://github.com/Mancasvel/FlowSight.AI) | Desktop agent (Tauri + Rust + Windows) |
| [FlowSight.Mobile](https://github.com/Mancasvel/FlowSight.Mobile) | iPhone app (React Native + Expo) — this repo |

---

## License

AGPL-3.0 — See [LICENSE](LICENSE)
