/**
 * Check that a document's storage URL points to a file this user uploaded
 * to our bucket. Download routes turn the URL into an S3 key, so accepting
 * any URL would let a school admin read another school's files.
 */
export function isOwnUploadUrl(url: unknown, bucket: string, userId: string): boolean {
  if (typeof url !== 'string') return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:' || parsed.host !== `${bucket}.s3.amazonaws.com`) return false;
  if (parsed.username || parsed.password || parsed.search || parsed.hash) return false;
  if (parsed.pathname.includes('%')) return false;

  return parsed.pathname.startsWith(`/uploads/${userId}/`);
}
