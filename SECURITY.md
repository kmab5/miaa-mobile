# Security boundaries

No private account data or authenticated request is used by the Round 1 preview. The sole network action is a user-initiated public health probe. Build configuration rejects wrong-role identities and insecure nonlocal origins. HTTPS is mandatory in preview/production. Roles will be authorized by the backend, not by installation of a particular app.

Only non-sensitive language preferences use AsyncStorage. Never store bearer tokens, passwords, Telegram invites or signing secrets there. Secure credential storage and authentication are Round 2. Keep `.env.local`, keystores, `build-key`, signing passwords, service credentials and machine-specific SDK paths out of Git. Every `EXPO_PUBLIC_*` value is public, compiled into the app.

Errors displayed in the product do not expose raw exceptions, stack traces, database details or tokens. Connection retries are explicit and cancellable. A positive health result is not an authorization or database-integrity check.

## Dependency audit

`npm run security:audit` runs the unfiltered npm advisory audit. The release validation records its actual exit status and unresolved advisories. Do not suppress a new finding, downgrade the framework to an incompatible ancient release suggested by automated remediation, edit the lockfile to fabricate versions, or claim a clean audit while advisories remain. Compatible patched transitive dependencies are preferred and must be verified with exports/native builds.

At initial installation, published advisories affected transitive build/test tooling, including `braces`, `node-forge`, `sprintf-js`, `uuid` and `esbuild`. Compatible overrides update UUID/esbuild and replace the legacy YAML loader chain to remove sprintf-js. Some advisories currently have no published upstream patched release; the final validation must distinguish those from resolved findings. See [dependency details and the retained audit report](docs/DEPENDENCIES.md) and [VALIDATION.md](VALIDATION.md).

Keep Metro restricted to localhost/USB for routine development; expose it to a LAN only when necessary on a trusted private network. Test preview APKs have distinct application IDs and test-only signing, and must not be presented as production-signed applications.
