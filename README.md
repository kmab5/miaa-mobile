# Mi'aa mobile

**v0.1.0 · Round 1 foundation.** Four separate Android/iOS app projects: Admin, Mother, Cyclist and Client. Shared TypeScript packages provide the design system, English/Amharic language settings, navigation and API transport.

This release provides usable preview shells, not authenticated business workflows. Open a workspace/module, change and retain your language, and run/cancel a public service connection check. Authentication is the next round. No new backend or paid service is required.

## Start

Use **Node 24.19+ on the 24 release line** and npm 11.9.0. Install from the repository root, not separately inside each app.

```bash
npm ci
npm run check
npm run start:client
```

Replace `client` with `admin`, `mother` or `cyclist`. The API defaults to `https://miaa.onrender.com`; no `.env` file or credentials are required. For a different development server, copy `.env.example` to `.env.local` and edit public configuration only.

For Android installation/builds, see [BUILDING.md](docs/BUILDING.md). Native development requires the Android SDK/JDK, while JavaScript checks need only Node. An APK preview contains its JS bundle and runs without Metro. The current Expo SDK is pinned in the lockfile; use local development/preview builds rather than assuming the installed Expo Go app supports it.

```bash
npm run build:android -- client preview
```

Repeat for the other three app names. Preview builds have separate application IDs and use a test-only signing key. Production signing is a later milestone.

## Verify

```bash
npm run check
npm run doctor
npm run export:all
npm run test:ui
npm run verify:android
npm run security:audit
```

`check` runs lint with zero warnings, formatting, TypeScript, pure/native interaction tests and source/config/documentation audits. Browser tests need exported web bundles and a Playwright Chromium installation (`npx playwright install chromium`). Native verification builds all four preview APKs and needs a configured SDK/JDK. See [VALIDATION.md](VALIDATION.md) for checks actually run and limitations; do not equate source checks with device acceptance.

## Continue development

- [Architecture and repository map](docs/ARCHITECTURE.md)
- [Eight-round roadmap](docs/ROADMAP.md)
- [Build and installation guide](docs/BUILDING.md)
- [Progress and incremental delivery rules](docs/PROGRESS.md)
- [Security boundaries](SECURITY.md)
- [Dependency advisory status](docs/DEPENDENCIES.md)
- [Device acceptance checklist](docs/ACCEPTANCE.md)
- [Font and brand attribution](docs/ATTRIBUTION.md)

The upstream repository is [kmab5/miaa-mobile](https://github.com/kmab5/miaa-mobile). Round 1 is a full repository delivery based on its initial `.gitignore` commit. Future rounds will be patches or changed files with directory structure preserved, based on the then-current GitHub head.
