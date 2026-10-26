import { MobileApiError, type AppRole, type MobileSession, type MobileUser } from '@miaa/api';
export const isToken = (value: unknown): value is string =>
  typeof value === 'string' && /^miaa_m1_[A-Za-z0-9_-]{43}$/.test(value);
export function normalizePhone(raw: string): string | null {
  const value = raw.trim().replace(/[\s\-()]/g, '');
  if (/^\+251[79]\d{8}$/.test(value)) return value;
  if (/^251[79]\d{8}$/.test(value)) return '+' + value;
  if (/^0[79]\d{8}$/.test(value)) return '+251' + value.slice(1);
  if (/^[79]\d{8}$/.test(value)) return '+251' + value;
  return null;
}
export function passwordBytes(value: string): number {
  // Available on native Hermes as well as the browser; no TextEncoder dependency.
  return encodeURIComponent(value).replace(/%[A-F\d]{2}/gi, 'x').length;
}
export function validPassword(value: string, minimum = 1): boolean {
  try {
    return value.length >= minimum && passwordBytes(value) <= 72;
  } catch {
    return false;
  }
}
const record = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object');
export function validateIdentity(
  value: unknown,
  role: AppRole,
): { user: MobileUser; expiresAt: string } {
  if (!record(value) || !record(value.user)) throw invalid();
  const u = value.user;
  if (u.role !== role)
    throw new MobileApiError(403, 'wrong_role', 'Use the app for your account role.');
  if (
    !Number.isSafeInteger(u.id) ||
    Number(u.id) < 1 ||
    typeof u.phoneNumber !== 'string' ||
    !normalizePhone(u.phoneNumber) ||
    !(u.email === null || typeof u.email === 'string') ||
    !['en', 'am'].includes(String(u.locale)) ||
    typeof value.expiresAt !== 'string' ||
    !Number.isFinite(Date.parse(value.expiresAt))
  )
    throw invalid();
  return {
    user: {
      id: Number(u.id),
      role,
      phoneNumber: u.phoneNumber,
      email: u.email as string | null,
      locale: u.locale as 'en' | 'am',
    },
    expiresAt: value.expiresAt,
  };
}
export function validateSession(value: unknown, role: AppRole): MobileSession {
  const identity = validateIdentity(value, role);
  if (!record(value) || !isToken(value.accessToken) || value.tokenType !== 'Bearer')
    throw invalid();
  return { ...identity, accessToken: value.accessToken, tokenType: 'Bearer' };
}
export const invalid = () =>
  new MobileApiError(502, 'invalid_response', 'Unexpected server response.');
export type TelegramInvite = { token: string; deepLink: string; expiresAt: string };
export function validateInvite(raw: unknown): TelegramInvite {
  if (
    !record(raw) ||
    typeof raw.token !== 'string' ||
    !/^[A-Za-z0-9_-]{20,128}$/.test(raw.token) ||
    typeof raw.deepLink !== 'string' ||
    typeof raw.expiresAt !== 'string' ||
    !Number.isFinite(Date.parse(raw.expiresAt))
  )
    throw invalid();
  let url: URL;
  try {
    url = new URL(raw.deepLink);
  } catch {
    throw invalid();
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 't.me' ||
    url.port ||
    url.username ||
    url.password ||
    url.hash ||
    !/^\/[A-Za-z0-9_]{5,32}$/.test(url.pathname) ||
    url.searchParams.get('start') !== raw.token ||
    [...url.searchParams.keys()].length !== 1
  )
    throw invalid();
  return { token: raw.token, deepLink: url.href, expiresAt: raw.expiresAt };
}
