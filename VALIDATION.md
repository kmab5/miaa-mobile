# Round 4 validation — v0.4.0

Observed on 2026-10-26 with Node 24.22.1 and npm 11.9.0. This round runs tests only: no platform export, native compilation, APK or binary delivery.

| Check                                   | Observed result                                                                                                   |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Clean locked dependency install         | 1,316 packages installed                                                                                          |
| ESLint / formatting / strict TypeScript | Passed                                                                                                            |
| Jest pure/native interactions           | 258 tests across 17 suites passed                                                                                 |
| Installed Expo SDK matrix               | All four apps passed the offline dependency matrix check                                                          |
| Project audit                           | App identities, routes, assets, versions, role dependency boundaries and documentation passed                     |
| Incremental updater / Git patch         | Exact target reproduction, idempotence, CRLF, conflict refusal, payload/path/symlink checks and rollback verified |
| Unfiltered security audit               | Exit 1: five high entries from the two documented upstream tooling advisories                                     |

The suite includes all prior authentication, Client order/storage and workspace regressions. Mother additions cover real DTO validation, exact EAT deadline and midnight boundaries, current assigned status/ID checks, packaging review, double taps, lost/malformed receipts, stale reads, scoped staff meal selection, daily uniqueness handling, request validation/review, marker-before-POST, storage failure/corruption/isolation, restart recovery, history reconciliation, old identical messages, explicit reminder clearing, Retry-After, disposal, protected route allowlists, Amharic controls and Strict Mode replay.

Private requests use fixtures. No production account, order, meal, ticket, password or Telegram record was mutated. The implementation uses the existing web v0.19.0 Mother workflow routes and services; no backend change or migration is required.

GitHub baseline `f49977f477eccc4b1328064061b950fd0215d865` has a successful tests job. Its 215 tracked files were compared by Git blob hash with Round 3: only the owner's personal ignore rule differed, and it is preserved. No new revision was pushed; hosted CI for Round 4 must be checked after the owner applies and pushes it.

Browser automation was adjusted for Mother navigation but not rerun: its existing harness requires platform exports, which were excluded at the user's request. New screens are exercised through the React Native interaction suite. Historical Round 3 browser/build observations are retained in [ROUND3_VALIDATION.md](docs/ROUND3_VALIDATION.md); they are not Round 4 acceptance or new build outputs.

Actual Android/iOS devices/emulators, native linking/builds, real-account backend integration, accessibility/large-text and human Amharic editorial review remain pending in [ACCEPTANCE.md](docs/ACCEPTANCE.md). Source tests cannot establish those results. See [MOTHER.md](docs/MOTHER.md) for endpoint coverage, recovery limits and server-day rollover behavior. See [DEPENDENCIES.md](docs/DEPENDENCIES.md) for the unsuppressed dependency findings.

Apply after Round 3 v0.3.0, then run from the repository root:

```bash
npm ci
npm run check
npm run doctor
```

Automatic CI remains tests only. Build tools are retained for the owner's manual use; no builds are needed to apply this update.
