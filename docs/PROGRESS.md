# Progress and delivery protocol

Version: **0.4.0**. Current milestone: **Round 4 Mother workflows**. See [VALIDATION.md](../VALIDATION.md) for checks and acceptance limits.

GitHub main was checked on 2026-10-26 at `f49977f477eccc4b1328064061b950fd0215d865` (`feat/cg: round-3`). Its tests job completed successfully. All 215 tracked files were compared against the delivered Round 3 source using Git blob hashes; the only difference was the owner's `raw/` ignore rule. That rule is preserved. This delivery does not push changes or claim hosted CI for the new revision.

## Completed scope

- Round 1: four app identities, bilingual fonts/UI, navigation, health checks, tooling and CI.
- Round 2: password/verified Telegram authentication, Client signup, secure sessions and account security.
- Round 3: Client profile/address, offerings, dish choices, reviewed orders, durable retry keys, payment instructions, delivery status and history. See [CLIENT.md](CLIENT.md).
- Round 4: Mother assigned queue, dish/non-spicy totals, filtering, reviewed packaging and EAT deadlines, one daily staff meal and reviewed support requests/history with durable uncertainty reminders. See [MOTHER.md](MOTHER.md).
- Next: Round 5 Cyclist operations; Rounds 6–7 Admin workflows; Round 8 cross-app/device/accessibility/release acceptance.

The backend contract remains web v0.19.0. No API/database migration or new paid service is required. All automated private actions use fixtures; they do not mutate production records.

## Incremental delivery

Apply Round 4 after Round 3 v0.3.0, or to the verified GitHub Round 3 commit. The update includes original paths, baseline/target SHA256 values, a guarded Node updater and an equivalent Git patch. Conflicts stop before writes. Save local work, extract outside the application repo, preflight, apply and inspect differences. Preserve git history and unrelated files. A clean initial checkout needs the previous rounds first.

After applying: `npm ci`, `npm run check`, `npm run doctor`. Automatic CI runs these source/native-interaction checks only. No platform exports, native builds or binaries are run or delivered automatically. Build tooling remains available for the owner’s manual use. This preference applies to future rounds unless the user changes it.

Future rounds must inspect the latest GitHub head, repository instructions, changed files and CI. Preserve intervening work and deliver folder-preserving increments. Git attributes normalize text to LF; the updater accepts canonical CRLF baselines and Prettier accepts consistent Windows line endings.
