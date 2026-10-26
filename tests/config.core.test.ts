import { describe, it, expect } from '@jest/globals';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readAppConfiguration, roles } from '../packages/config/src';
import { am, en, initialLocale } from '../packages/i18n/src/dictionaries';
import { workspaces, findWorkspaceModule } from '../packages/shell/src/catalog';
const require = createRequire(resolve('tests/config.core.test.ts'));
const { resolveEnvironment } = require('../config/environment.cjs');
const { apps } = require('../config/apps.cjs');
describe('app identities and configuration', () => {
  it('defines four independent app IDs and a module set for each role', () => {
    expect(Object.keys(apps).sort()).toEqual([...roles].sort());
    expect(
      new Set(
        Object.values(apps).map((value) => (value as { applicationId: string }).applicationId),
      ).size,
    ).toBe(4);
    for (const role of roles) {
      expect(workspaces[role].modules.length).toBeGreaterThan(0);
      expect(new Set(workspaces[role].modules.map((module) => module.id)).size).toBe(
        workspaces[role].modules.length,
      );
    }
  });
  it.each(roles)('rejects wrong-role config for %s', (role) => {
    expect(() =>
      readAppConfiguration(
        {
          role: roles.find((other) => other !== role),
          variant: 'preview',
          apiOrigin: 'https://miaa.onrender.com',
          appVersion: '0.1.0',
          foundationPreview: true,
        },
        role,
      ),
    ).toThrow();
  });
  it('checks runtime configuration before opening a workspace', () => {
    expect(
      readAppConfiguration(
        {
          role: 'client',
          variant: 'preview',
          apiOrigin: 'https://miaa.onrender.com',
          appVersion: '0.1.0',
          foundationPreview: true,
        },
        'client',
      ).role,
    ).toBe('client');
    expect(() => readAppConfiguration(null, 'client')).toThrow();
    expect(() => readAppConfiguration({ role: 'client' }, 'client')).toThrow();
  });
  it.each([
    'https://user:secret@miaa.example',
    'https://miaa.example/api/v1',
    'https://miaa.example/?token=abc',
    'http://miaa.onrender.com',
    'file:///tmp/test',
    'javascript:alert(1)',
  ])('rejects unsafe origin %s', (origin) => {
    expect(() =>
      resolveEnvironment({ EXPO_PUBLIC_API_ORIGIN: origin, MIAA_BUILD_VARIANT: 'preview' }),
    ).toThrow();
    expect(() =>
      readAppConfiguration(
        {
          role: 'client',
          variant: 'preview',
          apiOrigin: origin,
          appVersion: '0.1.0',
          foundationPreview: true,
        },
        'client',
      ),
    ).toThrow();
  });
  it('allows local emulator HTTP only for an explicit development build', () => {
    const c = { EXPO_PUBLIC_API_ORIGIN: 'http://10.0.2.2:3000', MIAA_BUILD_VARIANT: 'development' };
    expect(resolveEnvironment(c).allowsCleartext).toBe(true);
    expect(() => resolveEnvironment({ ...c, MIAA_BUILD_VARIANT: 'production' })).toThrow();
  });
  it.each(['http://10.example.com', 'http://127.example.com', 'http://192.168.example.com'])(
    'rejects public DNS names resembling a private IP: %s',
    (origin) => {
      expect(() =>
        resolveEnvironment({ EXPO_PUBLIC_API_ORIGIN: origin, MIAA_BUILD_VARIANT: 'development' }),
      ).toThrow();
      expect(() =>
        readAppConfiguration(
          {
            role: 'client',
            variant: 'development',
            apiOrigin: origin,
            appVersion: '0.1.0',
            foundationPreview: true,
          },
          'client',
        ),
      ).toThrow();
    },
  );
  it('rejects typoed build variants instead of producing a production identity', () =>
    expect(() => resolveEnvironment({ MIAA_BUILD_VARIANT: 'prodution' })).toThrow());
  it('does not find another role’s modules or unsafe route input', () => {
    expect(findWorkspaceModule('client', 'people')).toBeUndefined();
    expect(findWorkspaceModule('client', ['today', 'people'])).toBeUndefined();
    expect(findWorkspaceModule('client', '__proto__')).toBeUndefined();
    expect(findWorkspaceModule('client', 'today')?.id).toBe('today');
  });
});
describe('localization coverage', () => {
  it('covers every string and referenced module in both languages', () => {
    expect(Object.keys(am).sort()).toEqual(Object.keys(en).sort());
    for (const value of Object.values(am)) expect(value.trim().length).toBeGreaterThan(0);
    for (const workspace of Object.values(workspaces))
      for (const key of [
        workspace.title,
        workspace.headline,
        workspace.introduction,
        workspace.workspaceTitle,
        ...workspace.modules.flatMap((module) => [module.title, module.description, module.detail]),
      ]) {
        expect(en[key]).toBeTruthy();
        expect(am[key]).toBeTruthy();
      }
  });
  it.each([
    ['am-ET', 'am'],
    ['am_ET', 'am'],
    ['AM-et', 'am'],
    ['en-US', 'en'],
    ['tr-TR', 'en'],
    ['', 'en'],
  ])('selects supported language for %s', (language, expected) =>
    expect(initialLocale(language!)).toBe(expected),
  );
});
