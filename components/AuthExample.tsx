'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, signUp, logout, signInWithGoogle } from '@/lib/firebase/auth'
import { useAuthStore } from '@/store/useAuthStore'
import { Button } from '@/components/ui/button'
import { LogIn, LogOut, UserPlus, ArrowRight } from 'lucide-react'

export function AuthExample() {
  const { user, isLoading } = useAuthStore()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    const { user: newUser, error: signUpError } = await signUp(email, password)
    
    if (signUpError) {
      setError(signUpError)
    } else {
      setEmail('')
      setPassword('')
    }
    
    setLoading(false)
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    const { user: signedInUser, error: signInError } = await signIn(email, password)
    
    if (signInError) {
      setError(signInError)
    } else {
      setEmail('')
      setPassword('')
    }
    
    setLoading(false)
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError(null)
    
    const { user: googleUser, error: googleError } = await signInWithGoogle()
    
    if (googleError) {
      setError(googleError)
    }
    
    setLoading(false)
  }

  const handleLogout = async () => {
    setLoading(true)
    const { error: logoutError } = await logout()
    
    if (logoutError) {
      setError(logoutError)
    }
    
    setLoading(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (user) {
    return (
      <div className="flex flex-col items-center gap-4 p-8 border rounded-lg bg-card">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Welcome Back!</h2>
          <p className="text-muted-foreground text-sm">Logged in as: {user.email}</p>
        </div>
        
        <div className="flex gap-2 w-full">
          <Button 
            onClick={() => router.push('/dashboard')} 
            className="flex-1"
          >
            Go to Dashboard
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
        
        <Button 
          onClick={handleLogout} 
          disabled={loading} 
          variant="outline"
          className="w-full"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-8 border rounded-lg max-w-md w-full bg-card">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Firebase Authentication</h2>
        <p className="text-sm text-muted-foreground">
          Sign in or create a new account
        </p>
      </div>
      
      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          {error}
        </div>
      )}
      
      <div className="space-y-4">
        {/* Google Sign In Button */}
        <Button 
          onClick={handleGoogleSignIn}
          disabled={loading}
          variant="outline"
          className="w-full"
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </Button>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Or continue with email
            </span>
          </div>
        </div>

        {/* Email/Password Form */}
        <form className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="text-sm font-medium mb-1 block">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              disabled={loading}
            />
          </div>
          
          <div>
            <label htmlFor="password" className="text-sm font-medium mb-1 block">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              disabled={loading}
            />
          </div>
          
          <div className="flex gap-2 pt-2">
            <Button 
              onClick={handleSignIn} 
              disabled={loading || !email || !password}
              className="flex-1"
            >
              {loading ? 'Loading...' : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In
                </>
              )}
            </Button>
            <Button 
              onClick={handleSignUp} 
              disabled={loading || !email || !password}
              variant="outline"
              className="flex-1"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Sign Up
            </Button>
          </div>
        </form>
      </div>
      
      <div className="text-xs text-muted-foreground text-center space-y-1">
        <p>Password must be at least 6 characters</p>
        <p className="text-primary">Email: test@example.com / password123</p>
      </div>
    </div>
  )
}

