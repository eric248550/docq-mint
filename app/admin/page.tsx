'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck, CheckCircle2 } from 'lucide-react';

const ADMIN_DOMAIN = 'docq-mint.com';

interface CreatedSchool {
  name: string;
  owner_email: string;
  owner_status: 'active' | 'invited';
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

  const isAdmin = user?.email?.endsWith(`@${ADMIN_DOMAIN}`) ?? false;

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.replace('/');
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

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
      </div>
    </main>
  );
}
