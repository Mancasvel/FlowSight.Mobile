# FlowSight Android

Privacy-first focus tracking for Android 7 and newer. This repository is the Android counterpart of the iPhone `FlowSight.Mobile` app and ports its `1.2.0` release at commit `41410a9`.

## Functional parity

- Start, pause, resume, stop, persist, and recover focus sessions.
- Show a local hourly timeline and recent focus-session context through Android `UsageStatsManager`.
- Match the iOS 1.2.0 three-tab experience, focus-goal editor, and optional local reminders.
- Keep per-app rows on the device; they are rendered in memory and are not saved or uploaded.
- Store timer totals locally in SQLite and sync them only after the user opts in.
- Show local session insights, recent blocks, profile state, authentication, export, local deletion, and account deletion.
- Support light/dark themes, edge-to-edge layouts, Android predictive Back, phones, tablets, rotation, and large font sizes.

The platform mechanism differs by necessity: iOS uses Family Controls and a Device Activity report extension; Android uses the system **Usage Access** screen and `UsageStatsManager`. The user-facing Start-to-Stop workflow remains the same.

## Stack and requirements

- Expo SDK 54 / React Native 0.81
- Android compile/target SDK 36 (Android 16)
- Minimum SDK 24 (Android 7)
- JDK 21 from Android Studio
- Android Studio with Platform 36, Build Tools 36.0.0, Platform Tools, Emulator, and an API 36 image

## Local setup

```powershell
npm ci
Copy-Item .env.example .env.local
# Fill EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY only.

$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:JAVA_HOME\bin;$env:Path"

npm run prebuild:android
npm run android
```

Expo Go cannot load the custom UsageStats module. Use the native development build created by `npm run android`.

The production profile enables R8, unused-resource shrinking, JavaScript bundle compression, and only the two Play Store ARM architectures. Debug builds keep the emulator architectures available.

## Usage Access flow

FlowSight explains its data use before opening Android Settings. The user must enable FlowSight under **Special app access → Usage access**. No Accessibility Service, screen capture, keystroke collection, URL history, or background polling is used.

The native module reads foreground/resume and pause/stop events for the requested on-device time window. FlowSight itself and the launcher are excluded from the report. Hourly app names and durations are aggregated in memory for the timeline and are not written to SQLite or sent to Supabase.

## Focus reminders

Focus reminders are optional. On Android 13 and newer, FlowSight requests `POST_NOTIFICATIONS` only after the user enables **Focus reminders**. The app schedules ordinary local notifications on the `focus-reminders` channel and does not request exact-alarm access.

## Verification

```powershell
npm run verify
npx expo-doctor@latest
npm run export:android
```

Native debug build:

```powershell
npm run android
```

Production Android App Bundle through EAS:

```powershell
npm run build:production:android
npm run submit:android
```

The production profile emits an `.aab` and targets API 36. Before the first Play upload, connect this project to its own EAS project and configure Android upload credentials. Never reuse the iOS repository as the Android push remote.

## Play Store handoff

See [docs/PLAY_STORE_RELEASE.md](docs/PLAY_STORE_RELEASE.md) for signing, Play Console, closed testing, account deletion, screenshots, Data safety, and release checks. The repository also includes:

- [PRIVACY.md](PRIVACY.md): publish this policy at a public URL before submission.
- [docs/DATA_SAFETY.md](docs/DATA_SAFETY.md): answers to use when completing Play Console's Data safety form.
- `store-assets/`: Play icon, feature graphic, listing copy, and validated emulator screenshots.

The locally signed and Bundletool-validated release candidate is available at `dist/FlowSight-Android-1.2.0.aab`. Its SHA-256 and upload-certificate fingerprint are recorded in the release checklist. The `dist/` directory remains ignored so binaries and signing outputs are never committed by accident.

## Repository safety

The only configured remote is `ios-source`, used as a read-only reference. Its push URL intentionally points to an invalid domain, preventing Android work from being pushed to the iOS repository by mistake.

## Privacy and security

- Only public Supabase URL/anon-key values may use the `EXPO_PUBLIC_` prefix.
- Session tokens use Android Keystore through `expo-secure-store`.
- Usage Access is optional and revocable in Android Settings.
- Cloud sync is optional and separate from Usage Access.
- Account deletion is available in-app under **You → Settings**.
- Secrets, keystores, service-account JSON files, and local environment files are ignored by Git.

## License

AGPL-3.0 — see `LICENSE`.
