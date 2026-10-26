# Round 6 validation — v0.6.0

Observed on 2026-10-26 with Node 24.22.1 and npm 11.9.0. Source/tests only: no platform export, native compilation, APK or build output.

| Check                                   | Observed result                                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Clean locked install                    | 1,318 packages installed; no external version changes                                                                    |
| ESLint / formatting / strict TypeScript | Passed                                                                                                                   |
| Jest pure/native interactions           | 480 tests across 24 suites passed                                                                                        |
| Installed Expo SDK matrix               | All four apps passed the offline dependency matrix                                                                       |
| Project audit                           | Identities, protected routes, versions, assets, role dependency boundaries and docs passed                               |
| Guarded updater / Git patch             | Exact target, idempotence, CRLF, conflict/payload/path/symlink checks, temporary-file preservation and rollback verified |
| Unfiltered dependency audit             | Exit 1: five high entries from two documented upstream tooling advisories                                                |

The suite preserves all previous role regressions. Admin additions cover bounded read/action paths, actual DTO shapes, daily count/date consistency, selected IDs and form limits, phone/zero-coordinate/money/password validation, combined/demo dish composition, real wire methods and acknowledgement shapes for operational mutations, review/no-write-before-confirm behavior, fresh record/price preflight, off-platform payment and refund outcomes, password masking/no persistence, pending journal-before-POST, chunk isolation/corruption/failure, restart recovery, exact order keys/bodies, concurrent stale reviews, minimal revision receipts, explicit checked-result release, cooldown, stale reads/disposal, active-only refresh, protected routes, Strict Mode and bilingual forms.

All private mutations use fixtures. No production person, password, payment, subscription, delivery, ticket, setting or Telegram record was changed. The existing web v0.19.0 API/services support Round 6 without a backend migration or paid service. External dependency versions are unchanged; Admin declares the existing Expo Crypto module for secure action keys.

GitHub Round 5 commit `3a908a0e66d5fce74d635e7a50210228eab8eb02` was inspected; all 249 tracked files match the delivered v0.5.0 source by Git blob hash. This is the update baseline. No remote push was made and no hosted Round 6 CI is claimed.

Browser fixtures/navigation were adjusted for Admin routes but not rerun because the existing harness requires exports. New UI is exercised through React Native interactions. [Round 5 evidence](docs/ROUND5_VALIDATION.md) and earlier build records are historical, not current device acceptance.

Actual native linking/builds/devices, real-account integration, screen readers/large text/keyboard behavior, OS storage and human Amharic editorial review remain pending in [ACCEPTANCE.md](docs/ACCEPTANCE.md). Source tests cannot establish them. [ADMIN.md](docs/ADMIN.md) documents endpoint coverage, prep-sheet deadline/printing limits, server list caps, receipt/retry rules, midnight and concurrency limits. [DEPENDENCIES.md](docs/DEPENDENCIES.md) retains the unsuppressed audit findings.

Apply after Round 5 v0.5.0 and run from the application root:

```bash
npm ci
npm run check
npm run doctor
```

Automatic CI remains tests only. The owner can use retained build tooling manually; no build is needed to apply this source update.
