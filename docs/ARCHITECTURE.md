# Architecture

This is an npm workspace containing four Expo/React Native applications. Each app has its own `app.config.ts`, application ID, URL scheme, assets and route entry. Its expected role is a compile-time entrypoint and is checked against runtime Expo configuration. Choosing a role in the UI never grants access. The backend authorizes every private request. Round 2 also checks returned identities against the installed app role before storing credentials or rendering private routes.

| Location                                                   | Responsibility                                                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `apps/admin`, `apps/mother`, `apps/cyclist`, `apps/client` | Independent app identities and Expo Router entries                                                      |
| `packages/api`                                             | Portable bearer transport/contracts from web v0.19.0, plus a public health probe                        |
| `packages/auth`                                            | Session controller, SecureStore/memory adapters, identity validation and React context                  |
| `packages/client-portal`                                   | Client DTO validation, screens, journal controller and secure/browser order storage                     |
| `packages/cyclist-portal`                                  | Cyclist DTO validation, assigned run/lookup/earnings/meal screens and reviewed transition controller    |
| `packages/mother-portal`                                   | Mother DTO validation, queue/meal/request screens, controller and scoped recovery markers               |
| `packages/config`                                          | Runtime configuration validation and supported role/variant types                                       |
| `packages/i18n`                                            | English/Amharic dictionaries and device-local language persistence                                      |
| `packages/ui`                                              | Mi'aa tokens, accessible components, original brand vectors and bundled fonts                           |
| `packages/shell`                                           | Authentication/security screens, guarded tabs, role-specific workflow overviews and connection feedback |
| `config`                                                   | Build-time identity, environment and Expo configuration factories                                       |
| `scripts`                                                  | Cross-platform Node tooling for checks, exports and native builds                                       |
| `tests`                                                    | Pure transport/config tests, React Native interaction tests and browser smoke checks                    |

## Build configuration

`config/apps.cjs` owns production IDs. Development adds `.dev`; preview adds `.preview`. This keeps four apps and their test variants independently installable and separates test signing from future production updates. The chosen production IDs are `com.kmab.miaa.admin`, `com.kmab.miaa.mother`, `com.kmab.miaa.cyclist` and `com.kmab.miaa.client`.

`config/environment.cjs` rejects malformed origins, credentials embedded in URLs, paths/queries/fragments, unknown variants and insecure nonlocal URLs. Preview/production require HTTPS. Development may use HTTP on localhost/private networks, including Android emulator host `10.0.2.2`. Native cleartext permission follows that explicit setting. Public build variables are never credentials.

Expo CNG generates native directories when needed. Generated Android/iOS projects, SDK paths, build products and signing material are ignored. Native configuration belongs in Expo config/plugins or build scripts, never one-off edits to generated files. Metro inherits Expo's automatic workspace support; no custom node resolution or duplicate React installation is used.

## Runtime and state

Three tabs provide Home, Workspace and Settings. Module IDs are looked up inside the current app's module set; unknown/other-role IDs lead to a recoverable not-found screen. Back navigation has a fallback for direct deep links. Tabs, modules and account security require a validated session. Guard transitions remove private navigation history. Auth status and identity live in memory; authentication persists only its opaque token natively. Round 3 also has an isolated, encrypted pending-order journal; it is not an offline identity or business-response cache. Session validation failures hide private content until retry succeeds; no offline identity/profile cache is used.

The language provider reads a namespaced preference from AsyncStorage. Tokens must never be stored there. It accepts only `en`/`am`, serializes writes so rapid changes retain the newest choice, keeps the UI usable when storage fails and exposes recoverable save feedback. Both Poppins and Noto Sans Ethiopic are bundled; locale-aware line spacing accommodates Ethiopic script. The current text has automated key coverage; final Amharic editorial review remains a human acceptance check.

Connection checks happen only after the user presses the button. They use `GET /api/v1/health`, no cookies/bearer tokens, no automatic polling and a 90-second limit for a sleeping Render service. A new check cannot overlap the previous one. Cancel/unmount abort it; late completions do not update an unmounted screen. A health result verifies process reachability and API version, not database migrations or private account permissions.

The auth controller owns all token persistence and exposes credential-free state to UI. Native SecureStore services are isolated by app role, variant and backend origin; browser previews use memory only. Serialized native operations and session epochs prevent delayed writes/responses from restoring logged-out sessions. Bootstrap/foreground validate through `/me`; sessions within 24 hours of expiry renew once, and a foreground 30-second check handles expiry boundaries. No write is automatically retried. The detailed behavior and endpoint map are in [AUTHENTICATION.md](AUTHENTICATION.md). API origin validation occurs before any screen is opened. Secrets, raw server errors and stack traces are not displayed in product screens.

## Client workflows

The Client app supplies `ClientProvider` to the shared root’s provider hook, inside authentication. Other apps do not import its workflow package. Its protected `client/[screen]` route maps a fixed list of screens, with order IDs in validated query parameters. Legacy Client module links redirect to these screens. The Mother app has its own separate workflow package; The Cyclist workflow package is also separate; Admin modules remain overviews.

Read hooks abort on blur and ignore stale completions; order-detail data is also bound to its requested route. The backend owns dates, pricing, radius, capacity and permissions. UI dish filtering follows the existing fasting composition to guide choices, while the service validates again at purchase.

The order journal is scoped to authenticated user, backend and build variant, across app version updates. Native drafts use device-only SecureStore chunks and an atomic head; browser previews use localStorage plus Web Locks, independently of memory-only authentication. A journal is committed before any POST. The controller serializes operations, compares the reviewed journal revision under the lock, and consumes each submitted review once. Explicit retries use the saved key/body. Receipts replace resolved draft details. Unknown or archived outcomes never silently create another intention. Details and known refusal boundaries are documented in [CLIENT.md](CLIENT.md).

## Mother workflows

`MotherProvider` is inside authentication and is imported only by the Mother app. A fixed protected route allowlist and legacy aliases expose queue, staff meal and support. The source audit checks role dependency graphs so neither Mother nor Client workflows enter another app through shared dependencies.

A controller owns backend day/dish/ticket responses, read generations, explicit mutations, cooldown and recovery. The clock is observed through state rather than read during rendering. Packaging re-reads authoritative status/deadlines before a POST. Meal writes use the backend's daily uniqueness rule. Support inserts have no idempotency endpoint, so a scoped SecureStore/browser marker is committed before POST; unknown results block another send until history/office review. See [MOTHER.md](MOTHER.md) for the complete contract and limitations.

## Cyclist workflows

`CyclistProvider` is supplied only by the Cyclist app and remains inside authentication. A protected route allowlist and legacy aliases expose assigned run, exact sticker lookup, earnings and staff meals. The controller binds reads to explicit EAT dates/queries, aborts superseded reads, validates DTOs and consumes frozen reviews once. A fresh assigned-run read must still match the reviewed item before a delivery POST. No business data is persisted offline.

A single provider date timer updates the UI only when the EAT day changes. Calling uses validated telephone numbers; map links use a fixed HTTPS host and subscription coordinates. Earnings display backend counts/current rate without calculating payout. See [CYCLIST.md](CYCLIST.md) for current policy, state transitions and acceptance limits.
