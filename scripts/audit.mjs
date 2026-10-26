/** Deterministic repository/contract checks; never contacts the backend. */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { checkMonochromeIcon } from '../config/check-icon.mjs';
import { roles, apps } from '../config/apps.cjs';
const require = createRequire(import.meta.url);
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const problems = [];
const assert = (condition, message) => {
  if (!condition) problems.push(message);
};
const ids = new Set();
const themedIcons = new Set();
for (const role of roles) {
  const dir = join('apps', role),
    p = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  assert(p.version === pkg.version, `${role}: version drift`);
  assert(p.main === 'expo-router/entry', `${role}: missing router entry`);
  assert(
    p.dependencies.react === '19.3.0' && p.dependencies['react-native'] === '0.88.0',
    `${role}: unexpected React/native version`,
  );
  assert(
    readFileSync(join(dir, 'app/_layout.tsx'), 'utf8').includes(`role="${role}"`),
    `${role}: wrong role entrypoint`,
  );
  for (const path of [
    '(tabs)/_layout.tsx',
    '(tabs)/index.tsx',
    '(tabs)/workspace.tsx',
    '(tabs)/settings.tsx',
    'modules/[module].tsx',
    '+not-found.tsx',
    'licenses.tsx',
    'sign-in.tsx',
    'security.tsx',
  ])
    assert(existsSync(join(dir, 'app', path)), `${role}: missing ${path}`);
  assert(
    p.dependencies['expo-secure-store'] === '58.0.2' &&
      p.dependencies['@miaa/auth'] === pkg.version,
    `${role}: missing authentication/native dependency`,
  );
  assert(!ids.has(apps[role].applicationId), `${role}: duplicate app identifier`);
  ids.add(apps[role].applicationId);
  for (const [name, size] of [
    ['icon', 1024],
    ['adaptive-icon', 1024],
    ['monochrome-icon', 1024],
    ['splash', 288],
    ['favicon', 64],
  ]) {
    const image = readFileSync(join(dir, 'assets', `${name}.png`));
    assert(
      image.subarray(1, 4).toString() === 'PNG' &&
        image.readUInt32BE(16) === size &&
        image.readUInt32BE(20) === size,
      `${role}: invalid ${name} dimensions`,
    );
  }
}
for (const role of roles) {
  const file = join('apps', role, 'assets/monochrome-icon.png');
  try {
    themedIcons.add(await checkMonochromeIcon(file));
  } catch (error) {
    problems.push(error.message);
  }
}
assert(themedIcons.size === roles.length, 'Themed icons must distinguish all four roles');
for (const name of ['api', 'auth', 'client-portal', 'config', 'i18n', 'ui', 'shell']) {
  const p = JSON.parse(readFileSync(`packages/${name}/package.json`, 'utf8'));
  assert(
    p.version === pkg.version && p.private === true && existsSync(`packages/${name}/${p.main}`),
    `${name}: invalid workspace entry/version`,
  );
}
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
assert(lock.packages[''].version === pkg.version, 'Lockfile/root version drift');
for (const name of ['react', 'react-native']) {
  const versions = new Set(
    Object.entries(lock.packages)
      .filter(([path]) => path.endsWith('node_modules/' + name))
      .map(([, value]) => value.version),
  );
  assert(versions.size === 1, `Duplicate ${name} versions`);
}
const fonts = 'packages/ui/assets/fonts';
for (const name of [
  'Poppins-Regular',
  'Poppins-SemiBold',
  'NotoSansEthiopic-Regular',
  'NotoSansEthiopic-SemiBold',
])
  assert(statSync(join(fonts, name + '.ttf')).size > 10000, `Missing/invalid font: ${name}`);
for (const family of ['poppins', 'ethiopic'])
  assert(
    readFileSync(join(fonts, family + '-LICENSE_FONT.txt'), 'utf8').includes(
      'SIL OPEN FONT LICENSE',
    ),
    `Missing font license: ${family}`,
  );
assert(
  readFileSync('packages/ui/src/font-licenses.ts', 'utf8').includes('SIL OPEN FONT LICENSE'),
  'Font notices are not included in the app bundle',
);
const backendImports =
  /(?:from\s*['"](?:next(?:\/|['"])|postgres(?:['"]|\/)|drizzle-orm)|process\.env\.(?:DATABASE_URL|TELEGRAM_BOT_TOKEN))/;
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? ['node_modules', 'android', 'ios', '.expo'].includes(entry.name) ||
        entry.name.startsWith('dist')
        ? []
        : walk(join(dir, entry.name))
      : [join(dir, entry.name)],
  );
}
for (const file of [...walk('packages'), ...walk('apps')].filter((file) => /\.[jt]sx?$/.test(file)))
  assert(
    !backendImports.test(readFileSync(file, 'utf8')),
    `${file}: forbidden server-only dependency/secret`,
  );
for (const [name, command] of Object.entries(pkg.scripts))
  for (const match of command.matchAll(/scripts\/[\w.-]+/g))
    assert(existsSync(match[0]), `${name}: missing script ${match[0]}`);
for (const file of ['README.md', 'VALIDATION.md', 'docs/PROGRESS.md'])
  assert(readFileSync(file, 'utf8').includes(pkg.version), `${file}: missing release version`);
for (const file of [
  'README.md',
  'SECURITY.md',
  'VALIDATION.md',
  ...walk('docs').filter((file) => file.endsWith('.md')),
]) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\[[^\]]*\]\(([^\s)]+)\)/g)) {
    const path = match[1].split('#')[0];
    if (path && !/^(https?:|mailto:)/.test(path))
      assert(existsSync(resolve(dirname(file), path)), `${file}: broken link ${path}`);
  }
  for (const match of text.matchAll(/npm run ([a-zA-Z0-9:-]+)/g))
    assert(Object.hasOwn(pkg.scripts, match[1]), `${file}: unknown script ${match[1]}`);
}
// Resolved package copies must remain the versions the SDK expects.
assert(require('expo/package.json').version === '58.0.16', 'Unexpected installed Expo SDK');
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(
  'Project audit: four identities, routes, assets, versions, workspace boundaries and documentation are consistent.',
);
