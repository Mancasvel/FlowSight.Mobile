FlowSight Mobile 1.4.0 improves navigation in Settings, recording authorization and small-screen layouts.

- Permissions is the first Settings card, with Screen Time access, measured-app selection and the system Settings shortcut.
- Start and Resume require authorization. A failed permission check or native capture leaves recording stopped or paused.
- Revoked permission pauses recording when the app returns to the foreground. Recovery remains paused until access is restored.
- Timer controls wrap and labels fit large text. Touch targets and safe-area spacing keep controls accessible.
- Recording ownership and session history remain scoped to the active account.
- The on-device AI features introduced in 1.3.0 remain available.

Private phone/computer synchronization is prepared for the FlowSight 6.0 vault, but is disabled in this release. Settings explains its availability. The feature requires a coordinated backend and compatible desktop rollout. This release does not deploy that migration or encrypt existing plaintext history. Local history continues to use the existing SQLite database.

Version: 1.4.0. iOS build number: 6. Android version code: 3.

Android artifacts use the existing upload key, target SDK 36, armeabi-v7a and arm64-v8a. The APK installs directly; the AAB is for Play Console. Google Play can re-sign store distributions, so the APK may not replace an installed app with another certificate. Retain existing data; do not uninstall to force an update.

GitHub release/downloads are separate from Play Store/App Store publication. An iOS source tag is not an IPA or a TestFlight submission. The workflow reports a missing Expo token explicitly and submits only the build it just created.

Local validation: Android lint, TypeScript and 80 tests passed; iPhone TypeScript and 106 tests passed. Native iPhone validation remains pending.
