'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase/config'
import { resendEmailVerification, logout } from '@/lib/firebase/auth'
import { useAuthStore } from '@/store/useAuthStore'
import { Button } from '@/components/ui/button'
import { Loader2, LogOut, MailCheck, RefreshCw } from 'lucide-react'

/**
 * Full-screen gate shown to signed-in users whose email is not yet verified.
 * Polls Firebase for verification, lets the user resend the link, and forwards
 * to /identity once the address is confirmed.
 */
export function EmailVerificationGate() {
  const router = useRouter()
  const { user, setUser } = useAuthStore()
  const [checking, setChecking] = useState(false)
  const [resending, setResending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  // Refresh the Firebase user and, if verified, force a token refresh (so the
  // email_verified claim updates) before continuing into the app.
  const refreshStatus = useCallback(async (): Promise<boolean> => {
    const current = auth.currentUser
    if (!current) return false
    await current.reload()
    if (current.emailVerified) {
      // Force a new ID token so the backend sees email_verified: true
      await current.getIdToken(true)
      setUser(auth.currentUser)
      router.replace('/identity')
      return true
    }
    return false
  }, [router, setUser])

  // Poll for verification every few seconds while this screen is open.
  const pollRef = useRef(refreshStatus)
  pollRef.current = refreshStatus
  useEffect(() => {
    const id = setInterval(() => {
      pollRef.current()
    }, 5000)
    return () => clearInterval(id)
  }, [])

  // Resend cooldown ticker
  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  const handleCheck = async () => {
    setChecking(true)
    setError(null)
    setMessage(null)
    try {
      const verified = await refreshStatus()
      if (!verified) {
        setMessage('Still not verified. Click the link in your email, then try again.')
      }
    } catch (e: any) {
      setError(e?.message || 'Could not check verification status')
    } finally {
      setChecking(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    setError(null)
    setMessage(null)
    const { error: resendError } = await resendEmailVerification()
    if (resendError) {
      setError(resendError)
    } else {
      setMessage('Verification email sent. Check your inbox (and spam folder).')
      setCooldown(30)
    }
    setResending(false)
  }

  const handleLogout = async () => {
    await logout()
    router.replace('/')
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/20">
      <div className="w-full max-w-md flex flex-col gap-6 p-8 border rounded-lg bg-card text-center">
        <div className="mx-auto p-3 bg-primary/10 rounded-full w-fit">
          <MailCheck className="h-8 w-8 text-primary" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Verify your email</h1>
          <p className="text-sm text-muted-foreground">
            We sent a verification link to{' '}
            <strong className="text-foreground">{user?.email}</strong>. Click it to
            activate your account, then continue.
          </p>
        </div>

        {message && (
          <div className="p-3 bg-green-500/10 text-green-700 dark:text-green-400 rounded-md text-sm">
            {message}
          </div>
        )}
        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button onClick={handleCheck} disabled={checking} className="w-full">
            {checking ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            I&apos;ve verified — continue
          </Button>

          <Button
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            variant="outline"
            className="w-full"
          >
            {resending
              ? 'Sending...'
              : cooldown > 0
                ? `Resend link (${cooldown}s)`
                : 'Resend verification email'}
          </Button>
        </div>

        <Button onClick={handleLogout} variant="ghost" className="w-full">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </main>
  )
}
