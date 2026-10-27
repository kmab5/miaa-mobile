# Progress and delivery protocol

Version: **0.8.0**. Current milestone: **Round 8 final implementation and handoff**. See [VALIDATION.md](../VALIDATION.md) for checks and acceptance limits.

GitHub main was checked on 2026-10-26 at `f76f9b993980c2037579e07b967d78e3d5dc800d` (`feat/cg: round-7`). All 278 tracked files match the delivered Round 7 v0.7.0 source by Git blob hash. No intervening source changes required merging; the owner's personal ignore rule is preserved. The baseline GitHub tests check passed. This delivery does not push changes or claim hosted Round 8 CI.

## Completed scope

- Round 1: four app identities, bilingual fonts/UI, navigation, health checks, tooling and CI.
- Round 2: password/verified Telegram authentication, Client signup, secure sessions and account security.
- Round 3: Client profile/address, offerings, dish choices, reviewed orders, durable retry keys, payment instructions, delivery status and history. See [CLIENT.md](CLIENT.md).
- Round 4: Mother assigned queue, dish/non-spicy totals, filtering, reviewed packaging and EAT deadlines, one daily staff meal and reviewed support requests/history with durable uncertainty reminders. See [MOTHER.md](MOTHER.md).
- Round 5: Cyclist assigned run, reviewed collection/handover, exact sticker lookup, safe calling/maps, server delivery counts/rate and daily staff meals. See [CYCLIST.md](CYCLIST.md).
- Round 6: Admin daily oversight, people/staff credentials, inspections, catalog/prices, subscriptions, assignments/status corrections, replacements, payment recording, support and organization settings. See [ADMIN.md](ADMIN.md).
- Round 7: Admin finance, off-platform payouts, stock items/movements, six analytics reports, reviewed archive/restoration. See [ADMIN_FINANCE.md](ADMIN_FINANCE.md).
- Round 8: shared transport/cooldown hardening, screen-reader feedback, immutable Admin guards, four-app HTTP contract tests, production-signing/version guards, browser regressions, twelve JS exports and inspected standalone Android previews. See [RELEASE.md](RELEASE.md).
- Eight-round implementation complete. Real-account, physical-device/OS, human Amharic and private production-signing acceptance remain explicitly pending.

The backend contract remains web v0.19.0. No API/database migration or new paid service is required. All automated private actions use fixtures; they do not mutate production records.

## Incremental delivery

Apply Round 8 after Round 7 v0.7.0, including the verified GitHub Round 7 commit. The update includes original paths, baseline/target SHA256 values, a guarded Node updater and an equivalent Git patch. Conflicts stop before writes. Save local work, extract outside the application repo, preflight, apply and inspect differences. Preserve git history and unrelated files. A clean initial checkout needs the previous rounds first.

After applying: `npm ci`, `npm run check`, `npm run doctor`. Automatic CI runs these source/native-interaction checks only. The default remains tests only. The owner explicitly requested builds for this final round, so Round 8 also includes the four Android preview binaries; this does not add build jobs to CI.

Future rounds must inspect the latest GitHub head, repository instructions, changed files and CI. Preserve intervening work and deliver folder-preserving increments. Git attributes normalize text to LF; the updater accepts canonical CRLF baselines and Prettier accepts consistent Windows line endings.
