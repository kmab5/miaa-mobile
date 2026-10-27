# Mi'aa mobile

**v0.8.0 · Final round: cross-app verification and Android previews.** Four separate Android/iOS app projects: Admin, Mother, Cyclist and Client. Shared TypeScript packages provide the design system, English/Amharic language settings, navigation and API transport.

Password and verified Telegram sign-in now connect real role-matched accounts to all four apps. Client signup, secure native session restoration/renewal, logout, password changes and account session revocation are included. The Client app now includes today’s lunch, delivery address, nearby packages, dish choices, reviewed ordering, durable retry recovery, payment instructions and the latest 100 orders. The Mother app now includes the assigned preparation queue, dish totals, deadline-aware packaging, daily staff meals and support requests with conservative recovery. The Cyclist app now includes its assigned run, reviewed collection/handover, exact sticker lookup, calling/maps, delivery counts/rate and daily staff meals. Admin daily operations now cover the board/sheets, people and staff credentials, catalog/prices, assignments, subscriptions, off-platform payment recording, requests and organization settings. Admin finance, off-platform payouts, stock movements, six analytics reports and reviewed archive/restoration are implemented. Round 8 adds shared transport/cooldown hardening, accessibility checks, cross-app contract regressions, production-signing guards and inspected Android preview artifacts. The existing Render API and Neon database are reused; no new backend or paid service is required.

## Start

Use **Node 24.22.1+ on the 24 release line** and npm 11.9.0. Install from the repository root, not separately inside each app.

```bash
npm ci
npm run check
npm run start:client
```

Replace `client` with `admin`, `mother` or `cyclist`. The API defaults to `https://miaa.onrender.com`; no `.env` file or credentials are required. For a different development server, copy `.env.example` to `.env.local` and edit public configuration only.

Signing in requires an existing account for the installed app role. Staff accounts come from an administrator; only the Client app can create a new account after Telegram phone verification. Password recovery uses verified Telegram or the office. Native credentials are stored with Expo SecureStore; web preview credentials last only until reload. Client, Mother and Admin native installations require the SDK-compatible Expo Crypto module: Client uses secure order keys; Mother uses support-request fingerprints; Admin uses secure action keys. Native packaging remains manual.

For Android installation/builds, see [BUILDING.md](docs/BUILDING.md). Native development requires the Android SDK/JDK, while JavaScript checks need only Node. An APK preview contains its JS bundle and runs without Metro. The current Expo SDK is pinned in the lockfile; use local development/preview builds rather than assuming the installed Expo Go app supports it.

Build instructions and signing details are in the manual guide; this round runs tests only and includes no build outputs.

## Verify

```bash
npm run check
npm run doctor
npm run security:audit
```

`check` runs lint with zero warnings, formatting, TypeScript, pure/native interaction tests and source/config/documentation audits. Automatic CI and incremental delivery now run tests only. Browser acceptance needs previously exported web bundles; native/export commands remain available for manual use, but are not run or delivered automatically. See [VALIDATION.md](VALIDATION.md) for checks actually run and limitations; do not equate source checks with device acceptance.

## Continue development

- [Architecture and repository map](docs/ARCHITECTURE.md)
- [Eight-round roadmap](docs/ROADMAP.md)
- [Build and installation guide](docs/BUILDING.md)
- [Progress and incremental delivery rules](docs/PROGRESS.md)
- [Security boundaries](SECURITY.md)
- [Dependency advisory status](docs/DEPENDENCIES.md)
- [Device acceptance checklist](docs/ACCEPTANCE.md)
- [Font and brand attribution](docs/ATTRIBUTION.md)

The upstream repository is [kmab5/miaa-mobile](https://github.com/kmab5/miaa-mobile). Round 8 starts from its Round 7 commit `f76f9b993980c2037579e07b967d78e3d5dc800d`; all 278 tracked files matched the delivered Round 7 source. Apply this incremental update **after Round 7 v0.7.0**. No remote changes were pushed. See [RELEASE.md](docs/RELEASE.md), [ADMIN_FINANCE.md](docs/ADMIN_FINANCE.md), [ADMIN.md](docs/ADMIN.md), [AUTHENTICATION.md](docs/AUTHENTICATION.md), [MOTHER.md](docs/MOTHER.md) and [CYCLIST.md](docs/CYCLIST.md) for endpoint coverage and limits.

See [CLIENT.md](docs/CLIENT.md) for endpoint coverage and order recovery. New orders require a saved address and an explicit review. Unknown outcomes keep the exact saved key and payload; no background write retries or payment processing are added.

Delivery preference: source updates and test results only. No APK, native compilation or platform-export outputs are included in this incremental delivery.

The eight-round implementation plan is complete. The owner explicitly requested all four Android builds for this final delivery; the GitHub workflow remains tests only. Native iOS compilation, real accounts, physical-device/OS accessibility and private production signing remain owner acceptance steps. Supplied APKs are standalone ARM64 Android previews, not production-signed store releases. [VALIDATION.md](VALIDATION.md) separates the observed source/browser/build checks from these pending items.
