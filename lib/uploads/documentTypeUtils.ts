import { MAX_FILE_UPLOAD_MB } from '@/lib/uploads/limits';

/** Minimal shape needed by client-side helpers below (subset of DBDocumentType). */
export interface DocumentTypeLite {
  id: string;
  label: string;
  category?: string | null;
  max_size_mb: number;
  is_active?: boolean;
}

/** Fallback used only while document types are still loading, or for an unrecognized id. */
export const DEFAULT_DOCUMENT_TYPE_FILE_SIZE_MB = 2;

export function buildDocumentTypeMap(types: DocumentTypeLite[]): Map<string, DocumentTypeLite> {
  return new Map(types.map((t) => [t.id, t]));
}

export function getDocumentTypeLabel(
  types: DocumentTypeLite[] | Map<string, DocumentTypeLite>,
  id: string
): string {
  const map = types instanceof Map ? types : buildDocumentTypeMap(types);
  return map.get(id)?.label ?? 'Unknown Type';
}

export function getFileSizeLimitMB(
  types: DocumentTypeLite[] | Map<string, DocumentTypeLite>,
  id: string
): number {
  const map = types instanceof Map ? types : buildDocumentTypeMap(types);
  const mb = map.get(id)?.max_size_mb ?? DEFAULT_DOCUMENT_TYPE_FILE_SIZE_MB;
  return Math.min(mb, MAX_FILE_UPLOAD_MB);
}

export function getFileSizeLimitBytes(
  types: DocumentTypeLite[] | Map<string, DocumentTypeLite>,
  id: string
): number {
  return getFileSizeLimitMB(types, id) * 1024 * 1024;
}

/** Group active types by category (falling back to "Other") preserving sort order, for <optgroup> rendering. */
export function groupDocumentTypesByCategory<T extends DocumentTypeLite>(
  types: T[]
): Array<{ category: string; types: T[] }> {
  const groups: Array<{ category: string; types: T[] }> = [];
  const indexByCategory = new Map<string, number>();

  for (const type of types) {
    const category = type.category?.trim() || 'Other';
    let idx = indexByCategory.get(category);
    if (idx === undefined) {
      idx = groups.length;
      indexByCategory.set(category, idx);
      groups.push({ category, types: [] });
    }
    groups[idx].types.push(type);
  }

  return groups;
}
