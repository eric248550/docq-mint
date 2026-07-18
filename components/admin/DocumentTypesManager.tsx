'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Modal, useModal } from '@/components/ui/alert-modal';
import { DBDocumentType } from '@/lib/db/types';
import {
  FileText,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  X,
  CheckCircle2,
} from 'lucide-react';

const inputClass =
  'w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary';

interface FormState {
  label: string;
  category: string;
  max_size_mb: string;
}

const EMPTY_FORM: FormState = { label: '', category: '', max_size_mb: '2' };

export function DocumentTypesManager() {
  const { user } = useAuth();
  const [types, setTypes] = useState<DBDocumentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DBDocumentType | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const { modal, showAlert, showConfirm, closeModal } = useModal();

  // Distinct categories already in use, for the "pick an existing one" dropdown
  const existingCategories = useMemo(() => {
    const set = new Set<string>();
    types.forEach((t) => {
      if (t.category?.trim()) set.add(t.category.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [types]);

  const fetchTypes = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await user?.getIdToken();
      if (!token) return;
      const res = await fetch('/api/admin/document-types', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTypes(data.documentTypes ?? []);
      }
    } catch (err) {
      console.error('Failed to load document types:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setIsNewCategory(false);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (type: DBDocumentType) => {
    setEditing(type);
    setForm({
      label: type.label,
      category: type.category ?? '',
      max_size_mb: String(type.max_size_mb),
    });
    // If this type's category isn't one of the known options (e.g. it's the only
    // type using it and somehow missing from the list), fall back to free text.
    setIsNewCategory(!!type.category && !existingCategories.includes(type.category));
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const maxSizeMb = Number(form.max_size_mb);
    if (!Number.isFinite(maxSizeMb) || maxSizeMb <= 0) {
      setFormError('Max size must be a positive number');
      return;
    }

    setIsSaving(true);
    try {
      const token = await user?.getIdToken();
      if (!token) throw new Error('Not authenticated');

      const url = editing ? `/api/admin/document-types/${editing.id}` : '/api/admin/document-types';
      const method = editing ? 'PATCH' : 'POST';
      const body = { label: form.label.trim(), category: form.category.trim() || null, max_size_mb: maxSizeMb };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to save document type');
        return;
      }

      setDialogOpen(false);
      setBanner({
        type: 'success',
        text: editing ? `"${form.label.trim()}" updated.` : `"${form.label.trim()}" created.`,
      });
      await fetchTypes();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (type: DBDocumentType) => {
    setPendingActionId(type.id);
    try {
      const token = await user?.getIdToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`/api/admin/document-types/${type.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_active: !type.is_active }),
      });
      const data = await res.json();
      if (!res.ok) {
        await showAlert(data.error || 'Failed to update document type');
        return;
      }
      await fetchTypes();
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setPendingActionId(null);
    }
  };

  const handleDelete = async (type: DBDocumentType) => {
    const confirmed = await showConfirm(
      `Delete "${type.label}"? This only works if no documents use this type.`
    );
    if (!confirmed) return;

    setPendingActionId(type.id);
    try {
      const token = await user?.getIdToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`/api/admin/document-types/${type.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && type.is_active) {
          const shouldDeactivate = await showConfirm(
            `${data.error} Deactivate it instead so it's hidden from new uploads?`
          );
          if (shouldDeactivate) {
            await toggleActive(type);
          }
          return;
        }
        await showAlert(data.error || 'Failed to delete document type');
        return;
      }
      setBanner({ type: 'success', text: `"${type.label}" deleted.` });
      await fetchTypes();
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setPendingActionId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Modal
        isOpen={modal.isOpen}
        message={modal.message}
        type={modal.type}
        onConfirm={() => closeModal(true)}
        onCancel={() => closeModal(false)}
      />

      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Document Types</h2>
          <p className="text-sm text-muted-foreground">
            Manage the upload categories and per-type file size limits available across all schools.
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Type
        </Button>
      </div>

      {banner && (
        <div
          className={`flex items-start gap-3 rounded-md border p-4 ${
            banner.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {banner.type === 'success' && <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />}
          <p className="text-sm flex-1">{banner.text}</p>
          <button onClick={() => setBanner(null)} className="text-current/70 hover:text-current" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : types.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <FileText className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium">No document types yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add one to let schools start using it.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {types.map((type) => (
              <li
                key={type.id}
                className={`flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors ${
                  !type.is_active ? 'opacity-60' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate">{type.label}</p>
                    {!type.is_active && (
                      <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-700">Inactive</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                    {type.category && <span className="rounded bg-muted px-1.5 py-0.5">{type.category}</span>}
                    <span>Max {type.max_size_mb} MB</span>
                    <span>·</span>
                    <span>
                      {type.document_count ?? 0} document{(type.document_count ?? 0) === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleActive(type)}
                    disabled={pendingActionId === type.id}
                    title={type.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {pendingActionId === type.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : type.is_active ? (
                      <PowerOff className="h-4 w-4" />
                    ) : (
                      <Power className="h-4 w-4" />
                    )}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(type)} title="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(type)}
                    disabled={pendingActionId === type.id}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => !isSaving && setDialogOpen(false)}
        title={editing ? 'Edit Document Type' : 'Add Document Type'}
        description={
          editing
            ? 'Update this document type. Existing documents keep their assignment.'
            : 'Create a new upload category schools can select from.'
        }
      >
        {formError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{formError}</p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="dt_label" className="block text-sm font-medium mb-1.5">
              Label *
            </label>
            <input
              id="dt_label"
              type="text"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className={inputClass}
              placeholder="e.g. Medical Record"
              required
              disabled={isSaving}
            />
          </div>

          <div>
            <label htmlFor="dt_category" className="block text-sm font-medium mb-1.5">
              Category
            </label>
            {isNewCategory ? (
              <div className="flex gap-2">
                <input
                  id="dt_category"
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className={inputClass}
                  placeholder="e.g. Health"
                  disabled={isSaving}
                  autoFocus
                />
                {existingCategories.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsNewCategory(false);
                      setForm({ ...form, category: '' });
                    }}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            ) : (
              <select
                id="dt_category"
                value={form.category}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    setIsNewCategory(true);
                    setForm({ ...form, category: '' });
                  } else {
                    setForm({ ...form, category: e.target.value });
                  }
                }}
                className={inputClass}
                disabled={isSaving}
              >
                <option value="">No category</option>
                {existingCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value="__new__">+ Add new category…</option>
              </select>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Optional grouping label shown in upload/filter dropdowns.
            </p>
          </div>

          <div>
            <label htmlFor="dt_max_size" className="block text-sm font-medium mb-1.5">
              Max Size (MB) *
            </label>
            <input
              id="dt_max_size"
              type="number"
              min={1}
              step={1}
              value={form.max_size_mb}
              onChange={(e) => setForm({ ...form, max_size_mb: e.target.value })}
              className={inputClass}
              required
              disabled={isSaving}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !form.label.trim()}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : editing ? (
                'Save Changes'
              ) : (
                'Create Type'
              )}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
