const aliases = {
  '^@miaa/([^/]+)$': '<rootDir>/packages/$1/src/index.ts',
  '\\.(ttf|png|jpg)$': '<rootDir>/tests/asset.mock.cjs',
};
module.exports = {
  projects: [
    {
      displayName: 'core',
      rootDir: '.',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/**/*.core.test.ts'],
      transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
      moduleNameMapper: aliases,
    },
    {
      displayName: 'native',
      rootDir: '.',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/tests/**/*.native.test.tsx'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.native.tsx'],
      moduleNameMapper: {
        ...aliases,
        '^lucide-react-native$':
          '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
      },
      transformIgnorePatterns: [
        'node_modules/(?!(react-native[^/]*|@react-native/.*|@react-native-community/.*|expo[^/]*|@expo/.*|@react-navigation/.*|lucide-react-native)/)',
      ],
    },
  ],
};
