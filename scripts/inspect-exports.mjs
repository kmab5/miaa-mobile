/** Verify final app source against Metro's native and indexed web source maps. */
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
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
  const reports = [];
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
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
          if (/(?:^|\/)(?:tests\/fixtures|node_modules\/(?:node-forge|zod))\//.test(path))
            throw new Error(`${role}/${platform} includes test data or advisory tooling: ${path}`);
          if (!match) continue;
          const relative = match[1];
          const portal = relative.match(/^packages\/(admin|mother|cyclist|client)-portal\//)?.[1];
          if (portal && portal !== role)
            throw new Error(`${role}/${platform} contains ${portal} workflows.`);
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
        ...(['mother', 'cyclist', 'admin'].includes(role)
          ? [
              'contracts.ts',
              'controller.ts',
              'provider.tsx',
              'screens.tsx',
              'components.tsx',
              'text.ts',
              ...(role !== 'cyclist' ? ['storage.ts'] : []),
              ...(role === 'admin'
                ? [
                    'forms.ts',
                    'business-contracts.ts',
                    'business-forms.ts',
                    'business-screens.tsx',
                    'business-text.ts',
                    'archive.tsx',
                  ]
                : []),
            ].map((file) => `packages/${role}-portal/src/${file}`)
          : []),
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
      const hashes = Object.fromEntries(
        [...owned].sort().map((path) => [
          path,
          createHash('sha256')
            .update(readFileSync(join(root, path)))
            .digest('hex'),
        ]),
      );
      reports.push({
        role,
        platform,
        ownedRuntimeModulesMatchingSource: owned.size,
        ownedSourceDigestSha256: createHash('sha256').update(JSON.stringify(hashes)).digest('hex'),
        crossRoleWorkflows: false,
        advisoryTooling: false,
        testFixtures: false,
      });
      console.log(`${role}/${platform}: ${owned.size} app modules match final source.`);
    }
  mkdirSync(join(root, 'artifacts'), { recursive: true });
  writeFileSync(
    join(root, 'artifacts', `exports-v${version}.json`),
    JSON.stringify({ version, exports: reports }, null, 2) + '\n',
  );
});
