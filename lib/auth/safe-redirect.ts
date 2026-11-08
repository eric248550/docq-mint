const DEFAULT_REDIRECT = '/identity';
const BASE = 'https://app.invalid';

/** Only same-site relative paths may be used as a post-login redirect. */
export function safeRedirect(value: string | null): string {
  if (!value || !value.startsWith('/') || /[\\\u0000-\u001f]/.test(value)) {
    return DEFAULT_REDIRECT;
  }

  try {
    return new URL(value, BASE).origin === BASE ? value : DEFAULT_REDIRECT;
  } catch {
    return DEFAULT_REDIRECT;
  }
}
