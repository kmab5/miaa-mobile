# Round 1 validation — v0.1.0

Observed on 2026-10-21. Source baseline: `kmab5/miaa-mobile` main at `ea8ac2e94206a22ae851e3559090fae6bb84b179`; the remote head was rechecked during final verification and remained unchanged. This is a full source delivery; no remote push or hosted CI success is claimed.

## Observed checks

| Check                                                                                                                       | Result                                                                |
| --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Clean `npm ci` in an extracted source archive                                                                               | Passed, pinned lockfile; no ignored install scripts                   |
| ESLint with zero allowed warnings                                                                                           | Passed                                                                |
| Prettier repository formatting                                                                                              | Passed                                                                |
| TypeScript strict check                                                                                                     | Passed                                                                |
| Jest pure/native interaction tests                                                                                          | 69 passed across 5 suites                                             |
| Repository identities, assets, icon safe areas/distinct themed badges, versions, package boundaries and documentation audit | Passed                                                                |
| Installed dependency versions versus Expo's bundled SDK matrix, all four apps                                               | Passed using the offline matrix check                                 |
| Android/iOS/web JavaScript and static exports                                                                               | All four apps passed on all three platforms                           |
| Playwright browser interactions, four apps                                                                                  | 4 passed; 360 × 800 viewport                                          |
| Live public API probe                                                                                                       | HTTP 200; `data.status = ok`, `data.apiVersion = 1`                   |
| Android ARM64 preview APK compilation                                                                                       | Passed: Admin, Mother, Cyclist and Client; signed standalone previews |
| Unfiltered `npm run security:audit`                                                                                         | Exits 1: 30 dependency entries, 2 underlying unresolved advisories    |

Browser checks exercise real Home/Workspace/Settings navigation, module entry/back navigation, row layout, visible tab labels, English/Amharic selection, persistence across reload, narrow layout, font notices, public connection success/failure and invalid module recovery. Health responses are mocked in browser tests; a separate live public probe checked the deployed endpoint. No private account or business mutation was used.

All four native packages were inspected for valid signatures, distinct preview IDs, bundled JS, all four fonts with matching source checksums, in-app font notices, matching role/API configuration, disabled cleartext traffic and corrected themed-icon pixels within the safe circle. Each packaged source map matched all 31 owned runtime modules to the final source. The package graphs exclude the two advisory-affected Node packages. [ANDROID_BUILDS.json](docs/ANDROID_BUILDS.json) records APK checksums and observed package facts.

The source build script clears only the selected app’s generated image cache and validates the generated monochrome resource before Gradle. The guard was tested against the actual stale Client image (rejected) and corrected generated icons (accepted). The final Client was rebuilt and re-inspected after this hardening.

## Toolchain and limits

Verification ran on Linux using Node 24.19.0, npm 11.9.0, Expo 58.0.16, React Native 0.88.0, React 19.3.0, OpenJDK 17.0.20, Gradle 9.4.1, Android compile SDK 37 / target 36 / minimum 24, Build Tools 37.0.0 plus transitive 36.0.0, NDK 27.1.12297006 and CMake 3.22.1. Native Android verification selects `MIAA_ANDROID_ARCHITECTURES=arm64-v8a`. The default build script additionally includes x86_64, but that additional ABI is not claimed locally verified.

Chromium 149.0.7827.55 headless shell was used through Playwright 1.61.1. The test configuration accepts `MIAA_CHROMIUM_PATH` for a locally installed compatible browser; ordinary CI installs Playwright Chromium. No test retry or arbitrary sleep was used to turn a failing assertion green. Navigation checks wait for the actual destination before the next action.

No Android emulator or physical phone was available. A signed, successfully compiled APK is not a claim of device acceptance. iOS JavaScript export passed; native iOS compilation, signing and installation require macOS/Xcode and remain unverified. Amharic editorial review and device accessibility/font-scaling acceptance remain manual checks in [ACCEPTANCE.md](docs/ACCEPTANCE.md).

The compatible framework/tooling stack emits upstream npm and Gradle/Kotlin deprecation notices. Project lint still passes with zero warnings. Upgrading Gradle to 10 or forcing unsupported dependency majors is not a verified fix for those notices.

## Outstanding dependency findings

The security audit is **not green**. `braces` 3.0.3 and `node-forge` 1.4.0 have no published patched upstream release at verification time. See [DEPENDENCIES.md](docs/DEPENDENCIES.md) for advisory links, scope, resolved transitive findings and the complete retained audit report. Quality/native CI jobs do not assert a clean advisory scan.

This is an unauthenticated foundation preview. Secure token storage, sign-in, renewal/revocation and authenticated business workflows start in Round 2. No production signing, push service or background mutation queue is claimed complete.

## Reproduce

From the repository root:

```bash
npm ci
npm run check
npm run doctor
npm run export:all
npx playwright install chromium
npm run test:ui
npm run verify:android
npm run security:audit
```

Android verification requires the SDK/JDK and accepted licenses described in [BUILDING.md](docs/BUILDING.md). The security command currently returns the outstanding findings above. After pushing, inspect the actual GitHub Actions run; configured jobs are not proof of a completed hosted run.
