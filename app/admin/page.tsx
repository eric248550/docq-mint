'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck, CheckCircle2, Coins } from 'lucide-react';
import { isAdminEmail } from '@/lib/auth/admin';

interface CreatedSchool {
  name: string;
  owner_email: string;
  owner_status: 'active' | 'invited';
}

interface SchoolCredit {
  id: string;
  name: string;
  country_code: string | null;
  credit_balance: number;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    country_code: '',
    compliance_region: '',
    owner_email: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedSchool | null>(null);

  // --- Credit management ---
  const [schools, setSchools] = useState<SchoolCredit[]>([]);
  const [selectedCreditSchoolId, setSelectedCreditSchoolId] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditNote, setCreditNote] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [creditError, setCreditError] = useState<string | null>(null);
  const [creditMsg, setCreditMsg] = useState<string | null>(null);

  const isAdmin = isAdminEmail(user?.email);

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
    }
  }, [user]);

  useEffect(() => {
    if (isAdmin) fetchSchools();
  }, [isAdmin, fetchSchools]);

  const selectedCreditSchool = schools.find((s) => s.id === selectedCreditSchoolId) || null;

  const handleAssignCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreditError(null);
    setCreditMsg(null);

    const amount = parseInt(creditAmount, 10);
    if (!selectedCreditSchoolId) {
      setCreditError('Select a school');
      return;
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      setCreditError('Enter a positive whole number of credits');
      return;
    }

    setIsAssigning(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/admin/credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          schoolId: selectedCreditSchoolId,
          amount,
          note: creditNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreditError(data.error || 'Failed to assign credits');
        return;
      }
      setCreditMsg(`Assigned ${amount} credit(s). New balance: ${data.balance}.`);
      setCreditAmount('');
      setCreditNote('');
      await fetchSchools();
    } catch (err) {
      setCreditError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setCreated(null);

    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/admin/schools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create school');
        return;
      }

      setCreated({
        name: data.school.name,
        owner_email: data.owner_email,
        owner_status: data.owner_status,
      });
      setFormData({ name: '', country_code: '', compliance_region: '', owner_email: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setIsSubmitting(false);
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
    <main className="min-h-screen py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-primary/10 rounded-lg">
            <ShieldCheck className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">Create school organizations</p>
          </div>
        </div>

        {created && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800">
                School &quot;{created.name}&quot; created successfully
              </p>
              <p className="text-sm text-green-700 mt-0.5">
                {created.owner_status === 'active'
                  ? `${created.owner_email} is now the owner.`
                  : `${created.owner_email} will become the owner when they log in.`}
                &nbsp;A notification email has been sent.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="border rounded-lg p-8">
          <h2 className="text-lg font-semibold mb-6">Create School Organization</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1.5">
                School Name *
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter school name"
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
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="owner@school.edu"
                required
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground mt-1">
                If this user doesn&apos;t have an account yet, they will be assigned as owner when they sign up.
              </p>
            </div>

            <div>
              <label htmlFor="country_code" className="block text-sm font-medium mb-1.5">
                Country Code
              </label>
              <input
                id="country_code"
                type="text"
                value={formData.country_code}
                onChange={(e) => setFormData({ ...formData, country_code: e.target.value.toUpperCase() })}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. US, UK, CA"
                maxLength={2}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground mt-1">ISO 3166-1 alpha-2 code (optional)</p>
            </div>

            <div>
              <label htmlFor="compliance_region" className="block text-sm font-medium mb-1.5">
                Compliance Region
              </label>
              <select
                id="compliance_region"
                value={formData.compliance_region}
                onChange={(e) => setFormData({ ...formData, compliance_region: e.target.value })}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                disabled={isSubmitting}
              >
                <option value="">Select compliance region (optional)</option>
                <option value="FERPA">FERPA (United States)</option>
                <option value="GDPR">GDPR (European Union)</option>
                <option value="NZPA">NZPA (New Zealand)</option>
                <option value="MIXED">MIXED</option>
              </select>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={isSubmitting || !formData.name.trim() || !formData.owner_email.trim()}
                className="w-full"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create School'
                )}
              </Button>
            </div>
          </form>
        </div>

        {/* File Credits Management */}
        <div className="border rounded-lg p-8 mt-8">
          <div className="flex items-center gap-2 mb-1">
            <Coins className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">File Credits</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Assign publishing credits to an organization. Each document published on-chain consumes 1 credit.
          </p>

          {creditMsg && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-700">{creditMsg}</p>
            </div>
          )}
          {creditError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{creditError}</p>
            </div>
          )}

          <form onSubmit={handleAssignCredits} className="space-y-5">
            <div>
              <label htmlFor="credit_school" className="block text-sm font-medium mb-1.5">
                Organization *
              </label>
              <select
                id="credit_school"
                value={selectedCreditSchoolId}
                onChange={(e) => setSelectedCreditSchoolId(e.target.value)}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                disabled={isAssigning}
                required
              >
                <option value="">Select an organization</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.credit_balance} credit{s.credit_balance === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
              {selectedCreditSchool && (
                <p className="text-xs text-muted-foreground mt-1">
                  Current balance: <span className="font-medium">{selectedCreditSchool.credit_balance}</span> credit(s)
                </p>
              )}
            </div>

            <div>
              <label htmlFor="credit_amount" className="block text-sm font-medium mb-1.5">
                Credits to add *
              </label>
              <input
                id="credit_amount"
                type="number"
                min={1}
                step={1}
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. 100"
                disabled={isAssigning}
                required
              />
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
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. Initial allocation"
                disabled={isAssigning}
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={isAssigning || !selectedCreditSchoolId || !creditAmount.trim()}
                className="w-full"
              >
                {isAssigning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  'Assign Credits'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
