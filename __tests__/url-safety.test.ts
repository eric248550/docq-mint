import { safeRedirect } from '@/lib/auth/safe-redirect';
import { isOwnUploadUrl } from '@/lib/s3/ownership';

describe('safeRedirect', () => {
  it('keeps same-site paths, including invite links', () => {
    expect(safeRedirect('/invite?token=abc')).toBe('/invite?token=abc');
  });

  it.each([
    null,
    '',
    'javascript:alert(1)',
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/\t/evil.example',
  ])('falls back for %p', (value) => {
    expect(safeRedirect(value)).toBe('/identity');
  });
});

describe('isOwnUploadUrl', () => {
  const own = 'https://docq-mint.s3.amazonaws.com/uploads/user-1/123-file.pdf';

  it('accepts the user\'s own upload', () => {
    expect(isOwnUploadUrl(own, 'docq-mint', 'user-1')).toBe(true);
  });

  it.each([
    ['another user', 'https://docq-mint.s3.amazonaws.com/uploads/user-2/123-file.pdf'],
    ['path traversal', 'https://docq-mint.s3.amazonaws.com/uploads/user-1/../user-2/file.pdf'],
    ['encoded traversal', 'https://docq-mint.s3.amazonaws.com/uploads/user-1/%2e%2e/user-2/file.pdf'],
    ['another bucket', 'https://evil.s3.amazonaws.com/uploads/user-1/file.pdf'],
    ['http', 'http://docq-mint.s3.amazonaws.com/uploads/user-1/file.pdf'],
    ['logos folder', 'https://docq-mint.s3.amazonaws.com/logos/user-1/file.png'],
    ['not a url', 'uploads/user-1/file.pdf'],
  ])('rejects %s', (_name, url) => {
    expect(isOwnUploadUrl(url, 'docq-mint', 'user-1')).toBe(false);
  });
});
