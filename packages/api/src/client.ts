import type { ApiFailure, ApiSuccess, AppRole, MobileSession, MobileUser } from './contracts';
/** Implement with native secure credential storage. Never AsyncStorage/localStorage. */
export interface TokenStorage {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}
export class MobileApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
    readonly retryAfterSeconds?: number,
    readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'MobileApiError';
  }
}
export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  public?: boolean;
  idempotencyKey?: string;
  signal?: AbortSignal;
};
export type MobileApiOptions = {
  origin: string;
  storage: TokenStorage;
  fetch?: typeof fetch;
  timeoutMs?: number;
};
/** No automatic write retries. A Render cold start gets 90 seconds by default. */
export function createMobileApi(options: MobileApiOptions) {
  const url = new URL(options.origin);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
  )
    throw new Error('Use an HTTPS origin, or HTTP localhost for development.');
  const origin = url.origin;
  const send = options.fetch ?? globalThis.fetch;
  let renewal: Promise<MobileSession> | undefined;
  async function request<T>(path: string, input: RequestOptions = {}): Promise<T> {
    if (!/^[a-z0-9][a-z0-9/_-]*(?:\?[^#]*)?$/i.test(path))
      throw new Error('Use an API-relative path.');
    const token = input.public ? null : await options.storage.get();
    if (!input.public && !token)
      throw new MobileApiError(401, 'unauthorized', 'Sign in to continue.');
    const controller = new AbortController();
    const abort = () => controller.abort(input.signal?.reason);
    if (input.signal?.aborted) abort();
    else input.signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 90000);
    try {
      const res = await send(`${origin}/api/v1/${path}`, {
        method: input.method ?? 'GET',
        credentials: 'omit',
        redirect: 'error',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(input.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : {}),
        },
        body: input.body === undefined ? undefined : JSON.stringify(input.body),
        signal: controller.signal,
      });
      const raw: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 401 && token && (await options.storage.get()) === token)
          await options.storage.clear();
        const envelope = raw as ApiFailure | null;
        const error = envelope?.error;
        throw new MobileApiError(
          res.status,
          error?.code ?? 'http_error',
          error?.message ?? 'The server could not complete this request.',
          envelope?.requestId,
          Number(res.headers.get('retry-after')) || undefined,
          error?.details,
        );
      }
      if (!raw || typeof raw !== 'object' || !('data' in raw))
        throw new MobileApiError(
          502,
          'invalid_response',
          'The server returned an unexpected response.',
        );
      return (raw as ApiSuccess<T>).data;
    } catch (error) {
      if (error instanceof MobileApiError) throw error;
      throw new MobileApiError(
        0,
        controller.signal.aborted ? 'request_aborted' : 'network_error',
        controller.signal.aborted
          ? 'The request was cancelled or timed out. Check the order before retrying a write.'
          : "Could not reach Mi'aa. Check your connection and try again.",
      );
    } finally {
      clearTimeout(timer);
      input.signal?.removeEventListener('abort', abort);
    }
  }
  async function saveSession(session: MobileSession) {
    await options.storage.set(session.accessToken);
    return session;
  }
  return {
    request,
    async login(identifier: string, password: string, role?: AppRole) {
      return saveSession(
        await request<MobileSession>('auth/password', {
          method: 'POST',
          public: true,
          body: { identifier, password, role },
        }),
      );
    },
    async verifyCode(phoneNumber: string, code: string, role?: AppRole) {
      return saveSession(
        await request<MobileSession>('auth/otp/verify', {
          method: 'POST',
          public: true,
          body: { phoneNumber, code, role },
        }),
      );
    },
    async signup(inviteToken: string, name: string) {
      return saveSession(
        await request<MobileSession>('auth/signup', {
          method: 'POST',
          public: true,
          body: { inviteToken, name },
        }),
      );
    },
    me() {
      return request<{ user: MobileUser; expiresAt: string }>('me');
    },
    renew() {
      if (!renewal)
        renewal = request<MobileSession>('auth/session/renew', {
          method: 'POST',
        })
          .then(saveSession)
          .finally(() => {
            renewal = undefined;
          });
      return renewal;
    },
    async logout() {
      await request<{ ok: true }>('auth/session', { method: 'DELETE' });
      await options.storage.clear();
    },
  };
}
