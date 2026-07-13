import type { DocumentType } from '@/lib/db/types';

export const MAX_FILE_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_FILE_UPLOAD_MB = 20;

/** All document types accepted by create-document APIs (must match DocumentType). */
export const VALID_DOCUMENT_TYPES: DocumentType[] = [
  'birth_certificate',
  'national_id',
  'address_proof',
  'passport_photo',
  'transfer_certificate',
  'report_card',
  'transcript',
  'cumulative_record',
  'diploma',
  'certificate',
  'health_fitness_card',
  'others',
];

/** Per-type soft limits (MB), always capped by MAX_FILE_UPLOAD_MB. */
const FILE_SIZE_LIMITS_MB: Record<string, number> = {
  report_card: 3,
  cumulative_record: MAX_FILE_UPLOAD_MB,
  diploma: 3,
};

const DEFAULT_FILE_SIZE_MB = 2;

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

export function getFileSizeLimitMB(docType: string): number {
  const typeLimit = FILE_SIZE_LIMITS_MB[docType] ?? DEFAULT_FILE_SIZE_MB;
  return Math.min(typeLimit, MAX_FILE_UPLOAD_MB);
}

export function getFileSizeLimitBytes(docType: string): number {
  return getFileSizeLimitMB(docType) * 1024 * 1024;
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
