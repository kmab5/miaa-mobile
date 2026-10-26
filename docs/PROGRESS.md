# Progress and delivery protocol

Version: **0.1.0**. Current milestone: **Round 1 foundation**. See [VALIDATION.md](../VALIDATION.md) for observed verification rather than treating this file as proof of a completed build.

Source baseline inspected through GitHub: `kmab5/miaa-mobile`, `main`, commit `ea8ac2e94206a22ae851e3559090fae6bb84b179`. That commit contains the initial `.gitignore`. Its existing rules are retained and extended for generated native directories, environments, signing keys and artifacts. No remote write is required for this delivery.

The portable API client/contracts are derived from the web v0.19.0 implementation produced in this conversation. No web server code, database credentials or Telegram secrets belong in this repository. Actual private API integration will be tested in Round 2 against the deployed backend contract.

## Delivered scope

- Four separate app projects and role-checked configuration.
- Shared brand components, original vector assets, bundled Latin/Ethiopic fonts and app icons.
- Working Home/Workspace/Settings tabs and module overview/deep-link recovery.
- English/Amharic preference persistence, failed-storage recovery and serialized preference writes.
- Explicit public health probe with cancellation, timeout and useful failure states.
- Node-based cross-platform build/export/check scripts, native/tooling version pins and CI.
- Tests, architecture, setup, acceptance and development roadmap documentation.

No authenticated business feature is claimed complete in Round 1. Real sign-in, customer/kitchen/rider/admin data, private actions, push notifications and background mutation synchronization are not present in the preview.

## Applying Round 1

Extract the full repository archive. Copy its contents into your existing `miaa-mobile` checkout, including configuration files; keep your checkout's `.git` directory. Do not nest another `miaa-mobile` folder inside the repository. Then run `npm ci`, `npm run check`, inspect the changes and commit/push normally. No secrets or generated native/build folders are included in the source ZIP.

## Later rounds

At the beginning of every round, inspect the latest GitHub head, repository instructions, changed files and CI. Preserve edits made between deliveries. Deliver either a patch against that exact head or only changed files with their original paths. Record the base commit, version, changed scope, checks and any known limits. Do not repeatedly replace the whole repository after Round 1. Each round must leave the previously implemented app workflows working.
