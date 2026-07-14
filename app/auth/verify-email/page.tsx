'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/useAuthStore'
import { EmailVerificationGate } from '@/components/EmailVerificationGate'
import { Loader2 } from 'lucide-react'

export default function VerifyEmailPage() {
  const { user, isLoading } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.replace('/')
    } else if (user.emailVerified) {
      router.replace('/identity')
    }
  }, [user, isLoading, router])

  if (isLoading || !user || user.emailVerified) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }

  return <EmailVerificationGate />
}
