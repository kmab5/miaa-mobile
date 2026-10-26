/** Verify final app source against Metro's native and indexed web source maps. */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { roles } from '../config/apps.cjs';
import { root, cli } from './shared.mjs';
function* sources(map) {
  if (map.sections) {
    for (const section of map.sections) yield* sources(section.map);
  } else {
    for (const [index, file] of (map.sources ?? []).entries())
      yield [file, map.sourcesContent?.[index]];
  }
}
cli(() => {
  for (const role of roles)
    for (const platform of ['android', 'ios', 'web']) {
      const directory = join(root, 'apps', role, 'dist/_expo/static/js', platform);
      if (!existsSync(directory)) throw new Error(`Export ${role}/${platform} first.`);
      const maps = readdirSync(directory).filter((name) => name.endsWith('.map'));
      if (!maps.length) throw new Error(`Export ${role}/${platform} with --source-maps.`);
      const owned = new Set();
      for (const file of maps) {
        const map = JSON.parse(readFileSync(join(directory, file), 'utf8'));
        for (const [source, content] of sources(map)) {
          const path = source.replaceAll('\\', '/');
          const match = path.match(
            /(?:^|\/)((?:packages\/[^/]+\/src|apps\/(?:admin|mother|cyclist|client)\/app)\/[^?]+)$/,
          );
          if (!match) continue;
          const relative = match[1];
          if (role !== 'client' && relative.startsWith('packages/client-portal/'))
            throw new Error(`${role}/${platform} contains Client workflows.`);
          if (relative.startsWith('apps/') && !relative.startsWith(`apps/${role}/`))
            throw new Error(`${role}/${platform} contains another app's route: ${relative}`);
          const original = join(root, relative);
          if (!existsSync(original) || content !== readFileSync(original, 'utf8'))
            throw new Error(`Re-export ${role}/${platform}: source differs for ${relative}`);
          owned.add(relative);
        }
      }
      for (const required of [
        `apps/${role}/app/_layout.tsx`,
        'packages/auth/src/controller.ts',
        'packages/auth/src/storage.ts',
        'packages/auth/src/validation.ts',
        'packages/shell/src/sign-in.tsx',
        'packages/shell/src/security.tsx',
        ...(role === 'client'
          ? [
              'apps/client/app/client/[screen].tsx',
              ...[
                'orders.ts',
                'storage.ts',
                'validation.ts',
                'provider.tsx',
                'screens.tsx',
                'components.tsx',
                'text.ts',
              ].map((file) => `packages/client-portal/src/${file}`),
            ]
          : []),
      ])
        if (!owned.has(required)) throw new Error(`${role}/${platform} omitted ${required}`);
      console.log(`${role}/${platform}: ${owned.size} app modules match final source.`);
    }
});
