# Round 8 validation — v0.8.0

Observed on 2026-10-26 with Node 24.22.1/npm 11.9.0. The owner explicitly requested builds for this final round; default hosted CI remains source/tests only.

| Check                                   | Observed result                                                                                                                                                             |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source/native-component regressions     | 630 tests across 28 suites passed                                                                                                                                           |
| ESLint / formatting / strict TypeScript | Passed                                                                                                                                                                      |
| Expo dependency matrix                  | All four apps passed offline checks                                                                                                                                         |
| Browser interactions                    | 20 tests across all four apps passed using fixture APIs                                                                                                                     |
| JavaScript platform exports             | All 12 Android/iOS/web exports passed source freshness, required-module, role-boundary and tooling/fixture checks; [receipt](docs/ROUND8_EXPORT_BUILDS.json)                |
| Android native previews                 | Four compiled and independently inspected; ARM64, version 0.8.0/code 8; [receipt](docs/ROUND8_ANDROID_BUILDS.json)                                                          |
| Production configuration                | Pure validation, actual generated Groovy transform and legacy/current signer-output formats tested; no real production key used; [receipt](docs/ROUND8_RELEASE_CHECKS.json) |
| Incremental update                      | Guarded updater and equivalent Git patch, original folder structure; verification receipt accompanies the delivery                                                          |
| Unfiltered dependency audit             | Exit 1: five high entries from the same two upstream development-tooling advisories; no suppression                                                                         |

Final regressions preserve all previous role suites. Added checks cover malformed failure envelopes and support references, cancelled-before-fetch requests, integer/date Retry-After parsing and timer bounds, read-side Mother cooldowns, immutable Admin guards, named alert/busy/scalable-language semantics, private signing/template/certificate/version constraints, and shared four-app orchestration. The HTTP fixture advances a pending-payment delivery through Mother packaging, rider collection/handover, Client status and Admin oversight; cancellation removes unfinished work, intervening transitions invalidate stale reviews, and foreground revocation blocks all four roles. These are frontend contract tests, not a live backend/database integration result.

The browser suite exercises protected role navigation/authentication/security, locale persistence, narrow layout, Client checkout/recovery and new Admin finance/report/stock/archive and reviewed-write flows. It uses mocked responses only. Initial failures exposed a duplicate-text selector on retained screens and an unsynchronized tab transition; the tests now select visible feedback and await the target workspace. No forced click or disabled assertion masks those failures.

Exports are inspected against final repository source maps. Required workflow modules are present; another app’s portal/routes, test fixtures, `node-forge` and `zod` must be absent. Android artifacts are independently inspected for signature, application ID/version/API origin, standalone JS bundle/source digest, native secure-storage/crypto bindings, backup exclusions, bundled fonts/licenses, HTTPS-only configuration and permission boundaries. Building or inspecting a binary does not prove physical-device behavior. iOS JS exports are not native iOS compilation.

GitHub baseline `f76f9b993980c2037579e07b967d78e3d5dc800d` (`feat/cg: round-7`) matches all 278 delivered v0.7.0 blobs. Its hosted tests checks succeeded. This delivery makes no remote push, deployment or private production mutation and does not claim hosted Round 8 CI. External package versions are unchanged. The audit remains unfiltered and not green; see [DEPENDENCIES.md](docs/DEPENDENCIES.md) and [the raw report](docs/security-audit-round8-2026-10-26.json).

Apply after Round 7 v0.7.0, then run from the repository root:

```bash
npm ci
npm run check
npm run doctor
```

[RELEASE.md](docs/RELEASE.md) explains the standalone Android previews, optional environment-only production signing, build-number increments and install/recovery precautions. Actual devices, OS secure storage/backup/handlers, TalkBack/VoiceOver, human Amharic review, authorized real-account backend journeys and actual production signing remain unverified in [ACCEPTANCE.md](docs/ACCEPTANCE.md). Native iOS requires macOS/Xcode. Earlier [Round 7 validation](docs/ROUND7_VALIDATION.md) and older build records are historical. The eight-round implementation plan is complete; owner acceptance is explicitly separate.
