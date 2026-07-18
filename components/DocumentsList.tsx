'use client';

import { useState, useEffect, useRef, useTransition, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSchoolDocuments, useSchoolMembers, useSchoolTags } from '@/hooks/useSchools';
import { useDocumentTypes } from '@/hooks/useDocumentTypes';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/button';
import { FileText, Upload, Loader2, Trash2, Download, UserPlus, CheckCircle2, Circle, Rocket, Search, ArrowUpDown, Tag as TagIcon, X, Plus, Check, FolderOpen, AlertCircle, RotateCcw, Coins } from 'lucide-react';
import { DBDocument, DBDocumentType, DBTag } from '@/lib/db/types';
import { Modal, useModal } from '@/components/ui/alert-modal';
import { resolveContentType } from '@/lib/uploads/limits';
import {
  buildDocumentTypeMap,
  getDocumentTypeLabel as resolveDocumentTypeLabel,
  getFileSizeLimitBytes,
  getFileSizeLimitMB,
  groupDocumentTypesByCategory,
  type DocumentTypeLite,
} from '@/lib/uploads/documentTypeUtils';
import {
  BATCH_UPLOAD_CONCURRENCY,
  collectFilesFromDataTransfer,
  collectFilesFromFileList,
  getEffectiveUploadMeta,
  partitionBySize,
  runWithConcurrency,
  toQueueItems,
  type UploadQueueItem,
} from '@/lib/uploads/batch-files';
import { uploadFileToS3 } from '@/lib/uploads/s3-client-upload';

function DocumentTypeOptions({ types }: { types: DocumentTypeLite[] }) {
  const groups = groupDocumentTypesByCategory(types);
  return (
    <>
      {groups.map((group) => (
        <optgroup key={group.category} label={group.category}>
          {group.types.map((type) => (
            <option key={type.id} value={type.id}>
              {type.label}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

interface DocumentsListProps {
  schoolId: string;
  limit?: number;
}

export function DocumentsList({ schoolId, limit }: DocumentsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filter state – initialised from URL only in full view
  const [page, setPage] = useState(!limit ? (Number(searchParams.get('page')) || 1) : 1);
  const [searchInput, setSearchInput] = useState(!limit ? (searchParams.get('search') || '') : '');
  const [search, setSearch] = useState(!limit ? (searchParams.get('search') || '') : '');
  const [documentTypeId, setDocumentTypeId] = useState(!limit ? (searchParams.get('docTypeId') || '') : '');
  const [unassigned, setUnassigned] = useState(!limit ? (searchParams.get('unassigned') || '') : '');
  const [issued, setIssued] = useState(!limit ? (searchParams.get('issued') || '') : '');
  const [sortOrder, setSortOrder] = useState(!limit ? (searchParams.get('sort') || 'desc') : 'desc');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    !limit && searchParams.get('tags') ? searchParams.get('tags')!.split(',').filter(Boolean) : []
  );

  const [, startTransition] = useTransition();

  const { documents, pagination, isLoading, error, createDocument, updateDocument, deleteDocument, refetch } = useSchoolDocuments(schoolId);
  const { members, refetch: refetchMembers } = useSchoolMembers(schoolId);
  const { tags, refetch: refetchTags, createTag } = useSchoolTags(schoolId);
  const { documentTypes, activeDocumentTypes } = useDocumentTypes();
  const typeMap = useMemo(() => buildDocumentTypeMap(documentTypes), [documentTypes]);
  const { getAuthToken } = useAuthStore();

  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadStudentSearch, setUploadStudentSearch] = useState('');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const uploadStudentRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [formData, setFormData] = useState({
    student_id: '',
    document_type_id: '',
  });
  const [uploadTagIds, setUploadTagIds] = useState<string[]>([]);
  const [isBatchUploading, setIsBatchUploading] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [mintingDocId, setMintingDocId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  // Publishing credits: 1 credit is consumed per document published on-chain.
  const refetchCredits = useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;
      const res = await fetch(`/api/schools/${schoolId}/credits`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCreditBalance(typeof data.balance === 'number' ? data.balance : null);
      }
    } catch (err) {
      console.error('Failed to fetch credit balance:', err);
    }
  }, [schoolId, getAuthToken]);

  useEffect(() => {
    refetchCredits();
  }, [refetchCredits]);

  // Default the upload form's document type to the first active type once loaded,
  // and re-point it if the currently selected type gets deactivated mid-session.
  useEffect(() => {
    if (activeDocumentTypes.length === 0) return;
    setFormData((f) => {
      if (f.document_type_id && activeDocumentTypes.some((t) => t.id === f.document_type_id)) return f;
      return { ...f, document_type_id: activeDocumentTypes[0].id };
    });
  }, [activeDocumentTypes]);

  const { modal, showAlert, showConfirm, closeModal } = useModal();

  // Only show students who have actually signed up (user_id is not null)
  const students = members.filter(m => m.role === 'student' && m.user_id !== null);

  const updateQueueItem = (id: string, patch: Partial<UploadQueueItem>) => {
    setUploadQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const batchDefaults = {
    student_id: formData.student_id,
    document_type_id: formData.document_type_id,
    tag_ids: uploadTagIds,
  };

  // Changing batch defaults re-applies them to every file in the queue
  useEffect(() => {
    setUploadQueue((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((item) => ({
        ...item,
        customize: false,
        student_id: formData.student_id,
        document_type_id: formData.document_type_id,
        tag_ids: [...uploadTagIds],
      }));
    });
  }, [formData.student_id, formData.document_type_id, uploadTagIds]);

  const beginCustomize = (item: UploadQueueItem, patch: Partial<UploadQueueItem>) => {
    const effective = getEffectiveUploadMeta(item, batchDefaults);
    updateQueueItem(item.id, {
      customize: true,
      student_id: effective.student_id,
      document_type_id: effective.document_type_id,
      tag_ids: [...effective.tag_ids],
      ...patch,
    });
  };

  const appendToQueue = async (incoming: UploadQueueItem[]) => {
    if (incoming.length === 0) return;

    const { valid, oversized } = partitionBySize(
      incoming,
      (item) => getFileSizeLimitBytes(typeMap, getEffectiveUploadMeta(item, batchDefaults).document_type_id)
    );
    if (oversized.length > 0) {
      const names = oversized.map((item) => {
        const docType = getEffectiveUploadMeta(item, batchDefaults).document_type_id;
        return `${item.relativePath} (${getFileSizeLimitMB(typeMap, docType)} MB max)`;
      }).join(', ');
      await showAlert(
        `${oversized.length} file(s) exceed the size limit for their document type and were removed:\n${names}`
      );
    }
    if (valid.length > 0) {
      setUploadQueue((prev) => [...prev, ...valid]);
    }
  };

  const reportCollectionFeedback = async (
    rejectedType: number,
    skippedJunk: number
  ) => {
    const messages: string[] = [];
    if (rejectedType > 0) {
      messages.push(
        `${rejectedType} file(s) were rejected. Only PDF, DOC, DOCX, JPG, JPEG, and PNG files are accepted.`
      );
    }
    if (skippedJunk > 0) {
      messages.push(`${skippedJunk} system/hidden file(s) were skipped.`);
    }
    if (messages.length > 0) {
      await showAlert(messages.join('\n\n'));
    }
  };

  const isUploading = isBatchUploading;
  const pendingOrFailedCount = uploadQueue.filter(
    (item) => item.status === 'pending' || item.status === 'error'
  ).length;
  const successCount = uploadQueue.filter((item) => item.status === 'success').length;
  const failedCount = uploadQueue.filter((item) => item.status === 'error').length;
  const uploadingCount = uploadQueue.filter((item) => item.status === 'uploading').length;

  // Get unminted documents — published documents cannot be published again or deleted,
  // so only unpublished documents are selectable for bulk actions.
  const unmintedDocuments = documents.filter(doc => !doc.is_published);
  const unmintedIds = unmintedDocuments.map(doc => doc.id);
  const selectedUnmintedIds = unmintedIds.filter(id => selectedIds.has(id));
  const selectedCount = selectedUnmintedIds.length;
  const allUnmintedSelected = unmintedIds.length > 0 && selectedCount === unmintedIds.length;

  // Drop any selected ids that are no longer present or have since been published
  useEffect(() => {
    setSelectedIds(prev => {
      const validIds = new Set(documents.filter(doc => !doc.is_published).map(doc => doc.id));
      const next = new Set([...prev].filter(id => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [documents]);

  const toggleSelectDocument = (documentId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(documentId)) {
        next.delete(documentId);
      } else {
        next.add(documentId);
      }
      return next;
    });
  };

  const toggleSelectAllUnminted = () => {
    setSelectedIds(prev => {
      if (allUnmintedSelected) {
        const next = new Set(prev);
        unmintedIds.forEach(id => next.delete(id));
        return next;
      }
      return new Set([...prev, ...unmintedIds]);
    });
  };

  // Fetch students for the assign dropdown; search is driven by DocumentRow via handleSearchStudents
  useEffect(() => {
    refetchMembers({ role: 'student', limit: 20 });
  }, [schoolId]);

  // Fetch the school's tag vocabulary (filter dropdown + row tag picker) — full view only
  useEffect(() => {
    if (!limit) refetchTags();
  }, [schoolId, limit]);

  const handleSearchStudents = (query: string) => {
    refetchMembers({ role: 'student', search: query, limit: 20 });
  };

  // Reset upload form student search/dropdown and reload default list whenever the form opens
  useEffect(() => {
    if (showUploadForm) {
      setUploadStudentSearch('');
      setShowStudentDropdown(false);
      setUploadTagIds([]);
      handleSearchStudents('');
    }
  }, [showUploadForm]);

  // Enable folder selection on the hidden folder input (non-standard attribute)
  useEffect(() => {
    const input = folderInputRef.current;
    if (!input) return;
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
  }, [showUploadForm]);

  // Click-outside closes the student dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (uploadStudentRef.current && !uploadStudentRef.current.contains(e.target as Node)) {
        setShowStudentDropdown(false);
      }
    };
    if (showStudentDropdown) {
      window.document.addEventListener('mousedown', handleClickOutside);
      return () => window.document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showStudentDropdown]);

  // Debounce upload form student search → API call
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearchStudents(uploadStudentSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [uploadStudentSearch]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch documents (preview mode: once on mount; full mode: on every filter change)
  useEffect(() => {
    if (limit) {
      refetch({ limit });
    }
  }, [schoolId, limit]);

  useEffect(() => {
    if (limit) return;
    refetch({ page, search, documentTypeId, unassigned, issued, tags: selectedTagIds.join(','), sortOrder });
  }, [page, search, documentTypeId, unassigned, issued, selectedTagIds, sortOrder, schoolId]);

  // Sync filters to URL in full view (wrapped in startTransition so the URL
  // update is non-blocking and never interrupts an active search input)
  useEffect(() => {
    if (limit) return;
    const params = new URLSearchParams();
    if (page > 1) params.set('page', String(page));
    if (search) params.set('search', search);
    if (documentTypeId) params.set('docTypeId', documentTypeId);
    if (unassigned) params.set('unassigned', unassigned);
    if (issued) params.set('issued', issued);
    if (selectedTagIds.length) params.set('tags', selectedTagIds.join(','));
    if (sortOrder !== 'desc') params.set('sort', sortOrder);
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `?${qs}` : '?', { scroll: false });
    });
  }, [page, search, documentTypeId, unassigned, issued, selectedTagIds, sortOrder, limit]);

  const handleFilterChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.target.value);
    setPage(1);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const { files, skippedJunk, rejectedType } = collectFilesFromFileList(e.target.files);
    e.target.value = '';
    await reportCollectionFeedback(rejectedType, skippedJunk);
    await appendToQueue(toQueueItems(files, batchDefaults));
  };

  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const { files, skippedJunk, rejectedType } = collectFilesFromFileList(e.target.files);
    e.target.value = '';
    await reportCollectionFeedback(rejectedType, skippedJunk);
    await appendToQueue(toQueueItems(files, batchDefaults));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const { files, skippedJunk, rejectedType } = await collectFilesFromDataTransfer(e.dataTransfer);
    await reportCollectionFeedback(rejectedType, skippedJunk);
    await appendToQueue(toQueueItems(files, batchDefaults));
  };

  const removeQueueItem = (id: string) => {
    setUploadQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const resetUploadForm = () => {
    setShowUploadForm(false);
    setUploadQueue([]);
    setUploadStudentSearch('');
    setUploadTagIds([]);
    setFormData({ student_id: '', document_type_id: activeDocumentTypes[0]?.id ?? '' });
    setIsBatchUploading(false);
  };

  const calculateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const uploadQueueItems = async (items: UploadQueueItem[]) => {
    if (items.length === 0) return { success: 0, failed: 0, errors: [] as { name: string; error: string }[] };

    const defaults = {
      student_id: formData.student_id,
      document_type_id: formData.document_type_id,
      tag_ids: uploadTagIds,
    };

    const errors: { name: string; error: string }[] = [];

    // Re-validate sizes against each file's effective document type
    const { valid, oversized } = partitionBySize(
      items,
      (item) => getFileSizeLimitBytes(typeMap, getEffectiveUploadMeta(item, defaults).document_type_id)
    );
    if (oversized.length > 0) {
      for (const item of oversized) {
        const docType = getEffectiveUploadMeta(item, defaults).document_type_id;
        const limitMB = getFileSizeLimitMB(typeMap, docType);
        const message = `Exceeds ${limitMB} MB limit for ${resolveDocumentTypeLabel(typeMap, docType)}`;
        updateQueueItem(item.id, { status: 'error', error: message });
        errors.push({ name: item.relativePath, error: message });
      }
    }

    const toUpload = valid.map((item) => ({
      ...item,
      status: 'pending' as const,
      error: undefined,
    }));

    for (const item of toUpload) {
      updateQueueItem(item.id, { status: 'pending', error: undefined });
    }

    setIsBatchUploading(true);
    let success = 0;
    let failed = oversized.length;

    try {
      await runWithConcurrency(toUpload, BATCH_UPLOAD_CONCURRENCY, async (item) => {
        updateQueueItem(item.id, { status: 'uploading', error: undefined });
        try {
          const meta = getEffectiveUploadMeta(item, defaults);
          const uploadResult = await uploadFileToS3(item.file);
          const fileHash = await calculateFileHash(item.file);
          const studentId = meta.student_id && meta.student_id.trim() !== ''
            ? meta.student_id
            : undefined;

          await createDocument({
            student_id: studentId,
            document_type_id: meta.document_type_id,
            file_storage_provider: 's3',
            file_storage_url: uploadResult.url,
            file_hash: fileHash,
            file_mime_type: resolveContentType(item.file),
            file_size_bytes: item.file.size,
            original_filename: item.file.name,
            tag_ids: meta.tag_ids.length > 0 ? meta.tag_ids : undefined,
          });

          updateQueueItem(item.id, { status: 'success', error: undefined });
          success += 1;
        } catch (error) {
          console.error(`Failed to upload ${item.relativePath}:`, error);
          const message = error instanceof Error ? error.message : 'Upload failed';
          updateQueueItem(item.id, { status: 'error', error: message });
          failed += 1;
          errors.push({ name: item.relativePath, error: message });
        }
      });
    } finally {
      setIsBatchUploading(false);
    }

    return { success, failed, errors };
  };

  // Groups per-file errors by message so the summary alert stays readable
  // even when many files fail for the same reason.
  const summarizeFailures = (errors: { name: string; error: string }[]): string => {
    if (errors.length === 0) return '';

    if (errors.length <= 3) {
      return errors.map(({ name, error }) => `• ${name}: ${error}`).join('\n');
    }

    const counts = new Map<string, number>();
    for (const { error } of errors) {
      const message = error?.trim() || 'Upload failed';
      counts.set(message, (counts.get(message) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([message, count]) => `• ${message}${count > 1 ? ` (${count} files)` : ''}`)
      .join('\n');
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    const targets = uploadQueue.filter(
      (item) => item.status === 'pending' || item.status === 'error'
    );

    if (targets.length === 0) {
      await showAlert('Please select at least one file');
      return;
    }

    const { success, failed, errors } = await uploadQueueItems(targets);

    if (success > 0) {
      if (limit) {
        refetch({ limit });
      } else {
        refetch({ page, search, documentTypeId, unassigned, issued, tags: selectedTagIds.join(','), sortOrder });
      }
    }

    if (failed === 0) {
      await showAlert(`All ${success} document(s) uploaded successfully!`);
      resetUploadForm();
      return;
    }

    if (success > 0) {
      await showAlert(
        `${success} document(s) uploaded successfully.\n\n${failed} failed:\n${summarizeFailures(errors)}\n\nYou can retry the failed files below.`
      );
      setUploadQueue((prev) => prev.filter((item) => item.status !== 'success'));
      return;
    }

    await showAlert(
      `Failed to upload ${failed} document(s):\n${summarizeFailures(errors)}\n\nYou can retry the failed files below.`
    );
  };

  const handleRetryFailed = async () => {
    const failedItems = uploadQueue.filter((item) => item.status === 'error');
    if (failedItems.length === 0) return;

    const { success, failed, errors } = await uploadQueueItems(failedItems);

    if (success > 0) {
      if (limit) {
        refetch({ limit });
      } else {
        refetch({ page, search, documentTypeId, unassigned, issued, tags: selectedTagIds.join(','), sortOrder });
      }
    }

    if (failed === 0) {
      await showAlert(`All ${success} remaining document(s) uploaded successfully!`);
      resetUploadForm();
      return;
    }

    if (success > 0) {
      await showAlert(
        `${success} document(s) uploaded on retry.\n\n${failed} still failed:\n${summarizeFailures(errors)}`
      );
      setUploadQueue((prev) => prev.filter((item) => item.status !== 'success'));
      return;
    }

    await showAlert(`Retry failed for all ${failed} document(s):\n${summarizeFailures(errors)}`);
  };

  const handleDelete = async (documentId: string) => {
    const confirmed = await showConfirm('Are you sure you want to delete this document?');
    if (!confirmed) return;

    try {
      await deleteDocument(documentId);
    } catch (error) {
      console.error('Failed to delete document:', error);
      await showAlert('Failed to delete document');
    }
  };

  const handleDeleteSelected = async () => {
    const documentIds = [...selectedIds];
    if (documentIds.length === 0) return;

    const confirmed = await showConfirm(
      `Are you sure you want to delete ${documentIds.length} document${documentIds.length !== 1 ? 's' : ''}? This action cannot be undone.`
    );
    if (!confirmed) return;

    setIsDeletingSelected(true);
    try {
      const results = await Promise.allSettled(documentIds.map((id) => deleteDocument(id)));
      const failed = results.filter((r) => r.status === 'rejected').length;
      const succeeded = results.length - failed;

      setSelectedIds((prev) => {
        const next = new Set(prev);
        documentIds.forEach((id, i) => {
          if (results[i].status === 'fulfilled') next.delete(id);
        });
        return next;
      });

      if (failed > 0) {
        await showAlert(`Deleted ${succeeded} document(s). ${failed} failed to delete.`);
      }
    } catch (error) {
      console.error('Failed to delete selected documents:', error);
      await showAlert('Failed to delete selected documents');
    } finally {
      setIsDeletingSelected(false);
    }
  };

  const handleMintDocuments = async (documentIds: string[]) => {
    if (documentIds.length === 0) {
      await showAlert('No documents to publish');
      return;
    }

    if (creditBalance !== null && documentIds.length > creditBalance) {
      await showAlert(
        `Not enough credits. Publishing ${documentIds.length} document(s) requires ${documentIds.length} credit(s), ` +
        `but this organization has ${creditBalance}. Please contact your administrator to add more.`
      );
      return;
    }

    const confirmMessage = documentIds.length === 1
      ? 'Are you sure you want to publish this document to the blockchain? This action cannot be undone.'
      : `Are you sure you want to publish ${documentIds.length} documents to the blockchain? This action cannot be undone.`;

    const confirmed = await showConfirm(confirmMessage);
    if (!confirmed) return;

    setIsMinting(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/schools/${schoolId}/documents/mint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ documentIds }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to publish documents');
      }

      const result = await response.json();

      await showAlert(
        `Publishing job queued for ${result.documentCount} document(s)!\n\n` +
        `The minting process is running in the background and will be confirmed on the blockchain.\n\n` +
        `Please refresh the page in a few minutes to see the updated status.`
      );

      if (limit) {
        await refetch({ limit });
      } else {
        await refetch({ page, search, documentTypeId, unassigned, issued, tags: selectedTagIds.join(','), sortOrder });
      }
    } catch (error) {
      console.error('Failed to publish documents:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await showAlert(`Failed to publish documents: ${errorMessage}`);
    } finally {
      setIsMinting(false);
      setMintingDocId(null);
      // Balance changed (debited on success, or resync after an error).
      await refetchCredits();
    }
  };

  const handleMintAll = async () => {
    await handleMintDocuments(unmintedIds);
  };

  const handleMintSelected = async () => {
    await handleMintDocuments(selectedUnmintedIds);
    setSelectedIds(new Set());
  };

  const handleMintSingle = async (documentId: string) => {
    setMintingDocId(documentId);
    await handleMintDocuments([documentId]);
  };

  // Replace the full set of tags on a document
  const handleSetTags = async (documentId: string, tagIds: string[]) => {
    await updateDocument(documentId, { tag_ids: tagIds });
  };

  // Create a new tag and return it (used by the row tag picker's inline "create")
  const handleCreateTag = async (name: string): Promise<DBTag | undefined> => {
    return await createTag({ name });
  };

  const toggleTagFilter = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
    setPage(1);
  };

  const toggleUploadTag = (tagId: string) => {
    setUploadTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 text-red-500">
        <p>Error loading documents: {error}</p>
      </div>
    );
  }

  const total = pagination?.total ?? documents.length;

  return (
    <div className="space-y-4">
      <Modal
        isOpen={modal.isOpen}
        message={modal.message}
        type={modal.type}
        onConfirm={() => closeModal(true)}
        onCancel={() => closeModal(false)}
      />

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Documents ({limit ? total : (pagination ? `${total} total` : documents.length)})
        </h3>
        {!limit && (
          <div className="flex items-center gap-2">
            {creditBalance !== null && (
              <span
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground px-2 py-1 rounded-md bg-muted"
                title="Each published document uses 1 credit"
              >
                <Coins className="h-3.5 w-3.5" />
                {creditBalance} credit{creditBalance === 1 ? '' : 's'}
              </span>
            )}
            {selectedUnmintedIds.length > 0 && (
              <Button
                onClick={handleMintSelected}
                size="sm"
                variant="default"
                disabled={isMinting || (creditBalance !== null && selectedUnmintedIds.length > creditBalance)}
                title={
                  creditBalance !== null && selectedUnmintedIds.length > creditBalance
                    ? `Not enough credits (need ${selectedUnmintedIds.length}, have ${creditBalance})`
                    : undefined
                }
              >
                {isMinting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4 mr-2" />
                    Publish Selected ({selectedUnmintedIds.length})
                  </>
                )}
              </Button>
            )}
            {unmintedDocuments.length > 0 && (
              <Button
                onClick={handleMintAll}
                size="sm"
                variant={selectedUnmintedIds.length > 0 ? 'outline' : 'default'}
                disabled={isMinting || (creditBalance !== null && unmintedDocuments.length > creditBalance)}
                title={
                  creditBalance !== null && unmintedDocuments.length > creditBalance
                    ? `Not enough credits (need ${unmintedDocuments.length}, have ${creditBalance})`
                    : undefined
                }
              >
                {isMinting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4 mr-2" />
                    Publish All ({unmintedDocuments.length})
                  </>
                )}
              </Button>
            )}
            {selectedCount > 0 && (
              <Button
                onClick={handleDeleteSelected}
                size="sm"
                variant="destructive"
                disabled={isDeletingSelected}
              >
                {isDeletingSelected ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected ({selectedCount})
                  </>
                )}
              </Button>
            )}
            <Button onClick={() => setShowUploadForm(!showUploadForm)} size="sm" variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </div>
        )}
      </div>

      {!limit && unmintedDocuments.length > 0 && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground select-none cursor-pointer">
          <input
            type="checkbox"
            checked={allUnmintedSelected}
            onChange={toggleSelectAllUnminted}
            className="h-4 w-4 rounded border-gray-300 accent-primary cursor-pointer"
          />
          {selectedCount > 0 ? `${selectedCount} selected` : `Select all unpublished (${unmintedDocuments.length})`}
        </label>
      )}

      {/* Filter controls – full view only */}
      {!limit && (
        <div className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by filename..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border rounded-md bg-background"
              />
            </div>
            <select
              value={documentTypeId}
              onChange={handleFilterChange(setDocumentTypeId)}
              className="px-3 py-2 text-sm border rounded-md bg-background"
            >
              <option value="">All Types</option>
              <DocumentTypeOptions types={documentTypes} />
            </select>
            <select
              value={issued}
              onChange={handleFilterChange(setIssued)}
              className="px-3 py-2 text-sm border rounded-md bg-background"
            >
              <option value="">All Status</option>
              <option value="true">Published</option>
              <option value="false">Unpublished</option>
            </select>
            <select
              value={unassigned}
              onChange={handleFilterChange(setUnassigned)}
              className="px-3 py-2 text-sm border rounded-md bg-background"
            >
              <option value="">All Assignment</option>
              <option value="false">Assigned</option>
              <option value="true">Unassigned</option>
            </select>
            <TagFilter
              tags={tags}
              selectedTagIds={selectedTagIds}
              onToggle={toggleTagFilter}
              onClear={() => { setSelectedTagIds([]); setPage(1); }}
              onCreateTag={handleCreateTag}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSortOrder(s => s === 'desc' ? 'asc' : 'desc');
                setPage(1);
              }}
              className="flex items-center gap-1"
            >
              <ArrowUpDown className="h-3 w-3" />
              {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
            </Button>
          </div>
          {selectedTagIds.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground">Filtering by:</span>
              {selectedTagIds.map(id => {
                const tag = tags.find(t => t.id === id);
                if (!tag) return null;
                return <TagChip key={id} tag={tag} onRemove={() => toggleTagFilter(id)} />;
              })}
            </div>
          )}
        </div>
      )}

      {showUploadForm && (
        <form onSubmit={handleUpload} className="border rounded-lg p-4 space-y-4">
          <div>
            <label className="text-sm font-medium">Student (default for batch)</label>
            <div className="relative mt-1" ref={uploadStudentRef}>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by email... (optional)"
                  value={uploadStudentSearch}
                  onChange={e => {
                    setUploadStudentSearch(e.target.value);
                    setFormData(f => ({ ...f, student_id: '' }));
                    setShowStudentDropdown(true);
                  }}
                  onFocus={() => setShowStudentDropdown(true)}
                  className="w-full pl-8 pr-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              {showStudentDropdown && (
                <div className="absolute z-10 w-full bg-white border rounded-md shadow-lg mt-1 max-h-52 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(f => ({ ...f, student_id: '' }));
                      setUploadStudentSearch('');
                      setShowStudentDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-gray-100"
                  >
                    No student (optional)
                  </button>
                  {students.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      {uploadStudentSearch ? 'No students found' : 'No active students yet'}
                    </div>
                  ) : (
                    students.map((student) => (
                      <button
                        type="button"
                        key={student.id}
                        onClick={() => {
                          setFormData(f => ({ ...f, student_id: student.user_id! }));
                          setUploadStudentSearch(student.email || '');
                          setShowStudentDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
                          formData.student_id === student.user_id ? 'bg-primary/10' : ''
                        }`}
                      >
                        {student.email || 'Unknown'}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Document Type (default for batch)</label>
            <select
              value={formData.document_type_id}
              onChange={(e) => setFormData({ ...formData, document_type_id: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
            >
              <DocumentTypeOptions types={activeDocumentTypes} />
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Tags (default for batch)</label>
            <div className="mt-1">
              <TagFilter
                tags={tags}
                selectedTagIds={uploadTagIds}
                onToggle={toggleUploadTag}
                onClear={() => setUploadTagIds([])}
                onCreateTag={handleCreateTag}
                align="left"
              />
              {uploadTagIds.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  {uploadTagIds.map(id => {
                    const tag = tags.find(t => t.id === id);
                    if (!tag) return null;
                    return <TagChip key={id} tag={tag} onRemove={() => toggleUploadTag(id)} />;
                  })}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Default tags for all files. Changing these updates every file in the queue.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Files</label>
            <p className="text-xs text-muted-foreground mt-0.5 mb-1">
              Batch defaults apply to all files. Row edits override until you change the batch defaults again. Nested folders are flattened.
            </p>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`mt-1 border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-300 hover:border-primary/50'
              }`}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                Drag and drop files or folders here
              </p>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                multiple
                className="hidden"
                id="file-upload"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                disabled={isUploading}
              />
              <input
                ref={folderInputRef}
                type="file"
                onChange={handleFolderChange}
                className="hidden"
                id="folder-upload"
                multiple
                disabled={isUploading}
              />
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Browse Files
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploading}
                  onClick={() => folderInputRef.current?.click()}
                >
                  <FolderOpen className="h-4 w-4 mr-1.5" />
                  Browse Folder
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Supported: PDF, DOC, DOCX, JPG, JPEG, PNG
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Max file size: <span className="font-medium">{getFileSizeLimitMB(typeMap, formData.document_type_id)} MB</span> for {resolveDocumentTypeLabel(typeMap, formData.document_type_id)}
              </p>
            </div>

            {uploadQueue.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    Upload queue ({uploadQueue.length})
                    {isUploading && (
                      <span className="text-muted-foreground font-normal">
                        {' '}· {successCount + failedCount}/{uploadQueue.length} finished
                      </span>
                    )}
                  </p>
                  {failedCount > 0 && !isUploading && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRetryFailed}
                      className="flex items-center gap-1.5"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Retry failed ({failedCount})
                    </Button>
                  )}
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {uploadQueue.map((item) => {
                    const effective = getEffectiveUploadMeta(item, batchDefaults);
                    const canEdit = (item.status === 'pending' || item.status === 'error') && !isUploading;

                    return (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center gap-2 p-2 bg-muted rounded-md"
                      >
                        <div className="flex items-center gap-2 min-w-[10rem] flex-1 basis-40">
                          {item.status === 'success' ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                          ) : item.status === 'error' ? (
                            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                          ) : item.status === 'uploading' ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                          ) : (
                            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate" title={item.relativePath}>
                              {item.relativePath}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {(item.file.size / 1024).toFixed(0)} KB
                              {item.customize ? ' · customized' : ''}
                              {item.error ? ` · ${item.error}` : ''}
                            </p>
                          </div>
                        </div>

                        <select
                          value={effective.student_id}
                          disabled={!canEdit}
                          onChange={(e) => beginCustomize(item, { student_id: e.target.value })}
                          className="min-w-[8rem] max-w-[12rem] flex-1 px-2 py-1.5 text-xs border rounded-md bg-background disabled:opacity-60"
                          title="Student"
                        >
                          <option value="">No student</option>
                          {students.map((student) => (
                            <option key={student.id} value={student.user_id!}>
                              {student.email || 'Unknown'}
                            </option>
                          ))}
                        </select>

                        <select
                          value={effective.document_type_id}
                          disabled={!canEdit}
                          onChange={(e) => beginCustomize(item, { document_type_id: e.target.value })}
                          className="min-w-[9rem] max-w-[14rem] flex-1 px-2 py-1.5 text-xs border rounded-md bg-background disabled:opacity-60"
                          title="Document type"
                        >
                          <DocumentTypeOptions types={activeDocumentTypes} />
                        </select>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <div className={!canEdit ? 'pointer-events-none opacity-60' : ''}>
                            <TagFilter
                              tags={tags}
                              selectedTagIds={effective.tag_ids}
                              onToggle={(tagId) => {
                                if (!canEdit) return;
                                const next = effective.tag_ids.includes(tagId)
                                  ? effective.tag_ids.filter((id) => id !== tagId)
                                  : [...effective.tag_ids, tagId];
                                beginCustomize(item, { tag_ids: next });
                              }}
                              onClear={() => {
                                if (!canEdit) return;
                                beginCustomize(item, { tag_ids: [] });
                              }}
                              onCreateTag={canEdit ? handleCreateTag : undefined}
                              align="left"
                            />
                          </div>
                          {canEdit && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeQueueItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>
                  Uploading batch… {uploadingCount} in progress
                </span>
                <span>
                  {successCount} ok · {failedCount} failed · {uploadQueue.length} total
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{
                    width: `${uploadQueue.length === 0 ? 0 : ((successCount + failedCount) / uploadQueue.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button type="submit" disabled={isUploading || pendingOrFailedCount === 0}>
              {isUploading
                ? `Uploading... (${successCount + failedCount}/${uploadQueue.length})`
                : `Upload ${pendingOrFailedCount} Document${pendingOrFailedCount !== 1 ? 's' : ''}`}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetUploadForm}
              disabled={isUploading}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {documents.length === 0 ? (
        <div className="text-center p-8 border rounded-lg">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No documents found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(limit ? documents.slice(0, limit) : documents).map((doc) => (
            <DocumentRow
              key={doc.id}
              document={doc}
              typeMap={typeMap}
              students={students}
              allTags={tags}
              onDelete={!limit ? handleDelete : undefined}
              onAssign={!limit ? updateDocument : undefined}
              onMint={!limit ? handleMintSingle : undefined}
              onSearchStudents={!limit ? handleSearchStudents : undefined}
              onSetTags={!limit ? handleSetTags : undefined}
              onCreateTag={!limit ? handleCreateTag : undefined}
              isMinting={mintingDocId === doc.id}
              isSelected={selectedIds.has(doc.id)}
              onToggleSelect={!limit ? toggleSelectDocument : undefined}
            />
          ))}
        </div>
      )}

      {/* "and X more" in preview mode */}
      {limit && pagination && pagination.total > limit && (
        <p className="text-sm text-center text-muted-foreground">
          and {pagination.total - limit} more...
        </p>
      )}

      {/* Pagination in full view */}
      {!limit && pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => p - 1)}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => p + 1)}
            disabled={page >= pagination.totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

interface DocumentRowProps {
  document: DBDocument;
  typeMap: Map<string, DocumentTypeLite>;
  students: Array<{ id: string; user_id: string | null; email: string | null; role: string }>;
  allTags: DBTag[];
  onDelete?: (id: string) => void;
  onAssign?: (documentId: string, data: { student_id?: string | null }) => Promise<any>;
  onMint?: (documentId: string) => Promise<void>;
  onSearchStudents?: (query: string) => void;
  onSetTags?: (documentId: string, tagIds: string[]) => Promise<any>;
  onCreateTag?: (name: string) => Promise<DBTag | undefined>;
  isMinting?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (documentId: string) => void;
}

function DocumentRow({ document, typeMap, students, allTags, onDelete, onAssign, onMint, onSearchStudents, onSetTags, onCreateTag, isMinting, isSelected, onToggleSelect }: DocumentRowProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [studentSearchInput, setStudentSearchInput] = useState('');
  const { getAuthToken } = useAuthStore();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { modal, showAlert, closeModal } = useModal();

  // Close + reset helper
  const closeDropdown = () => {
    setShowAssignDropdown(false);
    setStudentSearchInput('');
  };

  // Click-outside closes and resets
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    };

    if (showAssignDropdown) {
      window.document.addEventListener('mousedown', handleClickOutside);
      return () => window.document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAssignDropdown]);

  // Auto-focus search input and reload default list whenever dropdown opens
  useEffect(() => {
    if (showAssignDropdown) {
      searchInputRef.current?.focus();
      onSearchStudents?.('');
    }
  }, [showAssignDropdown]);

  // Debounce: call API search as user types
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchStudents?.(studentSearchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [studentSearchInput]);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/documents/${document.id}/download`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get download URL');
      }

      const { url } = await response.json();
      window.open(url, '_blank');
    } catch (error) {
      console.error('Download error:', error);
      await showAlert('Failed to download document. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleAssignStudent = async (studentId: string | null) => {
    if (!onAssign) return;

    setIsAssigning(true);
    closeDropdown();
    try {
      await onAssign(document.id, { student_id: studentId });
    } catch (error) {
      console.error('Failed to assign student:', error);
      await showAlert('Failed to assign student. Please try again.');
    } finally {
      setIsAssigning(false);
    }
  };

  const getAssignedStudentName = () => {
    if (!document.student_id) return 'Unassigned';
    const student = students.find(s => s.user_id === document.student_id);
    return student?.email || 'Unknown Student';
  };

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:border-primary/50 transition-colors">
      <Modal
        isOpen={modal.isOpen}
        message={modal.message}
        type={modal.type}
        onConfirm={() => closeModal(true)}
        onCancel={() => closeModal(false)}
      />
      <div className="flex items-center gap-3 flex-1">
        {onToggleSelect && !document.is_published && (
          <input
            type="checkbox"
            checked={!!isSelected}
            onChange={() => onToggleSelect(document.id)}
            className="h-4 w-4 rounded border-gray-300 accent-primary cursor-pointer shrink-0"
            aria-label={`Select ${document.original_filename || resolveDocumentTypeLabel(typeMap, document.document_type_id)}`}
          />
        )}
        <FileText className="h-5 w-5 text-primary" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium truncate">
              {document.original_filename || resolveDocumentTypeLabel(typeMap, document.document_type_id)}
            </p>
            {document.is_published ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                <CheckCircle2 className="h-3 w-3" />
                Published
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                <Circle className="h-3 w-3" />
                Unpublished
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {document.original_filename && (
              <>
                <span>{resolveDocumentTypeLabel(typeMap, document.document_type_id)}</span>
                <span>•</span>
              </>
            )}
            <span>{formatDate(document.created_at)}</span>
            {document.file_size_bytes && (
              <>
                <span>•</span>
                <span>{(document.file_size_bytes / 1024).toFixed(0)} KB</span>
              </>
            )}
          </div>
          {document.tags && document.tags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap mt-1.5">
              {document.tags.map(tag => (
                <TagChip key={tag.id} tag={tag} />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onAssign && (
          <div className="relative" ref={dropdownRef}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => showAssignDropdown ? closeDropdown() : setShowAssignDropdown(true)}
              disabled={isAssigning}
              className="text-xs"
            >
              {isAssigning ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <UserPlus className="h-3 w-3 mr-1" />
              )}
              {getAssignedStudentName()}
            </Button>
            {showAssignDropdown && (
              <div className="absolute right-0 mt-1 w-64 bg-white border rounded-lg shadow-lg z-10">
                {/* Search input */}
                <div className="p-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search student..."
                      value={studentSearchInput}
                      onChange={e => setStudentSearchInput(e.target.value)}
                      className="w-full pl-7 pr-2 py-1.5 text-sm border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                {/* Student list */}
                <div className="p-2 max-h-52 overflow-y-auto">
                  <button
                    onClick={() => handleAssignStudent(null)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                  >
                    Unassign
                  </button>
                  {students.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      {studentSearchInput ? 'No students found' : 'No active students'}
                    </div>
                  ) : (
                    students.map((student) => (
                      <button
                        key={student.id}
                        onClick={() => handleAssignStudent(student.user_id!)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded ${
                          document.student_id === student.user_id ? 'bg-primary/10' : ''
                        }`}
                      >
                        {student.email || 'Unknown'}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {onSetTags && (
          <TagPicker
            documentId={document.id}
            documentTags={document.tags ?? []}
            allTags={allTags}
            onSetTags={onSetTags}
            onCreateTag={onCreateTag}
          />
        )}
        {onMint && !document.is_published && (
          <Button
            variant="default"
            size="sm"
            onClick={() => onMint(document.id)}
            disabled={isMinting}
            title="Publish to blockchain"
          >
            {isMinting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="h-4 w-4" />
            )}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDownload}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>
        {onDelete && !document.is_published && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(document.id)}
            title="Delete document"
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Tag components ──────────────────────────────────────────────────────────

export type TagLike = { id: string; name: string; color: string | null };

export function TagChip({ tag, onRemove }: { tag: TagLike; onRemove?: () => void }) {
  const style = tag.color
    ? { backgroundColor: `${tag.color}1a`, color: tag.color, borderColor: `${tag.color}55` }
    : undefined;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${
        tag.color ? '' : 'bg-gray-100 text-gray-700 border-gray-200'
      }`}
      style={style}
    >
      {tag.name}
      {onRemove && (
        <button type="button" onClick={onRemove} className="hover:opacity-70" aria-label={`Remove ${tag.name}`}>
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

function TagFilter({
  tags,
  selectedTagIds,
  onToggle,
  onClear,
  onCreateTag,
  align = 'right',
}: {
  tags: DBTag[];
  selectedTagIds: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  onCreateTag?: (name: string) => Promise<DBTag | undefined>;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) {
      window.document.addEventListener('mousedown', handleClickOutside);
      return () => window.document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const filtered = tags.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  const exactMatch = tags.some(t => t.name.toLowerCase() === search.trim().toLowerCase());

  const handleCreate = async () => {
    const name = search.trim();
    if (!name || !onCreateTag) return;
    setIsCreating(true);
    try {
      const created = await onCreateTag(name);
      if (created) {
        onToggle(created.id); // select the freshly created tag
        setSearch('');
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1"
      >
        <TagIcon className="h-3 w-3" />
        Tags{selectedTagIds.length > 0 ? ` (${selectedTagIds.length})` : ''}
      </Button>
      {open && (
        <div className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} mt-1 w-64 bg-white border rounded-lg shadow-lg z-10`}>
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search or create tag..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 text-sm border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="p-1 max-h-52 overflow-y-auto">
            {filtered.map(tag => {
              const checked = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => onToggle(tag.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-gray-100 rounded text-left"
                >
                  <span className={`h-4 w-4 flex items-center justify-center border rounded ${checked ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                    {checked && <Check className="h-3 w-3 text-white" />}
                  </span>
                  <TagChip tag={tag} />
                </button>
              );
            })}
            {filtered.length === 0 && !search.trim() && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {tags.length === 0 ? 'No tags yet' : 'No tags found'}
              </div>
            )}
            {onCreateTag && search.trim() && !exactMatch && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={isCreating}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-gray-100 rounded text-left text-primary disabled:opacity-50"
              >
                {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Create &ldquo;{search.trim()}&rdquo;
              </button>
            )}
          </div>
          {selectedTagIds.length > 0 && (
            <div className="p-1 border-t">
              <button
                type="button"
                onClick={onClear}
                className="w-full px-2 py-1.5 text-sm text-muted-foreground hover:bg-gray-100 rounded text-left"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TagPicker({
  documentId,
  documentTags,
  allTags,
  onSetTags,
  onCreateTag,
}: {
  documentId: string;
  documentTags: TagLike[];
  allTags: DBTag[];
  onSetTags: (documentId: string, tagIds: string[]) => Promise<any>;
  onCreateTag?: (name: string) => Promise<DBTag | undefined>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedIds = documentTags.map(t => t.id);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    if (open) {
      window.document.addEventListener('mousedown', handleClickOutside);
      return () => window.document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const applyTags = async (tagIds: string[]) => {
    setIsSaving(true);
    try {
      await onSetTags(documentId, tagIds);
    } finally {
      setIsSaving(false);
    }
  };

  const toggle = (tagId: string) => {
    const next = selectedIds.includes(tagId)
      ? selectedIds.filter(id => id !== tagId)
      : [...selectedIds, tagId];
    applyTags(next);
  };

  const handleCreate = async () => {
    const name = search.trim();
    if (!name || !onCreateTag) return;
    setIsSaving(true);
    try {
      const created = await onCreateTag(name);
      if (created) {
        await onSetTags(documentId, [...selectedIds, created.id]);
        setSearch('');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = allTags.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  const exactMatch = allTags.some(t => t.name.toLowerCase() === search.trim().toLowerCase());

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(o => !o)}
        disabled={isSaving}
        className="text-xs"
        title="Manage tags"
      >
        {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <TagIcon className="h-3 w-3" />}
      </Button>
      {open && (
        <div className="absolute right-0 mt-1 w-64 bg-white border rounded-lg shadow-lg z-10">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search or create tag..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 text-sm border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="p-1 max-h-52 overflow-y-auto">
            {filtered.map(tag => {
              const checked = selectedIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggle(tag.id)}
                  disabled={isSaving}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-gray-100 rounded text-left disabled:opacity-50"
                >
                  <span className={`h-4 w-4 flex items-center justify-center border rounded ${checked ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                    {checked && <Check className="h-3 w-3 text-white" />}
                  </span>
                  <TagChip tag={tag} />
                </button>
              );
            })}
            {filtered.length === 0 && !search.trim() && (
              <div className="px-3 py-2 text-sm text-muted-foreground">No tags yet</div>
            )}
            {onCreateTag && search.trim() && !exactMatch && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={isSaving}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-gray-100 rounded text-left text-primary disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Create &ldquo;{search.trim()}&rdquo;
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

