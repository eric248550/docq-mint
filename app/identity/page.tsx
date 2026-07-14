'use client';

import { IdentitySelector } from '@/components/IdentitySelector';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function IdentityPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push('/');
    } else if (user && !user.emailVerified) {
      router.push('/auth/verify-email');
    }
  }, [user, isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated || (user && !user.emailVerified)) {
    return null;
  }

  return (
    <main className="min-h-screen py-12 px-4">
      <IdentitySelector />
    </main>
  );
}

