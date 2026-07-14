'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/useAuthStore';
import { SchoolAdminDashboard } from '@/components/SchoolAdminDashboard';
import { StudentDashboard } from '@/components/StudentDashboard';
import { VerifierDashboard } from '@/components/VerifierDashboard';
import { Header } from '@/components/Header';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { identityContext } = useAuthStore();

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/');
    } else if (user && !user.emailVerified) {
      router.push('/auth/verify-email');
    } else if (!identityContext) {
      router.push('/identity');
    }
  }, [user, isAuthenticated, authLoading, identityContext, router]);

  if (authLoading || !identityContext) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="min-h-screen">
      <Header />

      <div className="container mx-auto px-4 py-8">
        {identityContext === 'school_admin' && <SchoolAdminDashboard />}
        {identityContext === 'student' && <StudentDashboard />}
        {identityContext === 'verifier' && <VerifierDashboard />}
      </div>
    </main>
  );
}
