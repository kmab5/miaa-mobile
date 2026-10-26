# Security boundaries

The four native apps use the existing Mi'aa bearer API. Every login/OTP request includes the installed role; runtime session validation checks the returned role, identity, token and expiry. The backend remains responsible for authorization, active accounts and active linked operational records. Protected routes only prevent local navigation into authenticated screens.

Tokens are persisted only through Expo SecureStore on native platforms, isolated by role, variant and backend origin. The browser preview stores them in memory only and signs out on reload. Only non-sensitive language preferences use AsyncStorage. Passwords, OTPs, invites and signing secrets must never be persisted there or placed in route parameters. See [authentication behavior](docs/AUTHENTICATION.md) for session races, failure states and acceptance boundaries.

Telegram invite possession permits status checks, not existing-account login. The bot must verify the user's own contact. Existing users must then prove password/OTP ownership. Only Client signup is offered; staff accounts are provisioned by an administrator. Outbound bot links require HTTPS on the exact `t.me` host with the matching start token.

Bootstrap and foreground revalidate with the server before private content is shown. Transient failures lock the workspace and keep credentials for explicit retry. Definitive unauthorized/revoked/expired sessions are removed. Logout removes local access even if remote revocation fails and reports that limitation. Secure-storage deletion failure keeps the app locked; retry attempts cleanup. Epoch checks and serialized writes prevent stale work from restoring cleared sessions. No private profile/business-response cache or background write-retry queue is included. Pending order intentions and Mother support-request recovery markers are the explicit persistence exceptions described below.

HTTPS is mandatory in preview/production. Development permits explicit localhost/private-network HTTP only. Requests omit cookies, reject redirects and never accept an absolute API path. Keep Metro restricted to localhost/USB, or a trusted private LAN when needed. Health/options are public reachability/capability checks, not authorization or migration checks.

Keep environment secrets, keystores, test signing artifacts, passwords and machine-specific SDK paths out of Git. Every public Expo/build configuration value is compiled into the app. Product errors omit raw exceptions, backend messages, credentials and stack traces. Test-only preview signing is not production signing.

## Dependency audit

`npm run security:audit` remains unfiltered and currently exits 1 for two unresolved upstream tooling advisories affecting five entries. See [DEPENDENCIES.md](docs/DEPENDENCIES.md), its retained raw report and [VALIDATION.md](VALIDATION.md). Do not suppress findings, fabricate package versions, force incompatible framework downgrades or claim the security audit is green. The prior braces advisory was withdrawn upstream, not patched by this release.

## Pending Client orders

Before sending, the exact order key/body is committed to an owner/variant/backend-scoped journal. Native storage uses device-only SecureStore without shared access groups or biometric prompts; UTF-8 chunks stay below historical per-value limits. The manifest is committed only after every chunk is written. Previous committed chunks are removed best-effort after replacement. Native backup rules exclude SecureStore. No auth token, password or OTP is stored in this journal.

The browser preview persists pending order details (including delivery coordinates/notes) in localStorage; the checkout explains this. Web Locks serialize access across tabs. Authentication still uses memory only. Browsers without secure-context Web Locks, blocked storage, malformed journals and missing chunks fail closed for new orders; other read-only screens remain available. A corrupt journal is never treated as an empty one.

Pending intentions survive logout/restart for recovery only after the same account signs back in. Unknown outcomes retain their keys; generic 404/409 can occur after a backend commit and cannot unlock a new order. Recognized pre-commit refusals permit an explicit fresh review. Do not uninstall/clear data or change preview signing while an outcome is uncertain; resolve it first with an administrator using its recovery reference. These controls prevent duplicate retries for a saved intention; they cannot merge independently intended purchases made on different devices or recover deleted device data.

No bank/card processor, map SDK, location permission, analytics service or new paid infrastructure is introduced. Payment instructions are rendered as text from existing organization settings; no server-supplied payment URL is opened automatically. Cyclist calling uses only a validated `tel:` number while a delivery is on its way.

## Mother workflow boundaries

Mother queue, packaging, dish options, staff meal and request endpoints derive ownership from the authenticated backend actor. The app accepts no alternate mother/recipient ID and offers no admin deadline override. Read generations and auth/controller disposal discard stale private responses; business data is held in memory only.

Before a support insert, a small scoped device-only SecureStore marker records the reviewed text’s SHA-256 fingerprint, prior record IDs and attempt time. Browser previews use localStorage plus Web Locks. The text and credentials are not in the marker, though low-entropy text fingerprints are still metadata and are scoped accordingly. Unknown results block a new send; read-only history remains accessible. An explicit history/office review can remove the reminder after explaining duplicate risk. This cannot supply server idempotency or cross-device deduplication. See [MOTHER.md](docs/MOTHER.md).

## Cyclist workflow boundaries

Cyclist reads and writes use the bearer actor's assignment. Only the Cyclist app imports its workflow package. Delivery review captures the EAT date and exact item snapshot; confirmation reloads the assigned run and rejects changed or missing items. No admin, payment or assignment override is exposed. Unknown responses do not trigger automatic write retries. All business data remains in memory, with superseded reads aborted and controller ownership tied to authentication.

Calling accepts validated `tel:` numbers only. Maps uses a fixed HTTPS Google Maps host and validated saved coordinates after an explicit tap, without GPS permission or server-supplied destination URLs. The app does not calculate payouts, introduce client PIN confirmation, or claim offline/physical-device acceptance. See [CYCLIST.md](docs/CYCLIST.md).
