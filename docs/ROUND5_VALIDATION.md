# Round 5 validation — v0.5.0

Observed on 2026-10-26 with Node 24.22.1 and npm 11.9.0. Tests/source only: no platform exports, native compilation, APKs or other build outputs.

| Check                                 | Observed result                                                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Clean locked install                  | 1,317 packages installed; external package versions unchanged                                                              |
| ESLint / Prettier / strict TypeScript | Passed                                                                                                                     |
| Jest core/native interactions         | 333 tests across 20 suites passed                                                                                          |
| Installed Expo SDK matrix             | All four apps passed the offline matrix check                                                                              |
| Project audit                         | Identities, routes, assets, versions, role dependency boundaries and docs passed                                           |
| Guarded updater and Git patch         | Exact target, idempotence, CRLF, conflicts, path/payload/symlink refusal, temporary-file preservation and rollback checked |
| Unfiltered dependency audit           | Exit 1: five high entries from the same two documented upstream tooling advisories                                         |

The complete previous auth, Client and Mother suite remains included. Cyclist additions cover exact API DTOs; assigned-run/date/bucket validation; frozen and consumed reviews; fresh ownership/status/detail checks; reviewed collection and cyclist-only handover; lost/malformed responses; duplicate taps; stale and aborted reads; exact query-encoded replacement lookup; edit/clear/not-found privacy; safe telephone/maps handlers; zero coordinates; backend delivery counts/decimal rate without payout arithmetic; named/unnamed/daily staff meals; EAT midnight; Retry-After; logout/disposal; role route allowlists; Strict Mode and Amharic controls. A single provider clock observes day changes without per-card polling.

All private actions use fixtures. No production account, delivery, meal, ticket, order, password or Telegram record was mutated. Existing web v0.19.0 Cyclist routes/services support the implementation without API changes, migrations, new native dependency versions or paid infrastructure.

GitHub main was checked and remains Round 3 commit `f49977f477eccc4b1328064061b950fd0215d865`. The exact delivered Round 4 v0.4.0 source is this update's baseline; GitHub Round 3 needs Round 4 first. No remote push was made and no hosted Round 5 CI result is claimed.

Browser navigation fixtures were adjusted for the Cyclist app, but browser tests were not rerun because the existing harness requires platform exports. New screens are verified through React Native interaction tests. Prior [Round 4](ROUND4_VALIDATION.md) and [Round 3](ROUND3_VALIDATION.md) evidence is historical, not new platform acceptance.

Actual Android/iOS devices, native linking/builds, real backend account integration, OS phone/maps handlers, accessibility/large text and human Amharic editorial review remain pending in [ACCEPTANCE.md](ACCEPTANCE.md). Source tests do not establish those results. [CYCLIST.md](CYCLIST.md) documents endpoint mapping, current confirmation policy, no automatic retries, memory-only business data and in-flight midnight limitations. [DEPENDENCIES.md](DEPENDENCIES.md) retains the unsuppressed audit findings.

Apply after Round 4 v0.4.0, then run:

```bash
npm ci
npm run check
npm run doctor
```

Automatic CI remains tests only. Build tools stay available for the owner's manual use.
