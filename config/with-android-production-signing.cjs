const { withAppBuildGradle } = require('expo/config-plugins');
const marker = '// MIAA_PRODUCTION_SIGNING_ENV_V1';
function configureSigning(source) {
  if (source.includes(marker)) {
    if (!/release\s*\{[^{}]*signingConfig signingConfigs\.release/.test(source))
      throw new Error('Conflicting Mi’aa production signing configuration.');
    return source;
  }
  if (
    (source.match(/\bsigningConfigs\s*\{/g) || []).length !== 1 ||
    (source.match(/\brelease\s*\{/g) || []).length !== 1 ||
    !/release\s*\{[^{}]*signingConfig signingConfigs\.debug/.test(source)
  )
    throw new Error(
      'Unexpected Android release template; refusing a debug-signed production release.',
    );
  const signed = source.replace(
    /(release\s*\{[^{}]*signingConfig )signingConfigs\.debug/,
    '$1signingConfigs.release',
  );
  return signed.replace(
    /\bsigningConfigs\s*\{/,
    `signingConfigs {
        ${marker}
        release {
            def signingPath = System.getenv('MIAA_ANDROID_KEYSTORE_PATH')
            def signingStorePassword = System.getenv('MIAA_ANDROID_STORE_PASSWORD')
            def signingAlias = System.getenv('MIAA_ANDROID_KEY_ALIAS')
            def signingKeyPassword = System.getenv('MIAA_ANDROID_KEY_PASSWORD')
            if (!signingPath || !signingStorePassword || !signingAlias || !signingKeyPassword) {
                throw new GradleException('Missing production signing environment. See docs/RELEASE.md.')
            }
            storeFile file(signingPath)
            storePassword signingStorePassword
            keyAlias signingAlias
            keyPassword signingKeyPassword
        }`,
  );
}
module.exports = function withAndroidProductionSigning(config) {
  if (config.extra?.variant !== 'production') return config;
  return withAppBuildGradle(config, (result) => {
    if (result.modResults.language !== 'groovy')
      throw new Error('Production signing requires the verified Groovy template.');
    result.modResults.contents = configureSigning(result.modResults.contents);
    return result;
  });
};
module.exports.configureSigning = configureSigning;
