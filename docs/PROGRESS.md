# Progress and delivery protocol

Version: **0.2.0**. Current milestone: **Round 2 authentication**. See [VALIDATION.md](../VALIDATION.md) for observed checks and remaining acceptance limits.

The mobile repository main branch was read through GitHub at the start of this round: `ea8ac2e94206a22ae851e3559090fae6bb84b179`, still the initial ignore-file commit. There were no newer remote application changes to integrate. The incremental baseline is the full Round 1 source archive v0.1.0 delivered in this conversation, SHA256 `c0761d993518b8f3e1e56d8dc994bfb8bc00026360abe4f308103a0f649bfc79`. No remote push or hosted CI run is claimed.

## Completed scope

- Round 1: four distinct app identities, navigation, bilingual UI/fonts, public health check, builds and CI.
- Round 2: password and verified Telegram OTP login, Telegram linking status, Client-only verified signup, SecureStore adapter, isolated role/variant/origin credentials, session validation/rotation, lifecycle locking, logout/revocation, account security/password management, guarded navigation and failure states.
- Client, Mother, Cyclist and Admin business workflows remain the scope of Rounds 3–7. Round 8 remains device/release hardening and production signing.

The backend contract is the web v0.19.0 mobile API already provided in this conversation. Public deployed auth options were checked without credentials. No private production account, OTP, signup, password or business mutation was used in automated testing; those calls use contract fixtures. See [AUTHENTICATION.md](AUTHENTICATION.md).

## Incremental delivery

Apply Round 2 only after Round 1 v0.1.0. The update archive contains changed/new source files at their original paths, a baseline/target SHA256 manifest, a guarded cross-platform Node updater, and an equivalent Git patch. The updater checks every existing baseline file before writing and refuses to overwrite unrelated edits. Review conflicts instead of forcing them. Files already at their exact target content are safe to skip. Preserve your checkout's git history and configuration.

After applying, run `npm ci`, `npm run check`, `npm run doctor`, exports and the browser suite. A fresh native build is required for SecureStore. Push the reviewed changes normally and inspect the actual GitHub Actions run.

At the beginning of each later round, inspect the latest GitHub head, instructions, changed files and CI. Preserve intervening work, deliver incremental changes with paths intact, and record the exact baseline, checks and limitations.
