import { roles } from '../config/apps.cjs';
import { cli, runExpo, loadEnvironment } from './shared.mjs';
cli(() => {
  for (const role of roles)
    runExpo(role, ['install', '--check'], loadEnvironment({ EXPO_OFFLINE: '1', CI: '1' }));
});
