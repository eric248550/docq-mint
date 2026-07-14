import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail,
  sendEmailVerification,
  multiFactor,
  TotpMultiFactorGenerator,
  TotpSecret,
  getMultiFactorResolver,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  EmailAuthProvider,
  MultiFactorResolver,
  MultiFactorError,
  MultiFactorInfo
} from "firebase/auth"
import { auth } from "./config"
import { useAuthStore } from "@/store/useAuthStore"

// Turn Firebase auth error codes into friendlier, actionable messages
const friendlyAuthError = (error: any): string => {
  switch (error?.code) {
    case "auth/invalid-verification-code":
    case "auth/invalid-verification-id":
      return "That code isn't right. Check your authenticator app and try again."
    case "auth/totp-challenge-timeout":
      return "The code expired. Enter the current code from your authenticator app."
    case "auth/requires-recent-login":
      return "For security, please sign in again to continue."
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect password."
    default:
      return error?.message || "Something went wrong. Please try again."
  }
}

// Sign in with email and password.
// If the account has 2FA enabled, `mfaResolver` is returned so the caller can
// prompt for a TOTP code and finish sign-in via resolveTotpSignIn().
export const signIn = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    return { user: userCredential.user, error: null, mfaResolver: null as MultiFactorResolver | null }
  } catch (error: any) {
    if (error.code === "auth/multi-factor-auth-required") {
      const resolver = getMultiFactorResolver(auth, error as MultiFactorError)
      return { user: null, error: null, mfaResolver: resolver }
    }
    return { user: null, error: friendlyAuthError(error), mfaResolver: null }
  }
}

// Sign up with email and password
export const signUp = async (email: string, password: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    // Send a verification email immediately after account creation
    await sendEmailVerification(userCredential.user)
    return { user: userCredential.user, error: null }
  } catch (error: any) {
    return { user: null, error: error.message }
  }
}

// Resend the email verification link to the currently signed-in user
export const resendEmailVerification = async () => {
  try {
    if (!auth.currentUser) {
      return { error: "No user is signed in" }
    }
    if (auth.currentUser.emailVerified) {
      return { error: "Email is already verified" }
    }
    await sendEmailVerification(auth.currentUser)
    return { error: null }
  } catch (error: any) {
    return { error: error.message }
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
    return { user: result.user, error: null, mfaResolver: null as MultiFactorResolver | null }
  } catch (error: any) {
    // Account has 2FA enabled — surface the resolver for the code challenge
    if (error.code === "auth/multi-factor-auth-required") {
      const resolver = getMultiFactorResolver(auth, error as MultiFactorError)
      return { user: null, error: null, mfaResolver: resolver }
    }
    // Handle specific errors
    if (error.code === 'auth/popup-closed-by-user') {
      return { user: null, error: 'Sign-in popup was closed', mfaResolver: null }
    }
    if (error.code === 'auth/popup-blocked') {
      return { user: null, error: 'Sign-in popup was blocked by browser', mfaResolver: null }
    }
    return { user: null, error: error.message, mfaResolver: null }
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

// Send password reset email
export const resetPassword = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email)
    return { error: null }
  } catch (error: any) {
    return { error: error.message }
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

// ---------------------------------------------------------------------------
// Two-factor authentication (TOTP)
// Requires the Firebase project to be upgraded to Identity Platform with TOTP
// enabled under Authentication → Sign-in method → Multi-factor authentication.
// ---------------------------------------------------------------------------

// List the second factors currently enrolled on the signed-in account
export const getEnrolledFactors = (): MultiFactorInfo[] => {
  if (!auth.currentUser) return []
  return multiFactor(auth.currentUser).enrolledFactors
}

// Step 1 of enrollment: generate a TOTP secret + otpauth URL for the QR code.
// The returned `secret` must be passed back into finalizeTotpEnrollment().
export const startTotpEnrollment = async () => {
  const user = auth.currentUser
  if (!user) {
    return { secret: null as TotpSecret | null, qrCodeUrl: "", error: "No user is signed in", code: undefined as string | undefined }
  }
  try {
    const session = await multiFactor(user).getSession()
    const secret = await TotpMultiFactorGenerator.generateSecret(session)
    const qrCodeUrl = secret.generateQrCodeUrl(user.email ?? user.uid, "DocQ-Mint")
    return { secret, qrCodeUrl, error: null as string | null, code: undefined as string | undefined }
  } catch (error: any) {
    return { secret: null as TotpSecret | null, qrCodeUrl: "", error: friendlyAuthError(error), code: error?.code }
  }
}

// Step 2 of enrollment: verify the 6-digit code and enroll the factor
export const finalizeTotpEnrollment = async (
  secret: TotpSecret,
  code: string,
  displayName = "Authenticator app"
) => {
  const user = auth.currentUser
  if (!user) return { error: "No user is signed in", code: undefined as string | undefined }
  try {
    const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code)
    await multiFactor(user).enroll(assertion, displayName)
    return { error: null as string | null, code: undefined as string | undefined }
  } catch (error: any) {
    return { error: friendlyAuthError(error), code: error?.code }
  }
}

// Remove an enrolled second factor (disable 2FA)
export const unenrollFactor = async (factorUid: string) => {
  const user = auth.currentUser
  if (!user) return { error: "No user is signed in", code: undefined as string | undefined }
  try {
    await multiFactor(user).unenroll(factorUid)
    return { error: null as string | null, code: undefined as string | undefined }
  } catch (error: any) {
    return { error: friendlyAuthError(error), code: error?.code }
  }
}

// Complete a 2FA sign-in: verify the TOTP code against the pending resolver
export const resolveTotpSignIn = async (resolver: MultiFactorResolver, code: string) => {
  try {
    const hint = resolver.hints.find(
      (h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID
    )
    if (!hint) {
      return { user: null, error: "No authenticator app is enrolled on this account." }
    }
    const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code)
    const cred = await resolver.resolveSignIn(assertion)
    return { user: cred.user, error: null as string | null }
  } catch (error: any) {
    return { user: null, error: friendlyAuthError(error) }
  }
}

// Re-authenticate a password user (needed before enrolling/removing 2FA when
// the last sign-in was too long ago — Firebase throws auth/requires-recent-login)
export const reauthenticateWithPassword = async (password: string) => {
  const user = auth.currentUser
  if (!user || !user.email) return { error: "No user is signed in" }
  try {
    const credential = EmailAuthProvider.credential(user.email, password)
    await reauthenticateWithCredential(user, credential)
    return { error: null as string | null }
  } catch (error: any) {
    return { error: friendlyAuthError(error) }
  }
}

// Re-authenticate a Google user via popup
export const reauthenticateWithGoogle = async () => {
  const user = auth.currentUser
  if (!user) return { error: "No user is signed in" }
  try {
    const provider = new GoogleAuthProvider()
    await reauthenticateWithPopup(user, provider)
    return { error: null as string | null }
  } catch (error: any) {
    return { error: friendlyAuthError(error) }
  }
}

// Which sign-in provider the current user has (used to pick a reauth method)
export const getPrimaryProviderId = (): string | null => {
  const user = auth.currentUser
  if (!user || user.providerData.length === 0) return null
  return user.providerData[0].providerId
}

