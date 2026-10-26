import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { roles } from '../config/apps.cjs';
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const require = createRequire(import.meta.url);
export const expoCli = join(dirname(require.resolve('expo/package.json')), 'bin', 'cli');
export function appRole(value) {
  if (!roles.includes(value)) throw new Error(`Choose an app: ${roles.join(', ')}.`);
  return value;
}
export function appDirectory(role) {
  return join(root, 'apps', appRole(role));
}
export function loadEnvironment(overrides = {}) {
  config({ path: join(root, '.env.local'), quiet: true });
  config({ path: join(root, '.env'), quiet: true });
  return { ...process.env, ...overrides };
}
export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    ...options,
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} failed (${result.status ?? result.signal}).`);
}
export function runExpo(role, args, env = loadEnvironment()) {
  run(process.execPath, [expoCli, ...args], { cwd: appDirectory(role), env });
}
export function cli(main) {
  Promise.resolve()
    .then(main)
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
