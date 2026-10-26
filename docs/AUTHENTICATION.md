# Authentication — Round 2

Four apps use the existing `/api/v1` API on Render. There is no OAuth provider, EAS dependency, mobile database, SMS bill, or additional server. The web v0.19.0 API supplies opaque bearer sessions with seven-day expiry and single-use renewal. Native requests omit browser cookies and reject redirects.

## Endpoint mapping

| Endpoint                    | App behavior                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `GET auth/options`          | Checks whether Telegram is configured; password login stays available if this read fails             |
| `POST auth/password`        | Sends identifier/password and the installed app's fixed role                                         |
| `POST auth/otp/request`     | Normalizes an Ethiopian phone and requests a generic, non-enumerating Telegram code response         |
| `POST auth/otp/verify`      | Sends the phone, six-digit code and fixed role; successful verified sessions pass runtime validation |
| `POST auth/telegram/invite` | Creates a short-lived link; validates the exact HTTPS `t.me` bot URL/start token before opening it   |
| `POST auth/telegram/status` | Explicit user check after sharing their own contact with the bot; no background polling              |
| `POST auth/signup`          | Client app only, after verified signup-ready status; name and invite stay in memory                  |
| `GET me`                    | Verifies the saved/foreground session and installed role before showing private routes               |
| `POST auth/session/renew`   | Rotates a valid session and persists the replacement; no renewal retry loop                          |
| `DELETE auth/session`       | Revokes this credential; local sign-out happens even if server revocation cannot be confirmed        |
| `GET me/security`           | Loads password/Telegram state without returning password hashes                                      |
| `PATCH me/password`         | Sets/changes a password; the backend keeps this session and removes other sessions                   |
| `DELETE me/sessions`        | Confirmation required; signs out all sessions, including website and current app                     |
| `DELETE me/telegram`        | Confirmation required; disabled until a password exists, with backend enforcement too                |

Telegram link possession is **never** a sign-in credential for an existing account. A `linked` response leads back to OTP request/verification. Only the Client app offers signup; staff identities are provisioned by an administrator. Existing account access still requires the API to approve the account's active status/role/linked operational identity.

## Persistence and lifecycle

Only opaque tokens are stored, via Expo SecureStore on Android/iOS. Passwords, OTPs, invites, personal identity and expiry are not written to AsyncStorage, browser storage, URLs or application logs. SecureStore service namespaces contain role, build variant and backend origin. No shared keychain access group is enabled. iOS uses `WHEN_UNLOCKED_THIS_DEVICE_ONLY`; Android encrypted preferences are excluded from backup by the SecureStore config plugin. This release does not add biometric prompts.

The web preview keeps tokens only in the controller's memory. Reloading or opening a new page context requires sign-in again. This deliberately differs from native restoration; do not use a browser reload as a native secure-storage test. Language remains a device-local preference and is not silently synchronized to the account.

On bootstrap, the app reads secure storage with a five-second UI deadline, then calls `me`. No private content appears before server validation. A transient network/server failure preserves the credential and shows a locked retry/sign-out screen. A definitive 401/403, expired identity or wrong role removes access. Authenticated route history is guarded by Expo Router; installation of a role-specific app does not replace backend authorization.

Leaving the foreground hides authenticated content and invalidates in-flight session operations. Returning validates again. While foregrounded, a 30-second timer checks the expiry/renewal threshold. A session within 24 hours of expiry is revalidated and renewed with a single in-flight validation. Explicit renewal is available in Account & security. Renewals are not retried automatically after an ambiguous network failure; retry revalidates the saved credential, and an already consumed token will require login.

Session epochs and serialized native writes prevent stale 401s, delayed sign-ins or late storage completions from reopening a session after logout. A native write remains in the queue after a UI timeout so a later deletion cannot be overtaken. If deletion fails, the app stays locked; retry attempts deletion and does not restore the credential. Restart may be needed for a permanently stuck native bridge. If local sign-out succeeds but remote revocation fails, the app explains that the server session may remain valid and directs the user to revoke all devices once connected.

## Forms and recovery

- API calls allow up to 90 seconds for Render cold starts. Password/OTP requests expose cancellation and do not auto-submit or auto-retry writes.
- OTP resend cooldown is independent of verification: a received code can be used immediately. Server 429 responses impose the returned Retry-After duration; the UI shows a countdown.
- Credentials are cleared after attempts and when switching login methods. Password changes require matching confirmation and 8+ characters within the backend's 72-byte UTF-8 limit.
- Existing-password changes require the current password. Accounts without one can set one after authenticated phone proof. There is no new email/SMS recovery service; use verified Telegram or contact the office.
- Backend exception messages are not rendered. Known failure codes map to bilingual, bounded product messages. Error-state actions remain explicit.
- Invite status checks do not authenticate or create users. Expired invites can be replaced; canceled signup may have completed server-side, so the user should use OTP/password rather than repeatedly creating accounts.

## Device acceptance

Automated contract fixtures cannot prove production credentials, Telegram delivery, device keystore behavior or physical-device lifecycle transitions. Before rollout, use authorized test accounts for all roles, verify native cold restart/foreground validation, disable/revoke access from the web, exercise actual Telegram own-contact verification and Client signup, test offline logout/recovery, and confirm Android/iOS keyboard, accessibility and font scaling. See [VALIDATION.md](../VALIDATION.md) and [ACCEPTANCE.md](ACCEPTANCE.md).

References: [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/) and [Expo Router protected routes](https://docs.expo.dev/router/advanced/protected/). iOS Keychain may retain credentials across uninstall/reinstall with the same bundle ID; server revalidation still applies. Never promise uninstall alone revokes a server session.
