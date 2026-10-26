# Dependency status — v0.5.0

Checked on 2026-10-26 against the pinned lockfile. The unfiltered `npm run security:audit` exits **1**, reporting five high dependency entries from two underlying advisories. This is not a clean security audit.

`node-forge` 1.4.0 remains affected by [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv); no published patched version is listed at verification. It is reached through Expo development certificate tooling. The mobile app does not implement RSA verification through this package. Keep dev servers private and process trusted build inputs. Do not force the audit's incompatible Expo downgrade suggestion or vendor an unreviewed cryptographic patch.

The earlier `braces` advisory [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) was **withdrawn on 2026-10-23** because upstream no longer considers it practically exploitable. The package remains locked to 3.0.3; the reduction in advisory count is not a claim that we patched it.

Root overrides retain compatible `uuid` 11.1.1, `esbuild` 0.28.2 and `js-yaml` 4.3.2, avoiding the old sprintf-js loader chain. Round 2 added SDK-compatible `expo-secure-store` 58.0.2; Round 3 adds `expo-crypto` 58.0.7 for secure order keys; Round 4 reuses that same version for Mother request fingerprints, without introducing another external package version. [The Round 3 audit report](security-audit-2026-10-26.json) retains all findings and npm remediation metadata. [The Round 1 report](security-audit-2026-10-21.json) is historical.

Automatic CI checks source, native interactions and the installed SDK matrix; build tooling remains manual. These jobs do not assert a clean audit. The standalone security command retains its failing exit status. Upstream tooling deprecation notices are distinct from zero-warning project lint. Compatible upgrades must pass the same validation before adoption.

Expo CLI also retains Zod 3.25.76 under its declared `^3.25.76` range. [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) currently marks versions below 4.6.6 affected by oversized-collection memory exhaustion. The separate ESLint tooling copy is already 4.6.7. A blanket Zod 4 override would cross Expo CLI’s declared major range, so no unreviewed major substitution or forced Expo downgrade is applied. Both affected package graphs are development tooling. Rounds 4–5 check source boundaries and does not rebuild the earlier exported/native graphs. Keep development servers private and build from trusted inputs. Upstream SDK-compatible fixes should be adopted once verified.

The build runtime floor is now Node 24.22.1 on the 24 LTS line, matching `.nvmrc`, `.node-version`, CI and the validated environment. It is an upstream [security release](https://nodejs.org/en/blog/release/v24.22.1); older Round 1/2 runtime pins should be updated before installing dependencies.

[The Round 4 unfiltered audit](security-audit-round4-2026-10-26.json) still reports five high entries and no critical/moderate/low entries. No findings are suppressed.

Round 5 adds only the local `@miaa/cyclist-portal` workspace. External package versions are unchanged. [Its unfiltered audit](security-audit-round5-2026-10-26.json) continues to report five high entries from the same two tooling advisories. No advisory is suppressed.
