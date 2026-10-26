const { withFinalizedMod } = require('expo/config-plugins');
const { normalizeAndroidEntrypoints } = require('./normalize-android-entrypoints.cjs');
/** Run after package refactoring and splash mods have finished writing their source files. */
module.exports = function withAndroidEntrypoints(config) {
  return withFinalizedMod(config, [
    'android',
    async (result) => {
      if (result.modRequest.introspect) return result;
      normalizeAndroidEntrypoints(result.modRequest.platformProjectRoot, result.android.package);
      return result;
    },
  ]);
};
