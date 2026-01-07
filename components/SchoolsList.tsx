'use client';

import { useSchools } from '@/hooks/useSchools';
import { Button } from '@/components/ui/button';
import { Building2, Loader2 } from 'lucide-react';

export function SchoolsList() {
  const { schools, isLoading, error } = useSchools();

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
        <p>Error loading schools: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {schools.length === 0 ? (
        <div className="text-center p-12 border rounded-lg">
          <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">No schools yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first school to get started
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {schools.map((school) => (
            <div
              key={school.id}
              className="border rounded-lg p-6 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{school.name}</h3>
                  {school.country_code && (
                    <p className="text-sm text-muted-foreground">
                      {school.country_code}
                      {school.compliance_region && ` • ${school.compliance_region}`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

