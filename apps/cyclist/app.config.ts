import type { ExpoConfig } from 'expo/config';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const createConfig = require('../../config/create-expo-config.cjs') as (role: string) => ExpoConfig;
export default createConfig('cyclist');
