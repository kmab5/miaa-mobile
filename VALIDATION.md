# Round 7 validation — v0.7.0

Observed on 2026-10-26 with Node 24.22.1 and npm 11.9.0. Source/tests only: no platform export, browser export harness, native compilation, APK or build output.

| Check                                   | Observed result                                                                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Locked installation                     | Passed; external versions unchanged                                                                                        |
| ESLint / formatting / strict TypeScript | Passed                                                                                                                     |
| Jest pure/native interactions           | 585 tests across 25 suites passed                                                                                          |
| Installed Expo SDK matrix               | All four apps passed offline dependency checks                                                                             |
| Project audit                           | Versions, identities, protected routes, assets, role boundaries and documentation passed                                   |
| Guarded updater / Git patch             | Exact target, idempotence, CRLF, conflicts, payload/path/symlink checks, temporary-file preservation and rollback verified |
| Unfiltered dependency audit             | Exit 1: five high entries from two documented upstream tooling advisories                                                  |

All previous role regressions remain. Round 7 checks actual financial/stock/report/bin DTOs, strict read/query/kind paths, real bounded periods, aggregate and signed decimal strings, exact quantity arithmetic, category/direction/positive money rules, service text limits, safe text-only receipt URLs, named historical payout identity, whole units, shortages, signed adjustments, cost precision and rounded expense bounds, linked purchase expenses, composite identities, stale report guards, reviewed bodyless DELETE/restoration, journal-before-write, unknown response/restart blocking, malformed acknowledgements and storage failures. Native interactions exercise the report hub, period filters, reviewed finance/payout/purchase actions, mixed/fallback/negative reports, stock history/unit locks, analytics rates/confidence, archive/restore warnings, client access consequences and bilingual routes. The same version-1 Admin journal preserves Round 6 actions; subscription-only keyed retries remain unchanged.

All automated private actions use fixtures. No production person, payment, payout, stock, delivery, request, archive, setting or Telegram record was changed. The existing web v0.19.0 API supports Round 7 without a backend migration or paid service. No external dependency version was added or changed. The unsuppressed audit is not green; see [DEPENDENCIES.md](docs/DEPENDENCIES.md) and [the raw report](docs/security-audit-round7-2026-10-26.json).

GitHub main was inspected at Round 6 commit `f72f6126b2c6d5db3a0bd2d390687955bc833f2d` (`feat/cg: round-6`). All 268 tracked blobs match delivered v0.6.0. The baseline hosted `tests` check succeeded. This delivery does not push or claim hosted Round 7 CI. The guarded increment was applied to a clean Round 6 tree and revalidated with a fresh `npm ci`, `npm run check` and `npm run doctor`.

Browser tests were not run because the retained harness requires exports. New UI was tested through React Native interactions. [Round 6 validation](docs/ROUND6_VALIDATION.md) and older build records are historical. Actual native linking/devices, authorized real-account integration, OS secure storage, screen readers/large-text/keyboard behavior and human Amharic editorial review remain pending in [ACCEPTANCE.md](docs/ACCEPTANCE.md). Tests do not establish those claims. [ADMIN_FINANCE.md](docs/ADMIN_FINANCE.md) documents endpoint coverage, list caps, unavailable optional API affordances, financial distinctions and concurrency limits.

Apply after Round 6 v0.6.0 and run from the repository root:

```bash
npm ci
npm run check
npm run doctor
```

Automatic CI remains tests only. Retained build tooling is available for the owner's manual use; no build is needed to apply this update. Round 8 remains cross-app/device/accessibility/release acceptance.
