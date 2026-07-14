'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ProfileSettings } from '@/components/ProfileSettings';
import { TwoFactorSettings } from '@/components/TwoFactorSettings';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Settings } from 'lucide-react';

export default function ProfileSettingsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <main className="min-h-screen bg-muted/30">
      <div className="border-b bg-background">
        <div className="container mx-auto max-w-3xl px-4 py-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="-ml-2 mb-4 text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
              <p className="text-sm text-muted-foreground">
                Manage your profile and account security
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="container mx-auto max-w-3xl px-4 py-8 space-y-6">
        <ProfileSettings />
        <TwoFactorSettings />
      </div>
    </main>
  );
}
