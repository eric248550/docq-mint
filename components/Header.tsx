'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';
import { logout } from '@/lib/firebase/auth';

const PORTAL_LABELS: Record<string, string> = {
  student: 'User Portal',
  verifier: 'Verifier Portal',
  school_admin: 'Organization Portal',
};

export function Header() {
  const router = useRouter();
  const { identityContext, clearIdentityContext } = useAuthStore();

  const handleChangeIdentity = () => {
    clearIdentityContext();
    router.push('/identity');
  };

  const handleLogout = async () => {
    await logout();
    clearIdentityContext();
    router.push('/');
  };

  return (
    <div className="border-b">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">
          DOCQ Mint{identityContext ? ` - ${PORTAL_LABELS[identityContext]}` : ''}
        </h1>
        <div className="flex gap-2">
          {identityContext && (
            <Button variant="outline" onClick={handleChangeIdentity}>
              Change Role
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => router.push('/settings/profile')} title="Profile settings">
            <User className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
