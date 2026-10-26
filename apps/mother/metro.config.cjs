const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// Keep builds predictable on constrained CI/dev machines; Metro stays workspace-aware.
config.maxWorkers = 1;
module.exports = config;
