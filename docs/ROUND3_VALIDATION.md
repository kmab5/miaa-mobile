# Round 3 validation — v0.3.0

Observed on 2026-10-26 with Node 24.22.1 and npm 11.9.0. The delivery is **source and tests only**. Following the user's latest instruction, automatic CI now runs tests without platform exports or native compilation. No build outputs are included.

| Check                                            | Observed result                                                                                                                                            |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint                                           | Passed, zero project warnings                                                                                                                              |
| Prettier                                         | Passed                                                                                                                                                     |
| Strict TypeScript                                | Passed                                                                                                                                                     |
| Jest pure/native interactions                    | 188 tests passed across 13 suites                                                                                                                          |
| Installed Expo SDK dependency matrix             | All four apps passed the offline matrix check                                                                                                              |
| Browser acceptance, completed earlier this round | 17 passed across all four apps                                                                                                                             |
| Guarded updater and Git patch rehearsal          | Both reproduced the clean target; conflict, CRLF/formatting, symlink/unsafe paths, damaged payload, temporary-file preservation and rollback checks passed |
| Unfiltered dependency audit                      | Exit 1; five high entries from two upstream tooling advisories                                                                                             |

The source/native interaction tests cover durable order keys, exact retry bodies, lost and malformed responses, storage failures including receipt commits, concurrent controllers, stale/consumed reviews, disposal, cooldown expiry, pre/post-commit error distinctions, fasting composition, demo dates, address validation, scoped mutations, bilingual forms, native encrypted chunks/isolation and safe calling. The unchanged authentication regression suite remains included.

Browser tests use fixtures for all private requests and mutations. They cover the complete reviewed order, restart/sign-in recovery, concurrent tabs, unavailable storage, explicit refusal recovery, demo purchase, payment details/history, 429 cooldown, inaccessible orders, account security, logout, locale persistence, narrow layouts and public health handling. No production address, order, password, signup or Telegram mutation was performed. Seven relevant API/service/schema files were compared byte-for-byte with the current supplied backend archive (web v0.19.0, Library version 4); the contract matches.

## Earlier verification evidence

Before the request to stop builds, all twelve Android/iOS/web exports completed and matched the final runtime source; staff bundles contain no Client workflow module. [ROUND3_EXPORT_BUILDS.json](ROUND3_EXPORT_BUILDS.json) records source digests and absence of test fixtures, node-forge and Zod in the product graphs. The Client Android release-preview also compiled before that request. [ROUND3_ANDROID_BUILD.json](ROUND3_ANDROID_BUILD.json) records the inspected package. These are historical text records; the APK and exports are not delivered, and no further builds are required for this source update. The older `ANDROID_BUILDS.json` / `EXPORT_BUILDS.json` describe Round 2 only.

## Limits and reproduction

The dependency audit is not green. See [DEPENDENCIES.md](DEPENDENCIES.md) and [the raw audit](security-audit-2026-10-26.json). No advisory suppression, incompatible framework downgrade or unreviewed major Zod override is applied.

Native iOS compilation, actual Android/iOS devices/emulators, real account/Telegram acceptance, large-text/screen-reader checks and human Amharic editorial review remain pending in [ACCEPTANCE.md](ACCEPTANCE.md). There is no remote push or hosted CI result to claim. The existing Render/Neon backend is reused, with no API/database migration or new paid service.

Apply after Round 2 v0.2.0 using the guarded updater or Git patch, then run:

```bash
npm ci
npm run check
npm run doctor
```

A clean applied-copy installation of 1,315 locked packages, all 188 tests and the four-app offline SDK matrix check passed before packaging. [CLIENT.md](CLIENT.md) explains endpoint coverage, persistence and conservative recovery. Do not delete an uncertain order's saved key merely to start another order.
