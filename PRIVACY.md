# FlowSight Android Privacy Policy

Effective date: 31 August 2026

FlowSight is a focus timer and activity-insight app. It is designed to work without an account and to keep detailed Android app-usage information on the device.

## Data FlowSight processes

### Focus sessions

FlowSight stores the start time, end time, active duration, pause count, and optional task/category fields for focus sessions in a local SQLite database on the device.

### Android Usage Access

If the user explicitly enables **Usage Access** in Android Settings, FlowSight reads package names, app display names, foreground/resume events, pause/stop events, and resulting foreground duration for the interval between Start and Stop.

This access is used only to display a per-app summary for the focus session. FlowSight does not read screen contents, typed text, messages, files, web addresses, or browsing history. Per-app rows are not stored in FlowSight's database, are not included in exports, and are not uploaded or shared.

Usage Access is optional. The manual timer continues to work without it. It can be revoked at any time from Android Settings.

### Optional account and cloud sync

If the user creates an account, FlowSight processes the email address and authentication identifiers needed to provide that account. If the user separately enables cloud sync, focus-session totals and associated session metadata may be sent to the configured Supabase project over encrypted connections. Per-app Android usage rows are never included.

## Data sharing, advertising, and sale

FlowSight does not sell personal data, does not use per-app activity for advertising, and does not share per-app activity with third parties. The app contains no advertising SDK.

## Retention and deletion

Local session data remains on the device until the user deletes it, clears application storage, or uninstalls the app. **You → Settings → Delete local data** deletes local sessions and preferences.

Signed-in users can use **You → Settings → Delete account and cloud data** to request permanent deletion through the FlowSight privacy service. Android's own system usage history is controlled by Android and is not copied into FlowSight.

## Security

Authentication tokens are stored with Android Keystore through Expo SecureStore. Network traffic uses TLS. Secrets are not embedded in the application bundle.

## Children

FlowSight is a general productivity tool and is not directed to children.

## Contact

Before publication, replace this paragraph with the public support email and privacy-policy URL used in Play Console. The policy must be hosted on a publicly accessible, non-editable web page.

## Changes

Material changes will update the effective date and, when required, prompt the user for renewed consent.
