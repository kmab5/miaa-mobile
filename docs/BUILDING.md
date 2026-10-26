# Build and install

Run commands in the repository root. The scripts use Node process APIs rather than Unix-only shell commands, so the same npm commands work in Windows PowerShell, macOS and Linux.

## Prerequisites

- Node 24.19+ on the 24 release line; npm 11.9.0 (recorded in `.nvmrc`, `.node-version` and `packageManager`).
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

Or run `npm run verify:android` to build all four sequentially. Output: `artifacts/miaa-APP-preview-v0.1.0.apk`. These APKs bundle JS and assets and do not need the Metro server. They use Expo's test signing configuration and a `.preview` application ID; they are not production-signed releases and must not be uploaded as final store builds.

By default the script builds `arm64-v8a,x86_64`, covering current physical phones and common emulators. To reduce a local build to ARM64, set `MIAA_ANDROID_ARCHITECTURES=arm64-v8a` in your shell before invoking the same command. Never assume an ARM64-only APK can run on an x86 emulator.

Install using the Android file installer or `adb install -r artifacts/miaa-client-preview-v0.1.0.apk` (substitute app name). First installation may require allowing installs from your chosen file manager. Test apps cannot overwrite production apps because their IDs differ. A signature mismatch on an existing test installation requires uninstalling that test app first, which removes its local preferences.

The script clears the selected app’s generated image cache, regenerates `apps/APP/android` with Expo CNG and checks the actual generated themed icon before compiling. Do not edit generated files by hand. It invokes Java's Gradle wrapper directly, including on Windows, to avoid shell/path quoting problems. SDK/license/download errors fail the command; no successful APK is reported unless Gradle completed and the output file exists. A previous artifact does not prove the current build passed.

## GitHub build artifacts

After applying and pushing this repository, the **Mobile checks** workflow runs source/browser checks and builds all four Android preview apps. Open the completed run under GitHub Actions and download the `miaa-APP-preview` artifacts. They contain the standalone test APKs and are retained for seven days. This uses the repository’s CI runner; no Expo/EAS build account is required. A workflow included in the ZIP is not evidence that a hosted run has already passed—check the actual run after pushing.

## Development with Metro

```bash
npm run build:android -- client development
npm run start:client -- --localhost
```

Install the resulting `development` APK and keep Metro running. For a USB-connected Android device, `adb reverse tcp:8081 tcp:8081` connects its local development server to your computer. If you intentionally use a LAN connection, use a trusted private network and the corresponding Expo CLI options. No Expo/EAS cloud account is required for these local workflows.

A native emulator can reach a backend on your computer at `http://10.0.2.2:3000`. Put that origin in `.env.local` and use only the `development` variant; preview/production reject HTTP. The public health check is the only API request in Round 1. Backend CORS settings are irrelevant to native HTTP, but the optional web preview needs appropriate CORS behavior for a real cross-origin service probe; browser tests mock that public endpoint.

## Web and browser smoke checks

```bash
npx playwright install chromium
npm run export:all
npm run test:ui
```

Browser checks serve each app on loopback ports 3100–3103, inspect a narrow layout, follow workspace/module routes, persist Amharic and exercise connection results. This helps validate shared UI and routing; it does not replace Android/iOS device checks.

## Future production signing

Production identifiers are reserved now, but `build:android` intentionally refuses a `production` argument until release signing is implemented. Round 8 will add stable private keystores, version increments and release builds. `.gitignore` already excludes signing keys, `build-key`, certificates and credential files. Keep the same production signing identity when updating a published app; do not use a preview/debug key for production.
