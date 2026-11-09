export const ACCESS_GRANT_HEADER = 'x-verification-grant';

const STORAGE_KEY = 'verification_grants';

function readGrants(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveAccessGrant(token: string, grant: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readGrants(), [token]: grant }));
  } catch {
    // Storage can be unavailable; the grant then lasts only until the page closes.
  }
}

export function verificationHeaders(token: string, authToken: string | null): Record<string, string> {
  const headers: Record<string, string> = {};
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const grant = readGrants()[token];
  if (grant) headers[ACCESS_GRANT_HEADER] = grant;
  return headers;
}
