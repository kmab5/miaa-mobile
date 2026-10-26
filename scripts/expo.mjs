import { appRole, cli, runExpo } from './shared.mjs';
cli(() => {
  const [role, command = 'start', ...args] = process.argv.slice(2);
  appRole(role);
  if (
    !['start', 'config', 'export', 'prebuild', 'install', 'run:android', 'run:ios'].includes(
      command,
    )
  )
    throw new Error('Unsupported Expo command.');
  runExpo(role, [command, ...args]);
});
