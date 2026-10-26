import type { AppRole } from '@miaa/api';
export type { AppRole };
export const roles: readonly AppRole[] = ['admin', 'mother', 'cyclist', 'client'];
export type BuildVariant = 'development' | 'preview' | 'production';
export type AppConfiguration = {
  role: AppRole;
  variant: BuildVariant;
  apiOrigin: string;
  appVersion: string;
  foundationPreview: true;
};
export function isAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && roles.includes(value as AppRole);
}
/** Fail closed rather than silently opening another app's workspace. */
export function readAppConfiguration(value: unknown, expectedRole: AppRole): AppConfiguration {
  if (!value || typeof value !== 'object') throw new Error('Missing app configuration.');
  const c = value as Record<string, unknown>;
  if (
    !isAppRole(c.role) ||
    c.role !== expectedRole ||
    !['development', 'preview', 'production'].includes(String(c.variant)) ||
    typeof c.apiOrigin !== 'string' ||
    typeof c.appVersion !== 'string' ||
    c.foundationPreview !== true
  )
    throw new Error('Invalid app configuration. Rebuild this app.');
  const origin = new URL(c.apiOrigin);
  const local =
    origin.hostname === 'localhost' ||
    origin.hostname === '[::1]' ||
    /^127\.\d+\.\d+\.\d+$/.test(origin.hostname) ||
    /^10\.\d+\.\d+\.\d+$/.test(origin.hostname) ||
    /^192\.168\.\d+\.\d+$/.test(origin.hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(origin.hostname);
  if (
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash ||
    (origin.protocol !== 'https:' &&
      !(c.variant === 'development' && origin.protocol === 'http:' && local))
  )
    throw new Error('Invalid API origin.');
  return {
    role: c.role,
    variant: c.variant as BuildVariant,
    apiOrigin: origin.origin,
    appVersion: c.appVersion,
    foundationPreview: true,
  };
}
