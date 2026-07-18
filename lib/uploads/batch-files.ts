import {
  isAllowedUploadExtension,
  shouldSkipUploadFile,
} from '@/lib/uploads/limits';

export type UploadQueueItemStatus = 'pending' | 'uploading' | 'success' | 'error';

export interface UploadQueueItem {
  id: string;
  file: File;
  /** Folder-relative path when available; otherwise the file name. */
  relativePath: string;
  status: UploadQueueItemStatus;
  error?: string;
  /**
   * When false, batch shared student/type/tags apply.
   * When true, use this item's student_id / document_type_id / tag_ids.
   */
  customize: boolean;
  student_id: string;
  document_type_id: string;
  tag_ids: string[];
}

export interface BatchUploadDefaults {
  student_id: string;
  document_type_id: string;
  tag_ids: string[];
}

export function getEffectiveUploadMeta(
  item: UploadQueueItem,
  defaults: BatchUploadDefaults
): BatchUploadDefaults {
  if (!item.customize) return defaults;
  return {
    student_id: item.student_id,
    document_type_id: item.document_type_id,
    tag_ids: item.tag_ids,
  };
}

export interface CollectedFilesResult {
  files: Array<{ file: File; relativePath: string }>;
  skippedJunk: number;
  rejectedType: number;
}

function createQueueId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function displayPathForFile(file: File): string {
  const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  if (relative && relative.trim()) return relative;
  return file.name;
}

async function readAllDirectoryEntries(
  reader: FileSystemDirectoryReader
): Promise<FileSystemEntry[]> {
  const all: FileSystemEntry[] = [];
  // Chrome returns entries in batches of ~100; keep reading until empty.
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    if (batch.length === 0) break;
    all.push(...batch);
  }
  return all;
}

async function walkEntry(
  entry: FileSystemEntry,
  pathPrefix: string,
  out: Array<{ file: File; relativePath: string }>
): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => {
      (entry as FileSystemFileEntry).file(resolve, reject);
    });
    const relativePath = pathPrefix ? `${pathPrefix}${entry.name}` : entry.name;
    out.push({ file, relativePath });
    return;
  }

  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const children = await readAllDirectoryEntries(reader);
    const nextPrefix = `${pathPrefix}${entry.name}/`;
    for (const child of children) {
      await walkEntry(child, nextPrefix, out);
    }
  }
}

/**
 * Collect files from a drag-drop DataTransfer, recursively flattening folders.
 * Falls back to `dataTransfer.files` when directory entries are unavailable.
 */
export async function collectFilesFromDataTransfer(
  dataTransfer: DataTransfer
): Promise<CollectedFilesResult> {
  const items = Array.from(dataTransfer.items || []);
  const entries = items
    .map((item) => (item.webkitGetAsEntry ? item.webkitGetAsEntry() : null))
    .filter((entry): entry is FileSystemEntry => Boolean(entry));

  const collected: Array<{ file: File; relativePath: string }> = [];

  if (entries.length > 0) {
    for (const entry of entries) {
      await walkEntry(entry, '', collected);
    }
  } else {
    for (const file of Array.from(dataTransfer.files)) {
      collected.push({ file, relativePath: displayPathForFile(file) });
    }
  }

  return filterCollectedFiles(collected);
}

/** Collect files from a file/folder `<input>` selection. */
export function collectFilesFromFileList(fileList: FileList | null): CollectedFilesResult {
  if (!fileList || fileList.length === 0) {
    return { files: [], skippedJunk: 0, rejectedType: 0 };
  }

  const collected = Array.from(fileList).map((file) => ({
    file,
    relativePath: displayPathForFile(file),
  }));

  return filterCollectedFiles(collected);
}

function filterCollectedFiles(
  collected: Array<{ file: File; relativePath: string }>
): CollectedFilesResult {
  let skippedJunk = 0;
  let rejectedType = 0;
  const files: Array<{ file: File; relativePath: string }> = [];

  for (const item of collected) {
    if (shouldSkipUploadFile(item.file)) {
      skippedJunk += 1;
      continue;
    }
    if (!isAllowedUploadExtension(item.file.name)) {
      rejectedType += 1;
      continue;
    }
    files.push(item);
  }

  return { files, skippedJunk, rejectedType };
}

export function toQueueItems(
  files: Array<{ file: File; relativePath: string }>,
  defaults?: BatchUploadDefaults
): UploadQueueItem[] {
  return files.map(({ file, relativePath }) => ({
    id: createQueueId(),
    file,
    relativePath,
    status: 'pending' as const,
    customize: false,
    student_id: defaults?.student_id ?? '',
    document_type_id: defaults?.document_type_id ?? '',
    tag_ids: defaults?.tag_ids ?? [],
  }));
}

export function partitionBySize(
  items: UploadQueueItem[],
  getLimitBytes: (item: UploadQueueItem) => number
): { valid: UploadQueueItem[]; oversized: UploadQueueItem[] } {
  const valid: UploadQueueItem[] = [];
  const oversized: UploadQueueItem[] = [];
  for (const item of items) {
    const limitBytes = getLimitBytes(item);
    if (item.file.size > limitBytes) oversized.push(item);
    else valid.push(item);
  }
  return { valid, oversized };
}

/** Run async work over items with a fixed concurrency pool. */
export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  const limit = Math.max(1, Math.min(concurrency, items.length));
  let nextIndex = 0;

  const runNext = async (): Promise<void> => {
    const index = nextIndex++;
    if (index >= items.length) return;
    await worker(items[index]);
    await runNext();
  };

  await Promise.all(Array.from({ length: limit }, () => runNext()));
}

export const BATCH_UPLOAD_CONCURRENCY = 4;
