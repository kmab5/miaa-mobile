# Dependency status — v0.1.0

Checked on 2026-10-21 against the committed npm lockfile. `npm run security:audit` is the unfiltered upstream audit and currently exits **1**: 30 high-severity dependency entries trace back to two underlying advisories. This is an outstanding dependency condition, not a clean security audit.

| Package      | Locked version | Advisory                                                                                                             | Published patched version |
| ------------ | -------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `braces`     | 3.0.3          | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), stack exhaustion on deeply nested patterns | None at verification      |
| `node-forge` | 1.4.0          | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), RSA signature verification issue           | None at verification      |

These are reported through Expo/Metro/Jest tooling and development certificate dependency paths. Round 1 application code does not accept glob patterns or perform RSA signature verification. Inspection of all four compiled Android JavaScript source maps confirmed that neither advisory-affected package occurs in their module graphs; this is recorded in [ANDROID_BUILDS.json](ANDROID_BUILDS.json). That scope observation does not remove the upstream tooling findings. Keep development servers private and process only trusted repository/build inputs. Native account authentication is not connected in this release.

Compatible root overrides update `uuid` to 11.1.1 and `esbuild` to 0.28.2. Updating the YAML loader to 4.3.2 removes its legacy `sprintf-js` dependency chain. The complete current machine-readable report is [security-audit-2026-10-21.json](security-audit-2026-10-21.json).

Quality/native CI jobs check source, exports, interactions and compilation; they do not assert a clean advisory audit. The standalone security command retains its failing status. Do not use `npm audit fix --force` to downgrade Expo or React Native to an incompatible major version. Recheck published upstream fixes before the authentication round and apply compatible updates with the same validation suite.
