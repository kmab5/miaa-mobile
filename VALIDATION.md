# Round 2 validation — v0.2.0

Observed on 2026-10-23 using Node 24.19.0, npm 11.9.0 and the pinned Expo 58 / React Native 0.88 / React 19.3 stack. This is an incremental update to the delivered Round 1 v0.1.0. GitHub main was checked at the start and remains the initial commit `ea8ac2e94206a22ae851e3559090fae6bb84b179`; no hosted CI result or remote push is claimed.

| Check                                        | Result                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| Dependency installation from pinned lockfile | Passed                                                                  |
| ESLint, zero allowed warnings                | Passed                                                                  |
| Prettier                                     | Passed                                                                  |
| Strict TypeScript                            | Passed                                                                  |
| Jest pure and native interactions            | 122 passed across 9 suites                                              |
| Expo bundled SDK dependency matrix           | All four apps passed; offline matrix check                              |
| Android/iOS/web exports                      | All twelve passed; exported app modules match final source              |
| Playwright browser acceptance                | 9 passed across all four roles                                          |
| Android ARM64 release-preview APKs           | All four apps compiled, signed and inspected                            |
| Live deployed public auth options            | HTTP 200; password/Telegram enabled, seven-day sessions                 |
| Incremental update and Git patch             | Both reproduced all 194 source files from the Round 1 baseline          |
| Unfiltered npm security audit                | Exit 1; four high entries from one unresolved upstream tooling advisory |

The session tests cover fixed-role login, malformed/wrong-role responses, native storage failures/timeouts, response cancellation, duplicate submissions, late login/native writes after logout, stale 401 after a newer login, locked network recovery, revoked/deactivated accounts, expiry, near-expiry rotation, background/foreground locking, logout cleanup failure, remote revocation failure, OTP proof, Client-only signup and password/revoke-all behavior. Native interactions cover bilingual forms, secret clearing, verified signup, linked-status limitations, independent resend/verify cooldown, confirmations and secure adapter isolation.

The public live capability probe used no credentials. Private API calls, OTP delivery, signup and account changes use fixtures matching the provided web v0.19.0 API. No production account or business data was mutated. Contract tests are not a claim that authorized real accounts/Telegram delivery were exercised against production.

## Export and browser verification

All twelve Android/iOS/web bundles exported successfully with source maps. `npm run verify:exports` compared every owned runtime module to the final repository, checked required authentication modules and rejected foreign role routes. Native bundles matched 41 owned modules each and web bundles matched 42; [EXPORT_BUILDS.json](docs/EXPORT_BUILDS.json) records the results. An iOS JavaScript export does not verify native iOS compilation.

All nine Playwright tests passed against the final static exports using Chromium headless shell 149.0.7827.55. They exercised password errors, protected links, account security, logout, reload sign-out, Client verified signup and revoke-all confirmation, plus navigation, language persistence, narrow layouts, the Ethiopic font choice and connection checks for all four roles. Private API responses were fixtures.

## Native package verification

All four Android release-preview builds passed with JDK 17.0.20.1, Gradle 9.4.1, compile SDK 37 / target 36 / minimum 24, NDK 27.1.12297006 and CMake 3.22.1. APKs use version 0.2.0 / versionCode 2 and distinct `.preview` IDs. They are standalone, test-signed ARM64 packages; no Metro or Expo cloud account is needed to install them.

Inspection verified signatures, role/API/version configuration, the actual native SecureStore module after R8 optimization, both Android backup exclusion rules, disabled cleartext, all four font files against source checksums, font license text, and every one of the 41 owned JavaScript source modules against the final repository. The advisory-affected Node packages are absent from these application graphs. [ANDROID_BUILDS.json](docs/ANDROID_BUILDS.json) records observed facts and checksums.

Builds default to one Gradle worker with project parallelism disabled, and Metro already uses one worker. A CNG finalization plugin repairs the reproduced duplicate package-refactor/splash-template entry points while preserving splash registration; unrelated native differences fail explicitly. Four regression tests cover the duplicate, no-op behavior, conflict refusal and missing splash hook. Mother and Cyclist compile with this finalizer; the already-correct Client/Admin entry points were verified byte-identical when it was applied. The builder checks the namespace/unique pair before Gradle.

Upstream Gradle/Kotlin/dependency deprecation notices remain distinct from zero-warning project ESLint. One earlier overlapping export/native build exceeded this environment's 8 GiB limit; final native builds ran separately with the bounded worker configuration.

## Security and acceptance limits

The advisory audit is not green. `node-forge` 1.4.0 has no published patched version listed at verification; it is reached through Expo's development certificate tooling. The earlier braces advisory was withdrawn upstream on 2026-10-23, accounting for the lower count. [DEPENDENCIES.md](docs/DEPENDENCIES.md) and [the raw current audit](docs/security-audit-2026-10-23.json) retain the findings.

Native iOS compilation/signing requires macOS/Xcode and has not been verified here. No physical Android/iOS device or emulator acceptance is claimed. Actual keystore restoration, device foreground/background, Telegram own-contact proof, authorized accounts for all roles, keyboard/accessibility/font scaling and human Amharic editorial review remain explicit acceptance tasks in [ACCEPTANCE.md](docs/ACCEPTANCE.md).

The browser preview intentionally uses memory-only tokens. Reloading it signs out while retaining only the language preference; native restart restoration is a different acceptance check. The existing backend is reused without infrastructure changes. Client/Mother/Cyclist/Admin operational workflows are still module overviews, with real features scheduled for later rounds.

## Incremental delivery verification

The final 64-file update was applied to a fresh extraction of the delivered Round 1 archive. Both the Node updater and `git apply` reproduced all 194 repository files byte-for-byte. The updater also passed Windows CRLF input, repeat application, unrelated-file preservation and a conflicting-file refusal with no writes. Source checks were repeated in the applied repository using its separate clean `npm ci` installation.

## Reproduce

```bash
npm ci
npm run check
npm run doctor
npm run export:all
npm run verify:exports
npx playwright install chromium
npm run test:ui
npm run verify:android
npm run security:audit
```

Android verification needs the SDK/JDK described in [BUILDING.md](docs/BUILDING.md). SecureStore adds a native module, so build a fresh native binary after applying the update. Production signing remains blocked until Round 8. The security command intentionally reports outstanding upstream findings rather than suppressing them. After pushing, inspect the actual GitHub Actions run.
