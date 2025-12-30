import { useAuthStore } from '@/store/useAuthStore'
import { 
  signIn, 
  signUp, 
  logout, 
  signInWithGoogle,
  signInWithGoogleRedirect 
} from '@/lib/firebase/auth'

/**
 * Custom hook for Firebase authentication
 * Provides easy access to auth state and methods
 */
export function useAuth() {
  const { user, isLoading, setUser, setIsLoading } = useAuthStore()

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithGoogleRedirect,
    logout,
  }
}

