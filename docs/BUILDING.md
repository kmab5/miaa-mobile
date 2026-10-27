# Build and install

Run commands in the repository root. The scripts use Node process APIs rather than Unix-only shell commands, so the same npm commands work in Windows PowerShell, macOS and Linux.

## Prerequisites

- Node 24.22.1+ on the 24 release line; npm 11.9.0 (recorded in `.nvmrc`, `.node-version` and `packageManager`).
- For Android: JDK 17, Android SDK command-line tools/platform tools, Platform 37.0, Build Tools 37.0.0 and 36.0.0 (used by transitive libraries), NDK 27.1.12297006 and CMake 3.22.1. The Android Gradle plugin may install missing components after accepting SDK licenses. The generated Gradle wrapper selects its pinned Gradle version; no global Gradle installation is needed.
- Add the SDK’s `platform-tools` directory to PATH to use `adb` directly.
- Set `ANDROID_HOME` to the SDK directory. Set `JAVA_HOME` to your JDK if `java` on PATH points elsewhere. Do not commit either machine-specific path.
- For iOS: macOS, Xcode and the native iOS prerequisites documented by Expo. iOS source/config is included; building on Windows/Linux is not an iOS verification.

Example Windows configuration (adjust installed paths):

```powershell
$env:JAVA_HOME = 'D:\Code\java\jdk-17'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:JAVA_HOME\bin;$env:Path"
npm ci
npm run check
npm run build:android -- client preview
```

## Four independent apps

| App     | Production identifier   | Preview identifier              |
| ------- | ----------------------- | ------------------------------- |
| Admin   | `com.kmab.miaa.admin`   | `com.kmab.miaa.admin.preview`   |
| Mother  | `com.kmab.miaa.mother`  | `com.kmab.miaa.mother.preview`  |
| Cyclist | `com.kmab.miaa.cyclist` | `com.kmab.miaa.cyclist.preview` |
| Client  | `com.kmab.miaa.client`  | `com.kmab.miaa.client.preview`  |

Development identifiers end in `.dev`. Icons use the existing brand mark and A/M/R/C badges. Display names include Dev/Preview for test variants. Each app has independent device storage and a distinct deep-link scheme.

## Standalone preview APKs

```bash
npm run build:android -- admin preview
npm run build:android -- mother preview
npm run build:android -- cyclist preview
npm run build:android -- client preview
```

Or run `npm run verify:android` to build all four sequentially. Output: `artifacts/miaa-APP-preview-v0.8.0.apk`. These APKs bundle JS and assets and do not need the Metro server. They use Expo's test signing configuration and a `.preview` application ID; they are not production-signed releases and must not be uploaded as final store builds.

Native builds use one Gradle worker and disable project parallelism by default to control memory use. Run exports and native compilation separately. On a machine with spare memory, set `MIAA_ANDROID_BUILD_WORKERS` to an integer from 1 to 8 to change the Gradle worker count. The Round 8 supplied previews select ARM64, matching their artifact inspection records.

By default the script builds `arm64-v8a,x86_64`, covering current physical phones and common emulators. To reduce a local build to ARM64, set `MIAA_ANDROID_ARCHITECTURES=arm64-v8a` in your shell before invoking the same command. Never assume an ARM64-only APK can run on an x86 emulator.

Install using the Android file installer or `adb install -r artifacts/miaa-client-preview-v0.8.0.apk` (substitute app name). First installation may require allowing installs from your chosen file manager. Test apps cannot overwrite production apps because their IDs differ. A signature mismatch on an existing test installation requires uninstalling that test app first, which removes local app data. Resolve any uncertain pending order with an administrator before uninstalling or changing the signing key.

The CNG finalization plugin normalizes the known package-refactor/splash-template duplicate entry points, preserving splash registration. It refuses conflicting native edits. The build script verifies a single correctly namespaced MainActivity/MainApplication pair before Gradle.

The script clears the selected app’s generated image cache, regenerates `apps/APP/android` with Expo CNG and checks the actual generated themed icon before compiling. Do not edit generated files by hand. It invokes Java's Gradle wrapper directly, including on Windows, to avoid shell/path quoting problems. SDK/license/download errors fail the command; no successful APK is reported unless Gradle completed and the output file exists. A previous artifact does not prove the current build passed.

## Tests-only CI and delivery

The **Mobile tests** workflow runs `npm ci`, `npm run check` and `npm run doctor` on pushes, pull requests and manual dispatch. It does not export platforms, compile native apps or upload APKs. The standing preference is source/tests-only delivery. The owner explicitly requested Android builds for the final Round 8 delivery; the default CI is unchanged.

The native commands above are retained for the owner's manual use. Browser tests require existing web exports and Chromium; running them does not imply that a new platform build should be prepared automatically. Earlier build records are historical observations, not files included in this source update. Hosted CI can only be called green after the actual workflow runs on the pushed changes.

## Development with Metro

```bash
npm run build:android -- client development
npm run start:client -- --localhost
```

Install the resulting `development` APK and keep Metro running. For a USB-connected Android device, `adb reverse tcp:8081 tcp:8081` connects its local development server to your computer. If you intentionally use a LAN connection, use a trusted private network and the corresponding Expo CLI options. No Expo/EAS cloud account is required for these local workflows.

A native emulator can reach a backend on your computer at `http://10.0.2.2:3000`. Put that origin in `.env.local` and use only the `development` variant; preview/production reject HTTP. The apps use the existing bearer API for authentication and account security. Backend CORS settings are irrelevant to native HTTP. The optional web preview needs an approved CORS configuration to use a different-origin backend; browser tests mock the contract and do not change production CORS. Web tokens are memory-only and a full reload signs out. Native restoration uses SecureStore and requires rebuilding the app after this update; an old Round 1 APK cannot gain the new native module by restarting Metro.

## Web and browser smoke checks

```bash
npx playwright install chromium
npm run export:all
npm run verify:exports
npm run test:ui
```

Browser checks serve each app on loopback ports 3100–3103, exercise protected navigation, role-specific sign-in, Client signup, account security, logout, memory-only credentials, narrow layouts, language persistence and public connection feedback. This helps validate shared UI and routing; it does not replace Android/iOS device checks.

## Production signing

Production identifiers are reserved, and `build:android` refuses an unsigned `production` invocation unless external signing credentials and the expected certificate are supplied. Round 8 adds environment-only production signing, shared build-number validation and post-build certificate verification. See [RELEASE.md](RELEASE.md). `.gitignore` already excludes signing keys, `build-key`, certificates and credential files. Keep the same production signing identity when updating a published app; do not use a preview/debug key for production.
