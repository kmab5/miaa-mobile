import { describe, it, expect, afterEach } from '@jest/globals';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
const require = createRequire(resolve('tests/android-entrypoints.core.test.ts'));
const { normalizeAndroidEntrypoints, assertAndroidEntrypoints } =
  require('../config/normalize-android-entrypoints.cjs') as {
    normalizeAndroidEntrypoints(root: string, namespace: string): void;
    assertAndroidEntrypoints(root: string, namespace: string): void;
  };
const folders: string[] = [];
const namespace = 'com.kmab.miaa.mother.preview';
function root() {
  const dir = mkdtempSync(join(tmpdir(), 'miaa-entrypoints-'));
  folders.push(dir);
  return dir;
}
function file(dir: string, pkg: string, name: string) {
  return join(dir, 'app/src/main/java', ...pkg.split('.'), name + '.kt');
}
function write(dir: string, pkg: string, name: string, body: string) {
  const path = file(dir, pkg, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `package ${pkg}\n${body}`);
  return path;
}
const plain = 'class MainActivity {\n fun onCreate() {\n setTheme(R.style.AppTheme);\n }\n}\n';
const splash =
  'import expo.modules.splashscreen.SplashScreenManager\nclass MainActivity {\n fun onCreate() {\n // setTheme(R.style.AppTheme);\n // @generated begin expo-splashscreen - expo prebuild\n SplashScreenManager.registerOnActivity(this)\n // @generated end expo-splashscreen\n }\n}\n';
const application =
  'class MainApplication { val level = BuildConfig.REACT_NATIVE_RELEASE_LEVEL }\n';
afterEach(() => {
  for (const dir of folders.splice(0)) rmSync(dir, { recursive: true, force: true });
});
describe('Android CNG package refactor finalization', () => {
  it('merges the reproduced duplicate template without losing splash registration or BuildConfig namespace', () => {
    const dir = root();
    write(dir, namespace, 'MainActivity', plain);
    write(dir, namespace, 'MainApplication', application);
    const oldActivity = write(dir, 'com.miaamotherpreview', 'MainActivity', splash);
    const oldApplication = write(dir, 'com.miaamotherpreview', 'MainApplication', application);
    normalizeAndroidEntrypoints(dir, namespace);
    assertAndroidEntrypoints(dir, namespace);
    expect(existsSync(oldActivity)).toBe(false);
    expect(existsSync(oldApplication)).toBe(false);
    expect(readFileSync(file(dir, namespace, 'MainActivity'), 'utf8')).toBe(
      `package ${namespace}\n${splash}`,
    );
    expect(readFileSync(file(dir, namespace, 'MainApplication'), 'utf8')).toBe(
      `package ${namespace}\n${application}`,
    );
  });
  it('leaves already correct generated files byte-identical on repeated prebuilds', () => {
    const dir = root();
    const activity = write(dir, namespace, 'MainActivity', splash);
    const app = write(dir, namespace, 'MainApplication', application);
    const before = [readFileSync(activity, 'utf8'), readFileSync(app, 'utf8')];
    normalizeAndroidEntrypoints(dir, namespace);
    normalizeAndroidEntrypoints(dir, namespace);
    expect([readFileSync(activity, 'utf8'), readFileSync(app, 'utf8')]).toEqual(before);
  });
  it('refuses to discard other native changes, before modifying either entry point', () => {
    const dir = root();
    const activity = write(dir, namespace, 'MainActivity', plain);
    write(dir, namespace, 'MainApplication', application);
    const other = write(
      dir,
      'com.miaamotherpreview',
      'MainActivity',
      splash.replace('fun onCreate()', 'fun unexpectedChange()'),
    );
    const before = readFileSync(activity, 'utf8');
    expect(() => normalizeAndroidEntrypoints(dir, namespace)).toThrow('Conflicting');
    expect(readFileSync(activity, 'utf8')).toBe(before);
    expect(existsSync(other)).toBe(true);
  });
  it('rejects a generated activity that lost its configured splash hook', () => {
    const dir = root();
    write(dir, namespace, 'MainActivity', plain);
    write(dir, namespace, 'MainApplication', application);
    expect(() => normalizeAndroidEntrypoints(dir, namespace)).toThrow(
      'missing required configuration',
    );
    expect(() => assertAndroidEntrypoints(dir, namespace)).toThrow('lost the splash-screen');
  });
});
