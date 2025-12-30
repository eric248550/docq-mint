'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useAuthStore } from '@/store/useAuthStore'
import { logout } from '@/lib/firebase/auth'
import { Button } from '@/components/ui/button'
import { LogOut, User, Mail } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const { user } = useAuthStore()
  const router = useRouter()

  const handleLogout = async () => {
    await logout()
    router.push('/')
  }

  return (
    <ProtectedRoute>
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="max-w-2xl w-full space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">Dashboard</h1>
            <p className="text-muted-foreground">
              This is a protected route. Only authenticated users can see this page.
            </p>
          </div>

          <div className="border rounded-lg p-6 space-y-4">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <User className="h-6 w-6" />
              User Information
            </h2>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span className="font-medium">Email:</span>
                <span>{user?.email}</span>
              </div>
              
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <span className="font-medium">User ID:</span>
                <span className="text-xs">{user?.uid}</span>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button onClick={handleLogout} variant="destructive" className="w-full">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>

          <div className="bg-muted p-6 rounded-lg">
            <h3 className="font-semibold mb-2">🎉 Firebase Auth is Working!</h3>
            <p className="text-sm text-muted-foreground">
              You successfully authenticated with Firebase. This dashboard demonstrates:
            </p>
            <ul className="mt-2 text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Protected routes with authentication</li>
              <li>User state management with Zustand</li>
              <li>Firebase Auth integration</li>
              <li>Automatic redirect for unauthenticated users</li>
            </ul>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  )
}

