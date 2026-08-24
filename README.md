# FlowSight Mobile

**Privacy-first work activity tracking for iOS and Android.**

Companion app to [FlowSight Desktop](https://github.com/Mancasvel/FlowSight.AI) — tracks focus time, identifies work patterns, and provides AI coaching, all while keeping your data private.

## Features

- **Manual timer** — Start/stop focus sessions with category labels
- **Deep Focus detection** — Canonical semantics ported from the desktop agent
- **Insights** — Daily/weekly summaries, category breakdowns, fragmentation metrics
- **AI Coach** — Cloud-powered work pattern coaching (requires subscription)
- **Integrations** — Jira, Linear, Notion (requires subscription)
- **Offline-first** — All data stored locally, syncs when online
- **Privacy-first** — Per-purpose consent, no screenshots, no keystrokes

## Stack

- **React Native** 0.79 + **Expo SDK** 53
- **TypeScript** strict
- **Expo Router** with typed routes
- **expo-sqlite** for offline data
- **expo-secure-store** for tokens (Keychain/Keystore)
- **Supabase** for auth, cloud sync, and Edge Functions
- **Zod** for payload validation

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
# Run all tests
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

## Project Structure

```
├── app/                    # Expo Router screens
│   ├── (tabs)/            # Tab navigation
│   ├── onboarding.tsx     # Onboarding flow
│   ├── auth.tsx           # Login/register
│   └── settings.tsx       # Settings
├── src/
│   ├── components/        # Reusable UI components
│   ├── hooks/             # Custom React hooks
│   ├── services/          # Business logic
│   ├── storage/           # SQLite + SecureStore
│   ├── theme/             # Design tokens + ThemeProvider
│   ├── contracts/         # Zod schemas
│   ├── focus-spec/        # Focus semantics (TS port)
│   ├── api-client/        # Supabase client
│   ├── privacy/           # Privacy service
│   └── utils/             # Utilities
├── modules/               # Native modules
├── __tests__/             # Tests
├── .github/workflows/     # CI/CD
└── docs/                  # Documentation
```

## Architecture

See [docs/architecture.md](docs/architecture.md) for detailed architecture documentation.

## Privacy

See [PRIVACY.md](PRIVACY.md) for the privacy notice.

## License

AGPL-3.0 — See [LICENSE](LICENSE)
