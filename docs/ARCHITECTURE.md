# Architecture

This is an npm workspace containing four Expo/React Native applications. Each app has its own `app.config.ts`, application ID, URL scheme, assets and route entry. Its expected role is a compile-time entrypoint and is checked against runtime Expo configuration. Choosing a role in the UI never grants access. Actual authorization will remain server-side when authentication is connected in Round 2.

| Location                                                   | Responsibility                                                                                |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `apps/admin`, `apps/mother`, `apps/cyclist`, `apps/client` | Independent app identities and Expo Router entries                                            |
| `packages/api`                                             | Portable bearer transport/contracts from web v0.19.0, plus a public health probe              |
| `packages/config`                                          | Runtime configuration validation and supported role/variant types                             |
| `packages/i18n`                                            | English/Amharic dictionaries and device-local language persistence                            |
| `packages/ui`                                              | Mi'aa tokens, accessible components, original brand vectors and bundled fonts                 |
| `packages/shell`                                           | Preview screens, tab navigation, role-specific workspace descriptions and connection feedback |
| `config`                                                   | Build-time identity, environment and Expo configuration factories                             |
| `scripts`                                                  | Cross-platform Node tooling for checks, exports and native builds                             |
| `tests`                                                    | Pure transport/config tests, React Native interaction tests and browser smoke checks          |

## Build configuration

`config/apps.cjs` owns production IDs. Development adds `.dev`; preview adds `.preview`. This keeps four apps and their test variants independently installable and separates test signing from future production updates. The chosen production IDs are `com.kmab.miaa.admin`, `com.kmab.miaa.mother`, `com.kmab.miaa.cyclist` and `com.kmab.miaa.client`.

`config/environment.cjs` rejects malformed origins, credentials embedded in URLs, paths/queries/fragments, unknown variants and insecure nonlocal URLs. Preview/production require HTTPS. Development may use HTTP on localhost/private networks, including Android emulator host `10.0.2.2`. Native cleartext permission follows that explicit setting. Public build variables are never credentials.

Expo CNG generates native directories when needed. Generated Android/iOS projects, SDK paths, build products and signing material are ignored. Native configuration belongs in Expo config/plugins or build scripts, never one-off edits to generated files. Metro inherits Expo's automatic workspace support; no custom node resolution or duplicate React installation is used.

## Runtime and state

Three tabs provide Home, Workspace and Settings. Module IDs are looked up inside the current app's module set; unknown/other-role IDs lead to a recoverable not-found screen. Back navigation has a fallback for direct deep links. No private account data is cached or displayed in Round 1.

The language provider reads a namespaced preference from AsyncStorage. Tokens must never be stored there. It accepts only `en`/`am`, serializes writes so rapid changes retain the newest choice, keeps the UI usable when storage fails and exposes recoverable save feedback. Both Poppins and Noto Sans Ethiopic are bundled; locale-aware line spacing accommodates Ethiopic script. The current text has automated key coverage; final Amharic editorial review remains a human acceptance check.

Connection checks happen only after the user presses the button. They use `GET /api/v1/health`, no cookies/bearer tokens, no automatic polling and a 90-second limit for a sleeping Render service. A new check cannot overlap the previous one. Cancel/unmount abort it; late completions do not update an unmounted screen. A health result verifies process reachability and API version, not database migrations or private account permissions.

The shared authenticated transport is included for the next round, but no token-storage adapter is wired into these preview apps. Native sign-in/session security is Round 2. API origin validation occurs before any screen is opened. Secrets, raw server errors and stack traces are not displayed in product screens.
