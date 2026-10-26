import { roles } from '../config/apps.cjs';
import { root, run, cli } from './shared.mjs';
import { join } from 'node:path';
cli(() => {
  for (const role of roles)
    run(process.execPath, [join(root, 'scripts/android.mjs'), role, 'preview']);
});
