# Play Store release checklist

## Current local candidate

The Play-ready `1.2.0` release candidate was rebuilt and verified on 2026-09-26 after Google Play reported that version code `1` had already been used:

- Artifact: `dist/FlowSight-Android-1.2.0-vc2-play.aab`
- Size: 31,557,430 bytes (30.1 MiB before Play delivery splitting)
- SHA-256: `A75691E555C00D838CDF4641C6DB26B5493BC752911214E025316F63364E8928`
- Upload certificate SHA-256: `48:BF:2C:29:BF:46:AE:57:CD:6E:AE:68:1F:A7:C5:08:2F:6E:1C:F9:1A:B8:56:7A:F8:6A:12:28:1C:9D:88:76`
- Bundletool validation: passed with bundletool 1.18.1
- Google Play processing: passed in the open-testing draft as version `2 (1.2.0)`, target SDK 36, with the two production ARM ABIs
- Standalone release smoke test: passed on the API 36 `Phone_android` emulator with Metro stopped
- Store screenshots: five promotional `promo-*.png` files at 1080 x 2160 in `store-assets/screenshots/phone/`, built from the real emulator captures with the reusable `store-assets/screenshots/marketing-template.html` layout; saved in Play in focus, insights, controls, onboarding, and privacy order
- Store icon: opaque 512 x 512 PNG at `store-assets/play-icon.png`, with a pure white (`#FFFFFF`) background; saved in the default Play Store listing and ready to send for review

The signing certificate is intentionally self-signed, as Android upload/app-signing certificates normally are. Keep the keystore and passwords outside Git and back them up securely.

## Automated checks

- [ ] `npm ci`
- [x] `npm run verify` (59 tests passed on 2026-09-26)
- [x] `npx expo-doctor@latest` (18/18 checks passed on 2026-09-26)
- [ ] `npm run export:android`
- [ ] Native debug APK builds and installs on the API 36 emulator
- [x] Production AAB builds with the upload key
- [x] `bundletool validate --bundle <app-release.aab>` succeeds
- [x] `bundletool dump manifest --bundle <app-release.aab> --module base` reports target SDK 36

## Device acceptance

- [ ] Fresh install completes onboarding without an account
- [ ] The Usage Access disclosure appears before Android Settings
- [ ] Denying Usage Access blocks Start and Resume; recording remains idle or paused
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
- Version code: `2`
- Minimum SDK: `24`
- Compile/target SDK: `36`
- Artifact: Android App Bundle (`.aab`)
- Release track for first upload: Internal testing / draft

## External credentials still required

- Google Play Console developer account
- EAS account/project link if EAS Build/Submit is used
- Play service-account JSON for non-interactive EAS Submit
- Public support email: `privacy@flowsight.site`
- Privacy URL: `https://flowsight.site/privacy-policy`
- Account-deletion URL: `https://flowsight.site/delete-account`
- Final legal approval of the privacy policy and Data safety answers

## Release 1.4.0 (2026-10-04)

- Version code 3; target SDK 36; armeabi-v7a and arm64-v8a.
- Settings begins with recording permissions and system settings access.
- Start/Resume require Usage Access; revoked permission pauses recording and recovery.
- Three-button navigation, narrow layouts and larger text remain usable.
- Private cross-device sync is disabled pending the coordinated FlowSight 6.0 rollout. Settings shows availability; no legacy plaintext uploader is used.
- Lint/TypeScript and 80 tests pass. Signed standalone APK and AAB are distributed on GitHub. The AAB must be uploaded to Play separately; this is not a Play Store production rollout.
