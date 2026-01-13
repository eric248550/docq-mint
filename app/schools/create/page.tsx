'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useSchools } from '@/hooks/useSchools';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Building2 } from 'lucide-react';

export default function CreateSchoolPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { createSchool } = useSchools();
  
  const [formData, setFormData] = useState({
    name: '',
    country_code: '',
    compliance_region: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const school = await createSchool(formData);
      if (school) {
        // Redirect to identity selection to choose this school
        router.push('/identity');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create school');
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

  if (!isAuthenticated) {
    router.push('/');
    return null;
  }

  return (
    <main className="min-h-screen py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="border rounded-lg p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Create School</h1>
              <p className="text-muted-foreground">Set up a new school organization</p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Organization Name *
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter organization name"
                required
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="country_code" className="block text-sm font-medium mb-2">
                Country Code
              </label>
              <input
                id="country_code"
                type="text"
                value={formData.country_code}
                onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., US, UK, CA"
                maxLength={2}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground mt-1">
                ISO 3166-1 alpha-2 code (optional)
              </p>
            </div>

            <div>
              <label htmlFor="compliance_region" className="block text-sm font-medium mb-2">
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

            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting || !formData.name.trim()}
                className="flex-1"
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
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

