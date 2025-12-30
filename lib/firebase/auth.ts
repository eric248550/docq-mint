import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult
} from "firebase/auth"
import { auth } from "./config"
import { useAuthStore } from "@/store/useAuthStore"

// Sign in with email and password
export const signIn = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    return { user: userCredential.user, error: null }
  } catch (error: any) {
    return { user: null, error: error.message }
  }
}

// Sign up with email and password
export const signUp = async (email: string, password: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    return { user: userCredential.user, error: null }
  } catch (error: any) {
    return { user: null, error: error.message }
  }
}

// Sign in with Google (popup)
export const signInWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({
      prompt: 'select_account'
    })
    const result = await signInWithPopup(auth, provider)
    return { user: result.user, error: null }
  } catch (error: any) {
    // Handle specific errors
    if (error.code === 'auth/popup-closed-by-user') {
      return { user: null, error: 'Sign-in popup was closed' }
    }
    if (error.code === 'auth/popup-blocked') {
      return { user: null, error: 'Sign-in popup was blocked by browser' }
    }
    return { user: null, error: error.message }
  }
}

// Sign in with Google (redirect) - better for mobile
export const signInWithGoogleRedirect = async () => {
  try {
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({
      prompt: 'select_account'
    })
    await signInWithRedirect(auth, provider)
    return { user: null, error: null }
  } catch (error: any) {
    return { user: null, error: error.message }
  }
}

// Check for redirect result (call on app initialization)
export const checkGoogleRedirectResult = async () => {
  try {
    const result = await getRedirectResult(auth)
    if (result) {
      return { user: result.user, error: null }
    }
    return { user: null, error: null }
  } catch (error: any) {
    return { user: null, error: error.message }
  }
}

// Sign out
export const logout = async () => {
  try {
    await signOut(auth)
    return { error: null }
  } catch (error: any) {
    return { error: error.message }
  }
}

// Listen to auth state changes
export const initAuthListener = () => {
  onAuthStateChanged(auth, (user: User | null) => {
    useAuthStore.getState().setUser(user)
    useAuthStore.getState().setIsLoading(false)
  })
}

