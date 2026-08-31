# Play Store release checklist

## Current local candidate

The locally generated `1.2.0` release candidate was verified on 2026-08-31:

- Artifact: `dist/FlowSight-Android-1.2.0.aab`
- Size: 31,557,199 bytes (30.1 MiB before Play delivery splitting)
- SHA-256: `6844988E5DAEE2A8FD600715159F321FD617F4D64D883F718E9A86FB806EF341`
- Upload certificate SHA-256: `48:BF:2C:29:BF:46:AE:57:CD:6E:AE:68:1F:A7:C5:08:2F:6E:1C:F9:1A:B8:56:7A:F8:6A:12:28:1C:9D:88:76`
- Bundletool validation: passed with bundletool 1.18.1
- Standalone release smoke test: passed on the API 36 `Phone_android` emulator with Metro stopped
- Store screenshots: five PNG files at 1080 x 2160 in `store-assets/screenshots/phone/`

The signing certificate is intentionally self-signed, as Android upload/app-signing certificates normally are. Keep the keystore and passwords outside Git and back them up securely.

## Automated checks

- [ ] `npm ci`
- [ ] `npm run verify`
- [ ] `npx expo-doctor@latest`
- [ ] `npm run export:android`
- [ ] Native debug APK builds and installs on the API 36 emulator
- [ ] Production AAB builds with the upload key
- [ ] `bundletool validate --bundle <app-release.aab>` succeeds
- [ ] `bundletool dump manifest --bundle <app-release.aab> --module base` reports target SDK 36

## Device acceptance

- [ ] Fresh install completes onboarding without an account
- [ ] The Usage Access disclosure appears before Android Settings
- [ ] Denying Usage Access leaves the timer fully functional
- [ ] Granting Usage Access makes the next Start-to-Stop session show time by app
- [ ] Pause/resume, process backgrounding, process restart, and Stop behave correctly
- [ ] System Back and predictive Back never trap the user
- [ ] Light theme, dark theme, 1.3× font scale, portrait, landscape, and a tablet/expanded window are readable
- [ ] Sign-in/register, opt-in sync, export, local deletion, and account deletion work against production backend
- [ ] Test on at least one physical Android device before production rollout

## Play Console setup

1. Create the app with package name `ai.flowsight.mobile`. Package names cannot be changed after the first upload.
2. Register/configure the Android app separately in EAS; do not attach it to the iOS repository's push remote.
3. Enrol in Play App Signing and retain the local upload key backup securely.
4. Upload the `.aab` to Internal testing first.
5. Complete App access, Ads, Content rating, Target audience, Data safety, Government apps, Financial features, Health apps, and the permission declarations Play Console requests.
6. Publish `PRIVACY.md` and an account-deletion page at public HTTPS URLs.
7. Add the store icon, feature graphic, phone screenshots, short description, and full description from `store-assets/`.
8. For a newly created personal developer account, complete Google's required closed test and device verification before requesting production access.

## Release configuration

- Application ID: `ai.flowsight.mobile`
- Version name: `1.2.0`
- Version code: `1`
- Minimum SDK: `24`
- Compile/target SDK: `36`
- Artifact: Android App Bundle (`.aab`)
- Release track for first upload: Internal testing / draft

## External credentials still required

- Google Play Console developer account
- EAS account/project link if EAS Build/Submit is used
- Play service-account JSON for non-interactive EAS Submit
- Public support email, privacy URL, and account-deletion URL
- Final legal approval of the privacy policy and Data safety answers
