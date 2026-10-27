const { existsSync, realpathSync, statSync } = require('node:fs');
const { resolve, relative, isAbsolute, sep } = require('node:path');
const { apps } = require('./apps.cjs');
const defaultBuildNumber = 8;
function releaseMetadata(env = process.env) {
  const raw = env.MIAA_BUILD_NUMBER || String(defaultBuildNumber);
  if (
    typeof raw !== 'string' ||
    raw.trim() !== raw ||
    !/^[1-9]\d{0,9}$/.test(raw) ||
    Number(raw) < defaultBuildNumber ||
    Number(raw) > 9999
  )
    throw new Error(
      'MIAA_BUILD_NUMBER must be an integer from 8 to 9999. Increase it for each distributed update.',
    );
  return { versionCode: Number(raw), buildNumber: raw };
}
/** Private key material is consumed through environment variables, never Expo extra/Gradle files. */
function productionSigning(env, role, repoRoot) {
  if (!Object.hasOwn(apps, role)) throw new Error('Unknown app role.');
  const keys = [
    'MIAA_ANDROID_KEYSTORE_PATH',
    'MIAA_ANDROID_STORE_PASSWORD',
    'MIAA_ANDROID_KEY_ALIAS',
    'MIAA_ANDROID_KEY_PASSWORD',
    'MIAA_ANDROID_CERT_SHA256',
  ];
  if (keys.some((key) => typeof env[key] !== 'string' || !env[key].trim()))
    throw new Error(
      'Production signing requires a private external keystore, store/key passwords, alias and expected certificate SHA256. See docs/RELEASE.md.',
    );
  if (env.MIAA_ANDROID_STORE_PASSWORD.length < 6 || env.MIAA_ANDROID_KEY_PASSWORD.length < 6)
    throw new Error('Signing passwords must have at least six characters.');
  if (!/^[a-f0-9]{64}$/i.test(env.MIAA_ANDROID_CERT_SHA256))
    throw new Error('MIAA_ANDROID_CERT_SHA256 must contain 64 hexadecimal characters.');
  if (!isAbsolute(env.MIAA_ANDROID_KEYSTORE_PATH))
    throw new Error('Use an absolute external keystore path.');
  const path = resolve(env.MIAA_ANDROID_KEYSTORE_PATH);
  if (!existsSync(path) || !statSync(path).isFile())
    throw new Error('The external signing keystore file is unavailable.');
  const root = realpathSync(repoRoot),
    actual = realpathSync(path),
    rel = relative(root, actual);
  if (rel === '' || (rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel)))
    throw new Error('Keep production signing keys outside the repository.');
  return { certificateSha256: env.MIAA_ANDROID_CERT_SHA256.toLowerCase() };
}
function assertSigner(output, expected) {
  if (expected && /certificate DN:.*CN=Android Debug/i.test(output))
    throw new Error('A test signing certificate cannot be used for production.');
  const matches = [
    ...output.matchAll(
      /^(?:Signer #\d+|V[1-4](?:\.\d+)? Signer):? certificate SHA-256 digest: ([a-f0-9]{64})\r?$/gim,
    ),
  ];
  const count = output.match(/^Number of signers: (\d+)\r?$/im)?.[1];
  const certificates = new Set(matches.map((match) => match[1].toLowerCase()));
  if (
    certificates.size !== 1 ||
    (count !== undefined ? count !== '1' : matches.length !== 1) ||
    (expected && !certificates.has(expected.toLowerCase()))
  )
    throw new Error('APK signing certificate does not match the expected release identity.');
  return matches[0][1].toLowerCase();
}
module.exports = { releaseMetadata, productionSigning, assertSigner };
