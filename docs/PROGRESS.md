# Progress and delivery protocol

Version: **0.3.0**. Current milestone: **Round 3 Client workflows**. See [VALIDATION.md](../VALIDATION.md) for observed checks and acceptance limits.

GitHub main was checked on 2026-10-26 through the connected repository and remains `ea8ac2e94206a22ae851e3559090fae6bb84b179`, the initial commit. There are no newer remote application changes to integrate. No remote push or hosted CI result is claimed.

## Completed scope

- Round 1: four independent app identities, bilingual fonts/UI, navigation, public health checks, build tooling and CI.
- Round 2: password/verified Telegram authentication, Client signup, secure native sessions, renewal/revocation, lifecycle locking and account security.
- Round 3: the Client’s address, nearby offerings, fasting-aware dish choices, demo/regular ordering, review/confirmation, durable idempotency keys, recovery, delivery status/calling, persistent organization payment instructions and recent order history/details. See [CLIENT.md](CLIENT.md).
- Rounds 4–7: Mother, Cyclist and Admin business workflows. Round 8: full device/accessibility/poor-connection verification and production signing.

The backend contract remains web v0.19.0; no API/database change is required. All automated private account, order and address calls use fixtures. They do not mutate production records. Existing Render and Neon services are reused.

## Incremental delivery

Apply Round 3 after Round 1 and Round 2 v0.2.0. The exact baseline is reconstructed from the delivered Round 1 archive (SHA256 `c0761d993518b8f3e1e56d8dc994bfb8bc00026360abe4f308103a0f649bfc79`) plus the Round 2 source update (SHA256 `50182135b8793a95305e45cc32b943a1f466c462274e60301e5a15fefbdd4d0d`).

The update preserves original paths, includes baseline/target SHA256 values, a guarded Node updater and an equivalent Git patch. Conflicts stop before writes; do not overwrite local edits or force the patch. Review differences and preserve git history and unrelated files. A clean GitHub initial checkout needs the prior rounds first.

After applying: `npm ci`, `npm run check` and `npm run doctor`. Automatic CI now runs these source/native-interaction checks only. Platform exports and native build scripts remain manual; no build outputs are included in incremental deliveries. Push reviewed changes normally and inspect the actual CI run. Source/fixture checks do not complete real-account or device acceptance.

At each later round, inspect the latest GitHub head, repository instructions, changed files and CI. Preserve intervening work and deliver incremental changes with folders intact.

Git attributes normalize future text checkouts to LF. Prettier accepts existing consistent CRLF files so applying a folder-preserving update to a Windows checkout does not require rewriting unrelated files. The updater still checks canonical hashes before mutation.

On 2026-10-26 the user requested tests-only work from now on. Do not automatically run platform exports or native builds, or prepare binary deliverables. Preserve build tooling for the owner’s manual use. Earlier Round 3 build observations remain historical verification evidence.
