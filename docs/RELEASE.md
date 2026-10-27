# Release and handoff — v0.8.0

The eight development rounds are implemented. This delivery supplies four standalone **Android preview APKs**, with separate Admin, Mother, Cyclist and Client identities. They connect to the existing `https://miaa.onrender.com` API, bundle their own JavaScript/assets and do not need Metro or Expo Go. Payments remain off-platform. No backend migration, paid hosting or new external package is required.

Preview is an internal test distribution, not a production-signed store release. Compilation, fixture tests, browser interaction and artifact inspection are recorded separately from physical-device and real-account acceptance. iOS JavaScript exports/configuration are checked, but no native iOS binary is produced on Linux.

## Install and update the supplied apps

The supplied APKs target **ARM64 Android 7.0/API 24 or newer**. An ARM64-only APK cannot run on an x86 emulator or a 32-bit-only phone. Each filename includes its role, preview variant and v0.8.0 version. All four apps can be installed together.

Open each APK using Android's file installer, or use `adb install -r artifacts/miaa-admin-preview-v0.8.0.apk` and substitute the other roles. The application IDs end in `.preview`, so these apps cannot overwrite production identities. Sign into the app matching the account role; the Admin provisions staff accounts and Client signup follows the existing verified flow. No demo account or secret is embedded.

If an older preview reports a signature conflict, first resolve every uncertain Client order, Mother support request or Admin action with the office. Uninstalling or clearing storage destroys local recovery records. Upgrade with the same signing identity when possible. The delivered APK inspection records include public certificate fingerprints for comparison.

After installation, use [ACCEPTANCE.md](ACCEPTANCE.md) with authorized accounts to check kitchen → rider → Client progress, pending-payment operations, archive effects, interrupted requests, foreground session validation, SecureStore recovery, keyboards, large text, TalkBack and human Amharic accuracy. Fixture contract tests cannot establish database/OS behavior. Browser tests run only against mocked API responses and never mutate production.

## Production signing, kept private

Production IDs are `com.kmab.miaa.admin`, `.mother`, `.cyclist` and `.client`. The Android build script now accepts `production`, with explicit private signing instead of Expo's test key. The provided preview binaries use test signing. No production key, password or certificate is generated or selected for the owner.

Use a stable private keystore **outside the repository**. Back it up securely; updates must retain the same signing identity. A different key per app is supported by setting the environment separately for each role. Obtain the SHA256 certificate fingerprint using your own key-management tooling; remove colons when supplying the expected 64-character digest. Do not copy signing passwords into source, `EXPO_PUBLIC_*`, Expo `extra`, command arguments or committed Gradle properties.

PowerShell example, replacing only the path, alias and public certificate fingerprint:

```powershell
$env:MIAA_BUILD_NUMBER = '9'
$env:MIAA_ANDROID_KEYSTORE_PATH = 'D:\PrivateKeys\miaa-admin.jks'
$env:MIAA_ANDROID_KEY_ALIAS = 'miaa-admin'
$env:MIAA_ANDROID_CERT_SHA256 = '<64 hexadecimal characters>'
$env:MIAA_ANDROID_STORE_PASSWORD = [System.Net.NetworkCredential]::new('', (Read-Host -AsSecureString 'Store password')).Password
$env:MIAA_ANDROID_KEY_PASSWORD = [System.Net.NetworkCredential]::new('', (Read-Host -AsSecureString 'Key password')).Password
npm run release:check -- admin production
npm run build:android -- admin production
Remove-Item Env:MIAA_ANDROID_STORE_PASSWORD, Env:MIAA_ANDROID_KEY_PASSWORD
```

`release:check` is a read-only metadata/file/environment preflight. It prints no credentials and does not verify a real keystore password, build, deploy or contact the API. Production signing itself is applied at Gradle execution, reading secrets from environment variables. The config plugin refuses unknown release templates instead of silently leaving release on the debug signing config. The build then verifies the resulting APK signature and expected certificate before copying an artifact. A standard Android debug certificate is rejected for production.

The production configuration/guards are tested with temporary fixtures. A real production key and production-signed build remain the owner's release step. Do not represent the supplied previews as production releases. iOS production signing requires macOS/Xcode, an appropriate signing identity/profile and separate device acceptance.

## Versions and build reproduction

The workspace version is 0.8.0; the default Android versionCode and iOS buildNumber are 8. `MIAA_BUILD_NUMBER` accepts integers 8–9999, keeping the shared integer compatible with both platforms. Increase it for every distributed update of an app, beyond the highest number already distributed for that application ID. Build numbers belong to each app identity; the four separate IDs may all use 8.

Run `npm ci`, `npm run check` and `npm run doctor` before building. For a preview, use `npm run build:android -- admin preview` or `npm run verify:android` for all four. [BUILDING.md](BUILDING.md) lists the pinned local toolchain and ABI options. The resulting artifact can be checked against the source map, public signature, bundled config, backup exclusions and native bindings. Bit-for-bit rebuild identity across machines is not promised: ZIP metadata, native paths/toolchains and signing can differ.

All twelve Android/iOS/web JavaScript exports can be produced with `npm run export:all`; `npm run verify:exports` checks source freshness, required workflow modules, role boundaries and absence of test fixtures and the audited tooling packages. `npm run test:ui` exercises the web exports with fixture APIs. Never point fixture mutation tests at live records.

## Handoff state

The default GitHub workflow remains tests only. The owner explicitly requested builds for this final round; this is a delivery-specific override of the standing no-automatic-build preference. Source is delivered as an increment after Round 7 v0.7.0, with original folders, safe updater, Git patch and verification notes. Applying source does not install an APK, deploy the API or publish a store listing.

The unsuppressed dependency audit still reports the documented upstream development-tooling findings; see [DEPENDENCIES.md](DEPENDENCIES.md). Package versions are unchanged. Compiled app/export graphs are separately inspected for those tooling packages. No hosted Round 8 CI, real-account backend integration or device acceptance is claimed until actually run. The owner can apply/push normally and inspect the resulting GitHub Actions check.
