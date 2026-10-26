import { roles } from '../config/apps.cjs';
import { cli, runExpo, loadEnvironment } from './shared.mjs';
cli(() => {
  for (const role of roles)
    runExpo(
      role,
      ['export', '--platform', 'all', '--max-workers', '1'],
      loadEnvironment({ CI: '1', MIAA_BUILD_VARIANT: 'preview' }),
    );
});
