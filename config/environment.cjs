/** Pure validation shared by Expo config, build scripts and tests. */
const variants = ['development', 'preview', 'production'];
function resolveEnvironment(env = process.env) {
  const variant = env.MIAA_BUILD_VARIANT || 'development';
  if (!variants.includes(variant))
    throw new Error('MIAA_BUILD_VARIANT must be development, preview or production.');
  const raw = env.EXPO_PUBLIC_API_ORIGIN || 'https://miaa.onrender.com';
  let origin;
  try {
    origin = new URL(raw);
  } catch {
    throw new Error('EXPO_PUBLIC_API_ORIGIN must be an absolute origin.');
  }
  if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash)
    throw new Error('API origin must not contain credentials, paths, queries or fragments.');
  const host = origin.hostname;
  const privateHost =
    host === 'localhost' ||
    host === '[::1]' ||
    /^127\.\d+\.\d+\.\d+$/.test(host) ||
    /^10\.\d+\.\d+\.\d+$/.test(host) ||
    /^192\.168\.\d+\.\d+$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host);
  if (
    origin.protocol !== 'https:' &&
    !(variant === 'development' && origin.protocol === 'http:' && privateHost)
  )
    throw new Error('Use HTTPS. HTTP is allowed only for private/local development origins.');
  return { variant, apiOrigin: origin.origin, allowsCleartext: origin.protocol === 'http:' };
}
module.exports = { resolveEnvironment, variants };
