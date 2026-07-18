// Document types + their per-type size limits are admin-managed data now —
// see lib/uploads/documentTypes.ts (server) and lib/uploads/documentTypeUtils.ts
// (isomorphic) instead of a static list here.

export const MAX_FILE_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_FILE_UPLOAD_MB = 20;

export const ALLOWED_UPLOAD_EXTENSIONS = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'] as const;

export const EXTENSION_MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

export const ALLOWED_UPLOAD_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/json',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

const SKIP_BASENAMES = new Set(['.ds_store', 'thumbs.db', 'desktop.ini']);

export function getFileExtension(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() || fileName;
  const parts = base.split('.');
  if (parts.length < 2) return '';
  return parts.pop()!.toLowerCase();
}

export function shouldSkipUploadFile(file: File): boolean {
  const base = (file.name.split(/[/\\]/).pop() || file.name).toLowerCase();
  if (!base || base.startsWith('.')) return true;
  if (SKIP_BASENAMES.has(base)) return true;
  if (file.size === 0) return true;
  return false;
}

export function isAllowedUploadExtension(fileName: string): boolean {
  const ext = getFileExtension(fileName);
  return (ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(ext);
}

export function resolveContentType(file: File): string {
  if (file.type && (ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(file.type)) {
    return file.type;
  }
  const mapped = EXTENSION_MIME_MAP[getFileExtension(file.name)];
  if (mapped) return mapped;
  return file.type || 'application/octet-stream';
}
