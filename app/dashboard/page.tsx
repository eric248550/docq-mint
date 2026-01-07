'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/useAuthStore';
import { SchoolAdminDashboard } from '@/components/SchoolAdminDashboard';
import { StudentDashboard } from '@/components/StudentDashboard';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut } from 'lucide-react';
import { logout } from '@/lib/firebase/auth';

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { identityContext, clearIdentityContext } = useAuthStore();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/');
    } else if (!authLoading && isAuthenticated && !identityContext) {
      router.push('/identity');
    }
  }, [isAuthenticated, authLoading, identityContext, router]);

  const handleChangeIdentity = () => {
    clearIdentityContext();
    router.push('/identity');
  };

  const handleLogout = async () => {
    await logout();
    clearIdentityContext();
    router.push('/');
  };

  if (authLoading || !identityContext) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">
            DOCQ Mint - {identityContext === 'student' ? 'Student Portal' : 'School Admin'}
          </h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleChangeIdentity}>
              Change Role
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {identityContext === 'school_admin' && <SchoolAdminDashboard />}
        {identityContext === 'student' && <StudentDashboard />}
      </div>
    </main>
  );
}
