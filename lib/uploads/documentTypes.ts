import { query, queryOne } from '@/lib/db/config';
import { DBDocumentType } from '@/lib/db/types';
import { MAX_FILE_UPLOAD_MB } from '@/lib/uploads/limits';

/** Fallback used only if a document references an id with no matching row (shouldn't happen once the FK is in place). */
const DEFAULT_FILE_SIZE_MB = 2;

const CACHE_TTL_MS = 30_000;
let cache: { data: DBDocumentType[]; expiresAt: number } | null = null;

async function loadAll(): Promise<DBDocumentType[]> {
  return query<DBDocumentType>(
    `SELECT * FROM docq_mint_document_types ORDER BY label ASC`
  );
}

/** All document types (active + inactive), cached briefly to avoid hitting the DB on every upload/validation call. */
export async function getAllDocumentTypes(): Promise<DBDocumentType[]> {
  if (cache && cache.expiresAt > Date.now()) return cache.data;
  const data = await loadAll();
  cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}

/** Call after any create/update/delete so readers don't serve stale data for up to CACHE_TTL_MS. */
export function invalidateDocumentTypesCache(): void {
  cache = null;
}

export async function getActiveDocumentTypes(): Promise<DBDocumentType[]> {
  const all = await getAllDocumentTypes();
  return all.filter((t) => t.is_active);
}

export async function getDocumentTypeById(id: string): Promise<DBDocumentType | undefined> {
  const all = await getAllDocumentTypes();
  return all.find((t) => t.id === id);
}

/** New/updated documents may only be set to an active type. */
export async function isValidDocumentType(id: string): Promise<boolean> {
  const active = await getActiveDocumentTypes();
  return active.some((t) => t.id === id);
}

export async function getFileSizeLimitMB(id: string): Promise<number> {
  const match = await getDocumentTypeById(id);
  const mb = match?.max_size_mb ?? DEFAULT_FILE_SIZE_MB;
  return Math.min(mb, MAX_FILE_UPLOAD_MB);
}

export async function getFileSizeLimitBytes(id: string): Promise<number> {
  return (await getFileSizeLimitMB(id)) * 1024 * 1024;
}

/** How many documents currently use this type — used to decide delete vs. deactivate. */
export async function countDocumentsOfType(id: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM docq_mint_documents WHERE document_type_id = $1`,
    [id]
  );
  return parseInt(row?.count || '0', 10);
}
