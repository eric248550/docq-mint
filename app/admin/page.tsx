'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import {
  Loader2,
  ShieldCheck,
  CheckCircle2,
  Coins,
  Plus,
  Search,
  Building2,
  ChevronLeft,
  ChevronRight,
  X,
  Minus,
} from 'lucide-react';
import { isAdminEmail } from '@/lib/auth/admin';

interface SchoolCredit {
  id: string;
  name: string;
  country_code: string | null;
  compliance_region: string | null;
  credit_balance: number;
}

const REGIONS = ['FERPA', 'GDPR', 'NZPA', 'MIXED'];
const PAGE_SIZE = 8;
const inputClass =
  'w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary';

export default function AdminPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const isAdmin = isAdminEmail(user?.email);

  // --- Org list ---
  const [schools, setSchools] = useState<SchoolCredit[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [page, setPage] = useState(1);

  // --- Top-level banners ---
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // --- Create org modal ---
  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    country_code: '',
    compliance_region: '',
    owner_email: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // --- Credit modal ---
  const [creditSchool, setCreditSchool] = useState<SchoolCredit | null>(null);
  const [creditMode, setCreditMode] = useState<'add' | 'remove'>('add');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditNote, setCreditNote] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [creditError, setCreditError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.replace('/');
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  const fetchSchools = useCallback(async () => {
    try {
      const token = await user?.getIdToken();
      if (!token) return;
      const res = await fetch('/api/admin/credits', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSchools(data.schools ?? []);
      }
    } catch (err) {
      console.error('Failed to load schools:', err);
    } finally {
      setSchoolsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isAdmin) fetchSchools();
  }, [isAdmin, fetchSchools]);

  // Reset to first page whenever the query narrows/changes.
  useEffect(() => {
    setPage(1);
  }, [search, regionFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return schools.filter((s) => {
      const matchesSearch = !q || s.name.toLowerCase().includes(q);
      const matchesRegion = !regionFilter || (s.compliance_region ?? '') === regionFilter;
      return matchesSearch && matchesRegion;
    });
  }, [schools, search, regionFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  const openCreate = () => {
    setFormData({ name: '', country_code: '', compliance_region: '', owner_email: '' });
    setCreateError(null);
    setCreateOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setCreateError(null);
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/admin/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || 'Failed to create school');
        return;
      }
      setCreateOpen(false);
      setBanner({
        type: 'success',
        text:
          data.owner_status === 'active'
            ? `"${data.school.name}" created — ${data.owner_email} is now the owner.`
            : `"${data.school.name}" created — ${data.owner_email} will become the owner when they log in.`,
      });
      await fetchSchools();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCredit = (school: SchoolCredit) => {
    setCreditSchool(school);
    setCreditMode('add');
    setCreditAmount('');
    setCreditNote('');
    setCreditError(null);
  };

  const handleAssignCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditSchool) return;
    setCreditError(null);

    const n = parseInt(creditAmount, 10);
    if (!Number.isInteger(n) || n <= 0) {
      setCreditError('Enter a positive whole number of credits');
      return;
    }
    const signedAmount = creditMode === 'remove' ? -n : n;
    const type = creditMode === 'remove' ? 'adjustment' : 'grant';

    setIsAssigning(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/admin/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          schoolId: creditSchool.id,
          amount: signedAmount,
          note: creditNote.trim() || undefined,
          type,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreditError(data.error || 'Failed to update credits');
        return;
      }
      setBanner({
        type: 'success',
        text: `${creditMode === 'remove' ? 'Removed' : 'Added'} ${n} credit(s) ${
          creditMode === 'remove' ? 'from' : 'to'
        } ${creditSchool.name}. New balance: ${data.balance}.`,
      });
      setCreditSchool(null);
      await fetchSchools();
    } catch (err) {
      setCreditError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setIsAssigning(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  return (
    <main className="min-h-screen py-10 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-lg">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Organizations</h1>
              <p className="text-sm text-muted-foreground">
                Manage school organizations and publishing credits
              </p>
            </div>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Organization
          </Button>
        </div>

        {/* Banner */}
        {banner && (
          <div
            className={`mb-4 flex items-start gap-3 rounded-md border p-4 ${
              banner.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {banner.type === 'success' && (
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
            )}
            <p className="text-sm flex-1">{banner.text}</p>
            <button
              onClick={() => setBanner(null)}
              className="text-current/70 hover:text-current"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search organizations by name…"
              className={`${inputClass} pl-9`}
            />
          </div>
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className={`${inputClass} sm:w-56`}
          >
            <option value="">All compliance regions</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Org list */}
        <div className="border rounded-lg overflow-hidden">
          {schoolsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <Building2 className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-medium">No organizations found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {schools.length === 0
                  ? 'Create your first organization to get started.'
                  : 'Try adjusting your search or filter.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {pageItems.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold uppercase">
                    {s.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{s.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      {s.country_code && <span>{s.country_code}</span>}
                      {s.country_code && s.compliance_region && <span>·</span>}
                      {s.compliance_region && (
                        <span className="rounded bg-muted px-1.5 py-0.5">{s.compliance_region}</span>
                      )}
                      {!s.country_code && !s.compliance_region && <span>No region set</span>}
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-sm font-medium text-amber-700">
                    <Coins className="h-3.5 w-3.5" />
                    {s.credit_balance}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openCredit(s)}>
                    <Coins className="h-4 w-4 mr-1.5 sm:hidden" />
                    Manage Credits
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pagination */}
        {!schoolsLoading && filtered.length > 0 && (
          <div className="flex items-center justify-between mt-4 text-sm">
            <p className="text-muted-foreground">
              Showing {startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, filtered.length)} of{' '}
              {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create Organization modal */}
      <Dialog
        open={createOpen}
        onClose={() => !isSubmitting && setCreateOpen(false)}
        title="Create School Organization"
        description="Set up a new organization and assign its owner by email."
      >
        {createError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{createError}</p>
          </div>
        )}
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1.5">
              Organization Name *
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={inputClass}
              placeholder="Enter organization name"
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="owner_email" className="block text-sm font-medium mb-1.5">
              Owner Email *
            </label>
            <input
              id="owner_email"
              type="email"
              value={formData.owner_email}
              onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })}
              className={inputClass}
              placeholder="owner@school.edu"
              required
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground mt-1">
              If this user doesn&apos;t have an account yet, they&apos;ll become owner when they sign up.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="country_code" className="block text-sm font-medium mb-1.5">
                Country Code
              </label>
              <input
                id="country_code"
                type="text"
                value={formData.country_code}
                onChange={(e) =>
                  setFormData({ ...formData, country_code: e.target.value.toUpperCase() })
                }
                className={inputClass}
                placeholder="US"
                maxLength={2}
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label htmlFor="compliance_region" className="block text-sm font-medium mb-1.5">
                Compliance Region
              </label>
              <select
                id="compliance_region"
                value={formData.compliance_region}
                onChange={(e) => setFormData({ ...formData, compliance_region: e.target.value })}
                className={inputClass}
                disabled={isSubmitting}
              >
                <option value="">Optional</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !formData.name.trim() || !formData.owner_email.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating…
                </>
              ) : (
                'Create Organization'
              )}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Manage Credits modal */}
      <Dialog
        open={!!creditSchool}
        onClose={() => !isAssigning && setCreditSchool(null)}
        title="Manage Credits"
        description={creditSchool?.name}
      >
        {creditSchool && (
          <>
            <div className="mb-5 flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
              <span className="text-sm text-muted-foreground">Current balance</span>
              <span className="flex items-center gap-1.5 text-lg font-semibold text-amber-600">
                <Coins className="h-4 w-4" />
                {creditSchool.credit_balance}
              </span>
            </div>

            {creditError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{creditError}</p>
              </div>
            )}

            <form onSubmit={handleAssignCredits} className="space-y-4">
              {/* Add / Remove toggle */}
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                <button
                  type="button"
                  onClick={() => setCreditMode('add')}
                  className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-colors ${
                    creditMode === 'add'
                      ? 'bg-background shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setCreditMode('remove')}
                  className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-colors ${
                    creditMode === 'remove'
                      ? 'bg-background shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Minus className="h-4 w-4" />
                  Remove
                </button>
              </div>

              <div>
                <label htmlFor="credit_amount" className="block text-sm font-medium mb-1.5">
                  Amount *
                </label>
                <input
                  id="credit_amount"
                  type="number"
                  min={1}
                  step={1}
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. 100"
                  disabled={isAssigning}
                  autoFocus
                  required
                />
                {creditAmount && Number(creditAmount) > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    New balance:{' '}
                    <span className="font-medium">
                      {creditMode === 'remove'
                        ? creditSchool.credit_balance - Number(creditAmount)
                        : creditSchool.credit_balance + Number(creditAmount)}
                    </span>
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="credit_note" className="block text-sm font-medium mb-1.5">
                  Note (optional)
                </label>
                <input
                  id="credit_note"
                  type="text"
                  value={creditNote}
                  onChange={(e) => setCreditNote(e.target.value)}
                  className={inputClass}
                  placeholder={creditMode === 'remove' ? 'e.g. Correction' : 'e.g. Initial allocation'}
                  disabled={isAssigning}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreditSchool(null)}
                  disabled={isAssigning}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant={creditMode === 'remove' ? 'destructive' : 'default'}
                  disabled={isAssigning || !creditAmount.trim()}
                >
                  {isAssigning ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving…
                    </>
                  ) : creditMode === 'remove' ? (
                    'Remove Credits'
                  ) : (
                    'Add Credits'
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </Dialog>
    </main>
  );
}
