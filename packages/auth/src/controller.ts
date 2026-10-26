import {
  createMobileApi,
  MobileApiError,
  type AppRole,
  type MobileUser,
  type RequestOptions,
  type TokenStorage,
} from '@miaa/api';
import {
  invalid,
  isToken,
  normalizePhone,
  validateIdentity,
  validateInvite,
  validateSession,
  validPassword,
} from './validation';
export type AuthPhase = 'starting' | 'checking' | 'signedOut' | 'signedIn' | 'blocked';
export type AuthSnapshot = {
  phase: AuthPhase;
  user: MobileUser | null;
  expiresAt: string | null;
  issue: string | null;
};
export type AccountSecurity = {
  phoneNumber: string;
  email: string | null;
  hasPassword: boolean;
  telegramLinked: boolean;
};
export type AuthOptions = { password: true; telegram: boolean; sessionDays: number };
export type LinkState = 'waiting' | 'expired' | 'signup_ready' | 'linked';
export class AuthFault extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'AuthFault';
  }
}
export function issueCode(error: unknown): string {
  return error instanceof AuthFault || error instanceof MobileApiError
    ? error.code
    : 'network_error';
}
/** Single owner of credentials. Epochs prevent old requests from reopening a closed session. */
export function createAuthController(options: {
  role: AppRole;
  origin: string;
  storage: TokenStorage;
  fetch?: typeof fetch;
  allowDevelopmentHttp?: boolean;
  now?: () => number;
  storageTimeoutMs?: number;
  timeoutMs?: number;
}) {
  const now = options.now ?? Date.now;
  let snapshot: AuthSnapshot = { phase: 'starting', user: null, expiresAt: null, issue: null };
  const listeners = new Set<() => void>();
  let epoch = 0;
  let token: string | null = null;
  let started = false;
  let mustClear = false;
  let active = true;
  let mutation = false;
  let validation: Promise<void> | undefined;
  let writes: Promise<unknown> = Promise.resolve();
  const controllers = new Set<AbortController>();
  const update = (next: AuthSnapshot) => {
    snapshot = next;
    listeners.forEach((f) => f());
  };
  const empty = (phase: AuthPhase, issue: string | null = null): AuthSnapshot => ({
    phase,
    issue,
    user: null,
    expiresAt: null,
  });
  async function deadline<T>(operation: Promise<T>) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new AuthFault('storage_error')),
            options.storageTimeoutMs ?? 5000,
          );
        }),
      ]);
    } catch {
      throw new AuthFault('storage_error');
    } finally {
      clearTimeout(timer);
    }
  }
  // Keep the native operation in the queue even after its UI deadline. A late set must precede clear.
  function store(operation: () => Promise<unknown>): Promise<void> {
    const task = writes.then(operation);
    writes = task.catch(() => undefined);
    return deadline(task).then(() => undefined);
  }
  function cancel() {
    controllers.forEach((c) => c.abort());
    controllers.clear();
  }
  async function discard(issue: string | null = null) {
    const revision = ++epoch;
    mustClear = true;
    token = null;
    cancel();
    update(empty('checking', issue));
    try {
      await store(() => options.storage.clear());
      if (epoch === revision) {
        mustClear = false;
        update(empty('signedOut', issue));
      }
    } catch {
      if (epoch === revision) update(empty('blocked', 'storage_error'));
    }
  }
  const api = createMobileApi({
    ...options,
    storage: {
      get: async () => token,
      set: async () => {
        throw new AuthFault('invalid_operation');
      },
      clear: async () => {
        await discard('session_expired');
      },
      clearIfCurrent: async (expected) => {
        if (token === expected) await discard('session_expired');
      },
    },
  });
  async function send<T>(path: string, input: RequestOptions = {}): Promise<T> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (input.signal?.aborted) abort();
    else input.signal?.addEventListener('abort', abort, { once: true });
    controllers.add(controller);
    try {
      return await api.request<T>(path, { ...input, signal: controller.signal });
    } finally {
      controllers.delete(controller);
      input.signal?.removeEventListener('abort', abort);
    }
  }
  async function authenticated<T>(path: string, input?: RequestOptions): Promise<T> {
    if (snapshot.phase !== 'signedIn' || !active) throw new AuthFault('session_expired');
    const revision = epoch;
    const result = await send<T>(path, input);
    if (revision !== epoch || snapshot.phase !== 'signedIn' || !active)
      throw new AuthFault('request_aborted');
    return result;
  }
  // Revocation uses only a captured credential and cannot affect a newer session.
  async function revoke(value: string) {
    const isolated = createMobileApi({
      ...options,
      timeoutMs: Math.min(options.timeoutMs ?? 90000, 10000),
      storage: {
        get: async () => value,
        set: async () => undefined,
        clear: async () => undefined,
      },
    });
    await isolated.request('auth/session', { method: 'DELETE' });
  }
  async function accept(raw: unknown, revision: number, signal?: AbortSignal) {
    const session = validateSession(raw, options.role);
    if (Date.parse(session.expiresAt) <= now()) throw new AuthFault('session_expired');
    if (epoch !== revision || !active || signal?.aborted) {
      void revoke(session.accessToken).catch(() => undefined);
      void store(async () => {
        if ((await options.storage.get()) === session.accessToken) await options.storage.clear();
      }).catch(() => undefined);
      throw new AuthFault('request_aborted');
    }
    try {
      await store(async () => {
        if (epoch === revision && active) await options.storage.set(session.accessToken);
      });
    } catch (error) {
      // Failed persistence never grants access. Queue deletion after a possibly late native write.
      void revoke(session.accessToken).catch(() => undefined);
      await discard('storage_error');
      throw error;
    }
    if (epoch !== revision || !active || signal?.aborted) {
      void revoke(session.accessToken).catch(() => undefined);
      void store(async () => {
        if ((await options.storage.get()) === session.accessToken) await options.storage.clear();
      }).catch(() => undefined);
      throw new AuthFault('request_aborted');
    }
    token = session.accessToken;
    update({ phase: 'signedIn', user: session.user, expiresAt: session.expiresAt, issue: null });
  }
  async function authenticate(path: string, body: unknown, signal?: AbortSignal) {
    if (mutation || snapshot.phase !== 'signedOut') throw new AuthFault('busy');
    mutation = true;
    const revision = ++epoch;
    try {
      const result = await send<unknown>(path, { public: true, method: 'POST', body, signal });
      if (signal?.aborted) {
        const raw = result as { accessToken?: unknown };
        if (isToken(raw?.accessToken)) void revoke(raw.accessToken).catch(() => undefined);
        throw new AuthFault('request_aborted');
      }
      try {
        await accept(result, revision, signal);
      } catch (error) {
        if (issueCode(error) === 'wrong_role' || issueCode(error) === 'invalid_response') {
          const raw = result as { accessToken?: unknown };
          if (isToken(raw?.accessToken)) void revoke(raw.accessToken).catch(() => undefined);
        }
        throw error;
      }
    } finally {
      mutation = false;
    }
  }
  function validate(): Promise<void> {
    if (validation) return validation;
    if (!token) return Promise.resolve();
    const revision = epoch;
    update(empty('checking'));
    validation = (async () => {
      try {
        const result = validateIdentity(await send('me'), options.role);
        if (epoch !== revision || !active) return;
        if (Date.parse(result.expiresAt) <= now()) {
          await discard('session_expired');
          return;
        }
        if (Date.parse(result.expiresAt) - now() < 86400000) {
          await accept(await send('auth/session/renew', { method: 'POST' }), revision);
        } else update({ phase: 'signedIn', ...result, issue: null });
      } catch (error) {
        if (epoch !== revision) return;
        const code = issueCode(error);
        if (
          code === 'wrong_role' ||
          (error instanceof MobileApiError && [401, 403].includes(error.status))
        ) {
          await discard(code === 'wrong_role' ? code : 'session_expired');
        } else if (active) update(empty('blocked', code));
      }
    })().finally(() => {
      validation = undefined;
    });
    return validation;
  }
  async function start() {
    if (started) return;
    started = true;
    const revision = epoch;
    try {
      const saved = await deadline(Promise.resolve().then(() => options.storage.get()));
      if (epoch !== revision) return;
      if (!saved) {
        update(empty('signedOut'));
        return;
      }
      if (!isToken(saved)) {
        await discard('session_expired');
        return;
      }
      token = saved;
      if (active) await validate();
    } catch {
      if (epoch === revision) update(empty('blocked', 'storage_error'));
    }
  }
  async function logout() {
    const old = token;
    const revision = epoch + 1;
    const remote = old
      ? revoke(old).then(
          () => true,
          () => false,
        )
      : Promise.resolve(true);
    await discard();
    const ok = await remote;
    if (!ok && epoch === revision && snapshot.phase === 'signedOut')
      update(empty('signedOut', 'logout_remote'));
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start,
    async retry() {
      if (mustClear) {
        await discard();
        return;
      }
      if (token) await validate();
      else {
        started = false;
        await start();
      }
    },
    // Hide authenticated content as soon as the app leaves the foreground.
    setActive(value: boolean) {
      if (active === value) return;
      active = value;
      if (!value) {
        ++epoch;
        cancel();
        if (token) update(empty('blocked'));
      } else if (token) {
        // A cancelled validation must settle before a new validation starts.
        void Promise.resolve(validation).then(() => validate());
      } else if (snapshot.phase === 'starting') {
        started = false;
        void start();
      }
    },
    async tick() {
      if (
        snapshot.phase === 'signedIn' &&
        snapshot.expiresAt &&
        Date.parse(snapshot.expiresAt) - now() < 86400000
      )
        await validate();
    },
    async renew() {
      if (mutation || snapshot.phase !== 'signedIn') throw new AuthFault('busy');
      mutation = true;
      const revision = epoch;
      update(empty('checking'));
      try {
        await accept(await send('auth/session/renew', { method: 'POST' }), revision);
      } catch (error) {
        if (revision === epoch) update(empty('blocked', issueCode(error)));
        throw error;
      } finally {
        mutation = false;
      }
    },
    logout,
    login(identifier: string, password: string, signal?: AbortSignal) {
      const value = identifier.trim();
      if (!value || value.length > 255 || !validPassword(password))
        return Promise.reject(new AuthFault('invalid_input'));
      return authenticate(
        'auth/password',
        { identifier: value, password, role: options.role },
        signal,
      );
    },
    verifyCode(phone: string, code: string, signal?: AbortSignal) {
      const phoneNumber = normalizePhone(phone);
      if (!phoneNumber || !/^\d{6}$/.test(code))
        return Promise.reject(new AuthFault('invalid_input'));
      return authenticate('auth/otp/verify', { phoneNumber, code, role: options.role }, signal);
    },
    signup(inviteToken: string, name: string, signal?: AbortSignal) {
      if (options.role !== 'client') return Promise.reject(new AuthFault('wrong_role'));
      if (
        !/^[A-Za-z0-9_-]{20,128}$/.test(inviteToken) ||
        name.trim().length < 2 ||
        name.trim().length > 120
      )
        return Promise.reject(new AuthFault('invalid_input'));
      return authenticate('auth/signup', { inviteToken, name: name.trim() }, signal);
    },
    async authOptions(signal?: AbortSignal): Promise<AuthOptions> {
      const raw = await send<AuthOptions>('auth/options', { public: true, signal });
      if (
        raw?.password !== true ||
        typeof raw.telegram !== 'boolean' ||
        !Number.isFinite(raw.sessionDays)
      )
        throw invalid();
      return raw;
    },
    async requestCode(phone: string, signal?: AbortSignal) {
      const phoneNumber = normalizePhone(phone);
      if (!phoneNumber) throw new AuthFault('invalid_input');
      const result = await send<{ accepted: boolean; retryAfterSeconds: number }>(
        'auth/otp/request',
        { public: true, method: 'POST', body: { phoneNumber }, signal },
      );
      if (
        result?.accepted !== true ||
        !Number.isFinite(result.retryAfterSeconds) ||
        result.retryAfterSeconds < 0
      )
        throw invalid();
      return result;
    },
    async invite(phone: string, signal?: AbortSignal) {
      const phoneNumber = normalizePhone(phone);
      if (!phoneNumber) throw new AuthFault('invalid_input');
      return validateInvite(
        await send('auth/telegram/invite', {
          public: true,
          method: 'POST',
          body: { phoneNumber },
          signal,
        }),
      );
    },
    async linkState(inviteToken: string, signal?: AbortSignal): Promise<LinkState> {
      const result = await send<{ state: LinkState }>('auth/telegram/status', {
        public: true,
        method: 'POST',
        body: { inviteToken },
        signal,
      });
      if (!['waiting', 'expired', 'signup_ready', 'linked'].includes(result?.state))
        throw invalid();
      return result.state;
    },
    async security(signal?: AbortSignal): Promise<AccountSecurity> {
      const raw = await authenticated<AccountSecurity>('me/security', { signal });
      if (
        !raw ||
        typeof raw.hasPassword !== 'boolean' ||
        typeof raw.telegramLinked !== 'boolean' ||
        typeof raw.phoneNumber !== 'string' ||
        !(raw.email === null || typeof raw.email === 'string')
      )
        throw invalid();
      return raw;
    },
    async changePassword(currentPassword: string | undefined, newPassword: string) {
      if (
        !validPassword(newPassword, 8) ||
        (currentPassword !== undefined && !validPassword(currentPassword))
      )
        throw new AuthFault('invalid_input');
      await authenticated('me/password', {
        method: 'PATCH',
        body: { ...(currentPassword === undefined ? {} : { currentPassword }), newPassword },
      });
    },
    async revokeAll() {
      await authenticated('me/sessions', { method: 'DELETE' });
      await discard('sessions_revoked');
    },
    async unlinkTelegram() {
      await authenticated('me/telegram', { method: 'DELETE' });
    },
    request<T>(path: string, input?: RequestOptions): Promise<T> {
      if (snapshot.phase !== 'signedIn') return Promise.reject(new AuthFault('session_expired'));
      return authenticated<T>(path, input);
    },
  };
}
export type AuthController = ReturnType<typeof createAuthController>;
