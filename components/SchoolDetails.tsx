'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { authenticatedRequest } from '@/lib/api/client';
import { DBSchool } from '@/lib/db/types';
import { Button } from '@/components/ui/button';
import { Building2, Camera, Loader2, Save } from 'lucide-react';
import { useS3Upload } from '@/hooks/useS3Upload';

interface SchoolDetailsProps {
  schoolId: string;
  editable?: boolean;
}

export function SchoolDetails({ schoolId, editable = false }: SchoolDetailsProps) {
  const { getAuthToken, user } = useAuthStore();
  const { uploadFile, progress: uploadProgress, reset: resetUpload } = useS3Upload();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [school, setSchool] = useState<DBSchool | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoSignedUrl, setLogoSignedUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    country_code: '',
    compliance_region: '',
    logo_url: '',
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
          const s = response.data.school;
          setSchool(s);
          setFormData({
            name: s.name,
            country_code: s.country_code || '',
            compliance_region: s.compliance_region || '',
            logo_url: s.logo_url || '',
          });
          if (s.logo_url) {
            fetchSignedLogoUrl(s3KeyFromUrl(s.logo_url));
          }
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
        const s = response.data.school;
        setSchool(s);
        setLogoPreview(null);
        setIsEditing(false);
        resetUpload();
        if (s.logo_url) {
          fetchSignedLogoUrl(s3KeyFromUrl(s.logo_url));
        } else {
          setLogoSignedUrl(null);
        }
      }
    } catch (error) {
      console.error('Failed to update school:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const s3KeyFromUrl = (url: string): string => {
    // Strips "https://<bucket>.s3.amazonaws.com/" to get the S3 key
    return url.replace(/^https?:\/\/[^/]+\.s3[^/]*\.amazonaws\.com\//, '');
  };

  const fetchSignedLogoUrl = async (key: string) => {
    try {
      const res = await fetch(`/api/s3/presigned-get?key=${encodeURIComponent(key)}`);
      if (res.ok) {
        const { url } = await res.json();
        setLogoSignedUrl(url);
      }
    } catch {
      // silently ignore — logo just won't show
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setLogoPreview(objectUrl);

    const result = await uploadFile(file, user?.uid, 'logos');
    if (result) {
      setFormData(prev => ({ ...prev, logo_url: result.url }));
    } else {
      setLogoPreview(null);
    }

    if (logoInputRef.current) logoInputRef.current.value = '';
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
          <div className="relative group">
            {logoPreview || logoSignedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoPreview || logoSignedUrl!}
                alt="Org logo"
                className="h-16 w-16 rounded-lg object-cover border"
              />
            ) : (
              <div className="p-3 bg-primary/10 rounded-lg h-16 w-16 flex items-center justify-center">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
            )}
            {isEditing && editable && (
              <>
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadProgress.status === 'uploading'}
                  className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  {uploadProgress.status === 'uploading' ? (
                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                  ) : (
                    <Camera className="h-5 w-5 text-white" />
                  )}
                </button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleLogoChange}
                />
              </>
            )}
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
                    setLogoPreview(null);
                    resetUpload();
                    setFormData({
                      name: school.name,
                      country_code: school.country_code || '',
                      compliance_region: school.compliance_region || '',
                      logo_url: school.logo_url || '',
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

