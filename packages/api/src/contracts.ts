/** Transport types shared with the four future native apps. No server imports. */
export type AppRole = 'admin' | 'mother' | 'cyclist' | 'client';
export type MobileUser = {
  id: number;
  role: AppRole;
  phoneNumber: string;
  email: string | null;
  locale: 'en' | 'am';
};
export type MobileSession = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresAt: string;
  user: MobileUser;
};
export type ApiSuccess<T> = { data: T; requestId: string };
export type ApiFailure = {
  error: { code: string; message: string; details?: Record<string, string> };
  requestId: string;
};
