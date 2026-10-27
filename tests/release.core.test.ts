import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
const require = createRequire(resolve('tests/release.core.test.ts'));
const { releaseMetadata, productionSigning, assertSigner } = require('../config/release.cjs');
const { configureSigning } = require('../config/with-android-production-signing.cjs');
const template = `android {
  signingConfigs {
    debug { storeFile file('debug.keystore') }
  }
  buildTypes {
    debug { signingConfig signingConfigs.debug }
    release {
      // Caution! In production, you need to generate your own keystore file.
      signingConfig signingConfigs.debug
      shrinkResources false
    }
  }
}`;
const cert = 'a'.repeat(64);
test('release version metadata is monotonic and consistent across native platforms', () => {
  expect(releaseMetadata({})).toEqual({ versionCode: 8, buildNumber: '8' });
  expect(releaseMetadata({ MIAA_BUILD_NUMBER: '42' })).toEqual({
    versionCode: 42,
    buildNumber: '42',
  });
});
test.each([
  '0',
  '7',
  '-1',
  '8.1',
  '08',
  'NaN',
  'Infinity',
  '10000',
  '2100000001',
  '2147483648',
  '8\n',
])('rejects unsafe build number %s', (value) =>
  expect(() => releaseMetadata({ MIAA_BUILD_NUMBER: value })).toThrow(),
);
test('production transform changes only release signing, reads env at Gradle time and is idempotent', () => {
  const signed = configureSigning(template);
  expect(signed).toContain('debug { signingConfig signingConfigs.debug }');
  expect(signed).toMatch(/release\s*\{[^{}]*signingConfig signingConfigs.release/);
  expect(signed).toContain("System.getenv('MIAA_ANDROID_STORE_PASSWORD')");
  expect(configureSigning(signed)).toBe(signed);
  expect(signed).not.toContain('password-from-test');
});
test.each([
  template.replace('signingConfigs {', 'signingConfigsChanged {'),
  template.replace(
    'signingConfig signingConfigs.debug\n',
    'signingConfig signingConfigs.unknown\n',
  ),
  template + '\nrelease {}',
])('unknown native templates fail closed', (source) =>
  expect(() => configureSigning(source)).toThrow(),
);
test('production credential preflight accepts an external key without printing or returning secrets', () => {
  const folder = mkdtempSync(join(tmpdir(), 'miaa-release-'));
  try {
    const repo = join(folder, 'repo');
    mkdirSync(repo);
    const key = join(folder, 'private.jks');
    writeFileSync(key, 'fixture only');
    const env = {
      MIAA_ANDROID_KEYSTORE_PATH: key,
      MIAA_ANDROID_STORE_PASSWORD: 'password-from-test',
      MIAA_ANDROID_KEY_ALIAS: 'release',
      MIAA_ANDROID_KEY_PASSWORD: 'key-password-from-test',
      MIAA_ANDROID_CERT_SHA256: cert,
    };
    expect(productionSigning(env, 'admin', repo)).toEqual({ certificateSha256: cert });
    for (const role of ['mother', 'cyclist', 'client'])
      expect(productionSigning(env, role, repo)).toEqual({ certificateSha256: cert });
    for (const k of Object.keys(env))
      expect(() => productionSigning({ ...env, [k]: '' }, 'admin', repo)).toThrow();
    expect(() =>
      productionSigning({ ...env, MIAA_ANDROID_KEYSTORE_PATH: 'private.jks' }, 'admin', repo),
    ).toThrow();
    const internal = join(repo, 'private.jks');
    writeFileSync(internal, 'fixture only');
    expect(() =>
      productionSigning({ ...env, MIAA_ANDROID_KEYSTORE_PATH: internal }, 'admin', repo),
    ).toThrow();
    expect(() => productionSigning(env, '__proto__', repo)).toThrow();
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
test('APK certificate verification rejects mismatches, multiple signers, missing digests and production debug keys', () => {
  const line = `Signer #1 certificate SHA-256 digest: ${cert}`;
  expect(assertSigner(line, cert)).toBe(cert);
  for (const source of ['', line + '\n' + line]) expect(() => assertSigner(source, cert)).toThrow();
  expect(() => assertSigner(line, 'b'.repeat(64))).toThrow();
  expect(() =>
    assertSigner('Signer #1 certificate DN: CN=Android Debug, O=Android\n' + line, cert),
  ).toThrow();
  expect(assertSigner('Signer #1 certificate DN: CN=Android Debug, O=Android\n' + line)).toBe(cert);
});
test('current Build Tools v2 signer output and same-key multi-scheme output retain one verified identity', () => {
  const current = `Verifies\nNumber of signers: 1\nV2 Signer: certificate SHA-256 digest: ${cert}\n`;
  expect(assertSigner(current)).toBe(cert);
  expect(assertSigner(current + `V3 Signer: certificate SHA-256 digest: ${cert}\n`, cert)).toBe(
    cert,
  );
  expect(() => assertSigner(current.replace('signers: 1', 'signers: 2'), cert)).toThrow();
  expect(() =>
    assertSigner(current + `V3 Signer: certificate SHA-256 digest: ${'b'.repeat(64)}\n`, cert),
  ).toThrow();
});
