/**
 * Central env config. All values come from .env (VITE_*).
 * In development, fallbacks are used if env is not set.
 */

const getEnv = (key: string, devFallback: string): string => {
  const raw = (import.meta.env[key as keyof ImportMetaEnv] as string | undefined)?.trim() ?? '';
  if (raw) return raw;
  if (import.meta.env.DEV) return devFallback;
  return '';
};

export const getApiBaseUrl = (): string =>
  getEnv('VITE_API_BASE_URL', 'http://localhost:8550');

export const getApiUrl = (): string =>
  getApiBaseUrl().replace(/\/+$/, '');

export const getAuthTokenKey = (): string =>
  getEnv('VITE_AUTH_TOKEN_KEY', 'nextios_auth_token');

export const getLicenseApp = (): string =>
  getEnv('VITE_LICENSE_APP', 'Next');
