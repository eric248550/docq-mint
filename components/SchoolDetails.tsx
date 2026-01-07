'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { authenticatedRequest } from '@/lib/api/client';
import { DBSchool } from '@/lib/db/types';
import { Button } from '@/components/ui/button';
import { Building2, Loader2, Save } from 'lucide-react';

interface SchoolDetailsProps {
  schoolId: string;
  editable?: boolean;
}

export function SchoolDetails({ schoolId, editable = false }: SchoolDetailsProps) {
  const { getAuthToken } = useAuthStore();
  const [school, setSchool] = useState<DBSchool | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    country_code: '',
    compliance_region: '',
  });

  useEffect(() => {
    const fetchSchool = async () => {
      try {
        const token = await getAuthToken();
        if (!token) return;

        const response = await authenticatedRequest<{ school: DBSchool }>(
          `/api/schools/${schoolId}`,
          token
        );

        if (response.data) {
          setSchool(response.data.school);
          setFormData({
            name: response.data.school.name,
            country_code: response.data.school.country_code || '',
            compliance_region: response.data.school.compliance_region || '',
          });
        }
      } catch (error) {
        console.error('Failed to fetch school:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSchool();
  }, [schoolId, getAuthToken]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = await getAuthToken();
      if (!token) return;

      const response = await authenticatedRequest<{ school: DBSchool }>(
        `/api/schools/${schoolId}`,
        token,
        {
          method: 'PATCH',
          body: JSON.stringify(formData),
        }
      );

      if (response.data) {
        setSchool(response.data.school);
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Failed to update school:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!school) {
    return <div className="text-center p-8">School not found</div>;
  }

  return (
    <div className="border rounded-lg p-6">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <div>
            {isEditing && editable ? (
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="text-2xl font-bold border rounded px-2 py-1"
              />
            ) : (
              <h2 className="text-2xl font-bold">{school.name}</h2>
            )}
          </div>
        </div>
        {editable && (
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      name: school.name,
                      country_code: school.country_code || '',
                      compliance_region: school.compliance_region || '',
                    });
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground">Country</label>
          {isEditing && editable ? (
            <input
              type="text"
              value={formData.country_code}
              onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
              placeholder="e.g., US, UK, CA"
              className="w-full mt-1 px-3 py-2 border rounded-md"
            />
          ) : (
            <p className="mt-1">{school.country_code || 'Not specified'}</p>
          )}
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Compliance Region</label>
          {isEditing && editable ? (
            <select
              value={formData.compliance_region}
              onChange={(e) => setFormData({ ...formData, compliance_region: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
            >
              <option value="">Select...</option>
              <option value="FERPA">FERPA</option>
              <option value="GDPR">GDPR</option>
              <option value="NZPA">NZPA</option>
              <option value="MIXED">MIXED</option>
            </select>
          ) : (
            <p className="mt-1">{school.compliance_region || 'Not specified'}</p>
          )}
        </div>
      </div>
    </div>
  );
}

