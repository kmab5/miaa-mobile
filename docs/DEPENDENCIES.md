# Dependency status — v0.2.0

Checked on 2026-10-23 against the pinned lockfile. The unfiltered `npm run security:audit` exits **1**, reporting four high dependency entries from one underlying advisory. This is not a clean security audit.

`node-forge` 1.4.0 remains affected by [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv); no published patched version is listed at verification. It is reached through Expo development certificate tooling. The mobile app does not implement RSA verification through this package. Keep dev servers private and process trusted build inputs. Do not force the audit's incompatible Expo downgrade suggestion or vendor an unreviewed cryptographic patch.

The earlier `braces` advisory [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) was **withdrawn on 2026-10-23** because upstream no longer considers it practically exploitable. The package remains locked to 3.0.3; the reduction in advisory count is not a claim that we patched it.

Root overrides retain compatible `uuid` 11.1.1, `esbuild` 0.28.2 and `js-yaml` 4.3.2, avoiding the old sprintf-js loader chain. The new native dependency is SDK-compatible `expo-secure-store` 58.0.2. [The current raw audit report](security-audit-2026-10-23.json) retains all findings and npm remediation metadata. [The Round 1 report](security-audit-2026-10-21.json) is historical.

Quality/native CI jobs check source, exports, interactions and compilation; they do not assert a clean audit. The standalone security command retains its failing exit status. Upstream tooling deprecation notices are distinct from zero-warning project lint. Compatible upgrades must pass the same validation before adoption.
