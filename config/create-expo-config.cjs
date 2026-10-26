const path = require('node:path');
const { config } = require('dotenv');
const { apps } = require('./apps.cjs');
const { resolveEnvironment } = require('./environment.cjs');
const pkg = require('../package.json');
module.exports = function createExpoConfig(role) {
  config({ path: path.resolve(__dirname, '../.env.local'), quiet: true });
  config({ path: path.resolve(__dirname, '../.env'), quiet: true });
  const app = apps[role];
  if (!Object.hasOwn(apps, role) || !app) throw new Error("Unknown Mi'aa app role.");
  const environment = resolveEnvironment();
  const suffix =
    environment.variant === 'production'
      ? ''
      : `.${environment.variant === 'development' ? 'dev' : 'preview'}`;
  const nameSuffix =
    environment.variant === 'production'
      ? ''
      : environment.variant === 'development'
        ? ' Dev'
        : ' Preview';
  return {
    name: app.name + nameSuffix,
    slug: app.slug,
    version: pkg.version,
    scheme: app.scheme + (suffix ? '-' + suffix.slice(1) : ''),
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    icon: './assets/icon.png',
    ios: {
      bundleIdentifier: app.applicationId + suffix,
      supportsTablet: true,
      buildNumber: '1',
      infoPlist: { ITSAppUsesNonExemptEncryption: false },
    },
    android: {
      package: app.applicationId + suffix,
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
        monochromeImage: './assets/monochrome-icon.png',
      },
      blockedPermissions: [
        'android.permission.RECORD_AUDIO',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.SYSTEM_ALERT_WINDOW',
      ],
      predictiveBackGestureEnabled: true,
    },
    web: { bundler: 'metro', output: 'static', favicon: './assets/favicon.png' },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        { image: './assets/splash.png', imageWidth: 96, backgroundColor: '#ffffff' },
      ],
      ['expo-build-properties', { android: { usesCleartextTraffic: environment.allowsCleartext } }],
    ],
    experiments: { typedRoutes: false },
    extra: {
      role,
      variant: environment.variant,
      apiOrigin: environment.apiOrigin,
      appVersion: pkg.version,
      foundationPreview: true,
    },
  };
};
