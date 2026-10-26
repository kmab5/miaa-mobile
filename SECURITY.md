# Security boundaries

The four native apps use the existing Mi'aa bearer API. Every login/OTP request includes the installed role; runtime session validation checks the returned role, identity, token and expiry. The backend remains responsible for authorization, active accounts and active linked operational records. Protected routes only prevent local navigation into authenticated screens.

Tokens are persisted only through Expo SecureStore on native platforms, isolated by role, variant and backend origin. The browser preview stores them in memory only and signs out on reload. Only non-sensitive language preferences use AsyncStorage. Passwords, OTPs, invites and signing secrets must never be persisted there or placed in route parameters. See [authentication behavior](docs/AUTHENTICATION.md) for session races, failure states and acceptance boundaries.

Telegram invite possession permits status checks, not existing-account login. The bot must verify the user's own contact. Existing users must then prove password/OTP ownership. Only Client signup is offered; staff accounts are provisioned by an administrator. Outbound bot links require HTTPS on the exact `t.me` host with the matching start token.

Bootstrap and foreground revalidate with the server before private content is shown. Transient failures lock the workspace and keep credentials for explicit retry. Definitive unauthorized/revoked/expired sessions are removed. Logout removes local access even if remote revocation fails and reports that limitation. Secure-storage deletion failure keeps the app locked; retry attempts cleanup. Epoch checks and serialized writes prevent stale work from restoring cleared sessions. No private profile/business cache or background write-retry queue is included.

HTTPS is mandatory in preview/production. Development permits explicit localhost/private-network HTTP only. Requests omit cookies, reject redirects and never accept an absolute API path. Keep Metro restricted to localhost/USB, or a trusted private LAN when needed. Health/options are public reachability/capability checks, not authorization or migration checks.

Keep environment secrets, keystores, test signing artifacts, passwords and machine-specific SDK paths out of Git. Every public Expo/build configuration value is compiled into the app. Product errors omit raw exceptions, backend messages, credentials and stack traces. Test-only preview signing is not production signing.

## Dependency audit

`npm run security:audit` remains unfiltered and currently exits 1 for one unresolved upstream tooling advisory affecting four entries. See [DEPENDENCIES.md](docs/DEPENDENCIES.md), its retained raw report and [VALIDATION.md](VALIDATION.md). Do not suppress findings, fabricate package versions, force incompatible framework downgrades or claim the security audit is green. The prior braces advisory was withdrawn upstream, not patched by this release.
