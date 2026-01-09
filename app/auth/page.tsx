'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { AuthExample } from '@/components/AuthExample';
import { Loader2 } from 'lucide-react';

export default function AuthPage() {
  const { user, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    // If user is already authenticated, redirect to identity selection
    if (!isLoading && user) {
      router.push('/identity');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // If user is authenticated, show nothing (will redirect via useEffect)
  if (user) {
    return null;
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/20">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Welcome to DOCQ Mint</h1>
          <p className="text-muted-foreground">
            Sign in to manage your academic credentials
          </p>
        </div>
        
        <AuthExample />
      </div>
    </main>
  );
}

