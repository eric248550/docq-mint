'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

function InviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const { user, isLoading: authLoading, getAuthToken } = useAuthStore();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!authLoading && !user && token) {
      router.push(`/auth?redirect=/invite?token=${encodeURIComponent(token)}`);
    }
  }, [authLoading, user, token, router]);

  const handleAccept = async () => {
    setStatus('loading');
    try {
      const authToken = await getAuthToken();
      const res = await fetch('/api/invite/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatus('error');
        setErrorMessage(data.error || 'Failed to accept invite');
        return;
      }

      setStatus('success');
      router.push('/identity');
    } catch {
      setStatus('error');
      setErrorMessage('An unexpected error occurred');
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Invalid Invite Link</h1>
          <p className="text-muted-foreground">This invite link is missing or invalid.</p>
        </div>
      </div>
    );
  }

  if (!user) return null; // redirecting to /auth

  return (
    <main className="flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md text-center space-y-6">
        <h1 className="text-3xl font-bold">You&apos;ve been invited!</h1>
        <p className="text-muted-foreground">
          Click below to accept your invitation and join your organization.
        </p>

        {status === 'error' && (
          <p className="text-red-500 text-sm">{errorMessage}</p>
        )}

        {status === 'success' ? (
          <p className="text-green-600 font-medium">Invite accepted! Redirecting...</p>
        ) : (
          <Button
            onClick={handleAccept}
            disabled={status === 'loading'}
            size="lg"
            className="w-full"
          >
            {status === 'loading' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Accepting...
              </>
            ) : (
              'Accept Invitation'
            )}
          </Button>
        )}
      </div>
    </main>
  );
}

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      }
    >
      <InviteContent />
    </Suspense>
  );
}
