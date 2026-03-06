/**
 * Resolves the base URL for the Express API server.
 *
 * Priority:
 * 1. EXPO_PUBLIC_API_BASE_URL env var (set in .env)
 * 2. When running in a browser on the same machine (localhost), use localhost:5000
 *    because the Express server is always on port 5000 regardless of the Expo
 *    dev-server port (8081).
 * 3. Empty string (should not happen in normal usage).
 */
export function getApiBase(): string {
  const envVal = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envVal && envVal.startsWith('http')) return envVal.replace(/\/$/, '');

  if (typeof window !== 'undefined' && window.location) {
    const o = window.location.origin;
    // Expo web dev server runs on 8081; Express API on 5000 — same machine.
    if (o.startsWith('http://localhost') || o.startsWith('http://127.0.0.1')) {
      return 'http://localhost:5000';
    }
    return o;
  }

  return '';
}

export function getWsBase(): string {
  const base = getApiBase();
  if (base.startsWith('https://')) return base.replace(/^https/, 'wss');
  if (base.startsWith('http://')) return base.replace(/^http/, 'ws');
  return 'ws://localhost:5000';
}
