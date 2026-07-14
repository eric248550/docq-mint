/**
 * Shared admin-access rules.
 *
 * Admins are anyone on the @docq-mint.com domain, plus any email explicitly
 * listed in ADMIN_EMAIL_WHITELIST (useful for external/personal accounts
 * that need admin access without an @docq-mint.com address).
 */

export const ADMIN_EMAIL_DOMAIN = 'docq-mint.com';

export const ADMIN_EMAIL_WHITELIST = ['eric248550@gmail.com'];

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (normalized.endsWith(`@${ADMIN_EMAIL_DOMAIN}`)) return true;
  return ADMIN_EMAIL_WHITELIST.some((allowed) => allowed.toLowerCase() === normalized);
}
