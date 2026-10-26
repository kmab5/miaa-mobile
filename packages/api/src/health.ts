import { MobileApiError } from './client';
export type HealthResult = { status: 'ok'; apiVersion: 1 };
/** Public, credential-free health probe. Does not sign in or mutate application data. */
export async function checkHealth(
  origin: string,
  options: { signal?: AbortSignal; fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<HealthResult> {
  const parsed = new URL(origin);
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  )
    throw new Error('Expected a configured API origin.');
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) abort();
  else options.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, options.timeoutMs ?? 90000);
  try {
    const response = await (options.fetch ?? fetch)(`${parsed.origin}/api/v1/health`, {
      method: 'GET',
      credentials: 'omit',
      redirect: 'error',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok)
      throw new MobileApiError(
        response.status,
        'service_unavailable',
        'The service is unavailable.',
      );
    const result: unknown = await response.json();
    const data = result && typeof result === 'object' && 'data' in result ? result.data : null;
    if (
      !data ||
      typeof data !== 'object' ||
      !('status' in data) ||
      data.status !== 'ok' ||
      !('apiVersion' in data) ||
      data.apiVersion !== 1
    )
      throw new MobileApiError(502, 'invalid_response', 'Unexpected service response.');
    return { status: 'ok', apiVersion: 1 };
  } catch (error) {
    if (controller.signal.aborted)
      throw new MobileApiError(
        0,
        'request_aborted',
        'The connection check was cancelled or timed out.',
      );
    if (error instanceof MobileApiError) throw error;
    throw new MobileApiError(0, 'network_error', 'The service could not be reached.');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}
