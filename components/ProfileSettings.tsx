'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { authenticatedRequest } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2, Save, CheckCircle2, Mail } from 'lucide-react';
import { DBUser } from '@/lib/db/types';

function getInitials(firstName: string, lastName: string, email?: string | null) {
  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.trim();
  if (initials) return initials.toUpperCase();
  return (email?.[0] ?? '?').toUpperCase();
}

export function ProfileSettings() {
  const { getAuthToken } = useAuthStore();
  const [user, setUser] = useState<DBUser | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = await getAuthToken();
        if (!token) return;
        const res = await authenticatedRequest<{ user: DBUser }>('/api/users/me', token);
        if (res.data?.user) {
          const u = res.data.user;
          setUser(u);
          setFirstName(u.first_name || '');
          setLastName(u.last_name || '');
        }
      } catch {
        setError('Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, [getAuthToken]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');
      const res = await authenticatedRequest<{ user: DBUser }>('/api/users/me', token, {
        method: 'PATCH',
        body: JSON.stringify({ first_name: firstName || null, last_name: lastName || null }),
      });
      if (res.error) throw new Error(res.error);
      if (res.data?.user) setUser(res.data.user);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-4 space-y-0">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
          {getInitials(firstName, lastName, user?.email)}
        </div>
        <div>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your name and personal details</CardDescription>
        </div>
      </CardHeader>

      <form onSubmit={handleSave}>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Smith"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={user?.email || ''}
                disabled
                className="cursor-not-allowed bg-muted pl-9 text-muted-foreground"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Email is managed by your authentication provider
            </p>
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {success && (
            <p className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Profile saved successfully
            </p>
          )}
        </CardContent>

        <CardFooter>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
