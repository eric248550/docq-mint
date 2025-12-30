# Firebase Authentication Guide

## 🎉 Firebase Auth is Fully Configured!

Your Firebase credentials have been added and the authentication system is ready to use.

## Configuration Details

**Project**: docq-mint  
**Auth Domain**: docq-mint.firebaseapp.com  
**Project ID**: docq-mint

## Features Implemented

### 1. **Firebase Configuration** (`lib/firebase/config.ts`)
- Firebase app initialization
- Auth instance export
- Environment variable support with fallback to hardcoded values

### 2. **Auth Helper Functions** (`lib/firebase/auth.ts`)
- `signIn(email, password)` - Sign in existing users
- `signUp(email, password)` - Create new user accounts
- `logout()` - Sign out current user
- `initAuthListener()` - Listen for auth state changes

### 3. **Zustand State Management** (`store/useAuthStore.ts`)
- Global auth state
- User object storage
- Loading state management
- Automatic updates on auth changes

### 4. **Auth Components**
- `AuthExample.tsx` - Complete auth UI with sign in/sign up
- `ProtectedRoute.tsx` - HOC for protecting routes

### 5. **Custom Hook** (`hooks/useAuth.ts`)
- Simplified auth interface
- Easy access to auth state and methods

## Usage Examples

### Basic Sign In/Sign Up

```typescript
import { signIn, signUp } from '@/lib/firebase/auth'

// Sign up a new user
const { user, error } = await signUp('user@example.com', 'password123')

// Sign in existing user
const { user, error } = await signIn('user@example.com', 'password123')
```

### Using the Custom Hook

```typescript
'use client'
import { useAuth } from '@/hooks/useAuth'

export default function MyComponent() {
  const { user, isAuthenticated, isLoading, signIn, logout } = useAuth()
  
  if (isLoading) return <div>Loading...</div>
  
  if (isAuthenticated) {
    return (
      <div>
        <p>Welcome {user?.email}</p>
        <button onClick={logout}>Sign Out</button>
      </div>
    )
  }
  
  return <button onClick={() => signIn('user@example.com', 'pass')}>Sign In</button>
}
```

### Protecting Routes

```typescript
'use client'
import { ProtectedRoute } from '@/components/ProtectedRoute'

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <div>This content is only visible to authenticated users</div>
    </ProtectedRoute>
  )
}
```

### Accessing User State

```typescript
'use client'
import { useAuthStore } from '@/store/useAuthStore'

export default function UserProfile() {
  const { user, isLoading } = useAuthStore()
  
  if (!user) return <div>Please sign in</div>
  
  return (
    <div>
      <p>Email: {user.email}</p>
      <p>UID: {user.uid}</p>
    </div>
  )
}
```

## Pages Included

### 1. **Home Page** (`/`)
- Welcome page with auth form
- Sign in/sign up functionality
- Redirects to dashboard after login

### 2. **Dashboard** (`/dashboard`)
- Protected route (requires authentication)
- Displays user information
- Sign out functionality

## Testing the Auth System

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Open http://localhost:3000**

3. **Create a test account:**
   - Email: `test@example.com`
   - Password: `password123`
   - Click "Sign Up"

4. **You'll see:**
   - Welcome message with your email
   - "Go to Dashboard" button
   - Sign out option

5. **Visit the dashboard:**
   - Click "Go to Dashboard"
   - View your protected user information
   - Try navigating directly to `/dashboard` while signed out (you'll be redirected)

## Firebase Console

Manage your users and auth settings at:
https://console.firebase.google.com/project/docq-mint/authentication/users

## Authentication Flow

```
User Action → Firebase Auth → Auth State Change → Zustand Store → UI Update
```

1. User signs in/up via form
2. Firebase processes authentication
3. `onAuthStateChanged` listener fires
4. Zustand store updates with user data
5. All components using `useAuthStore` re-render
6. Protected routes check auth state

## Security Best Practices

✅ **Implemented:**
- Environment variables for sensitive data
- Client-side auth state management
- Protected routes with automatic redirects
- Password minimum length (6 chars - Firebase default)

🔒 **Recommended for Production:**
- Add password strength requirements
- Implement email verification
- Add password reset functionality
- Enable multi-factor authentication (MFA)
- Add rate limiting for auth attempts
- Use Firebase Security Rules for database access

## Adding More Auth Features

### Email Verification

```typescript
import { sendEmailVerification } from 'firebase/auth'

export const sendVerificationEmail = async () => {
  if (auth.currentUser) {
    await sendEmailVerification(auth.currentUser)
  }
}
```

### Password Reset

```typescript
import { sendPasswordResetEmail } from 'firebase/auth'

export const resetPassword = async (email: string) => {
  await sendPasswordResetEmail(auth, email)
}
```

### Google Sign In

```typescript
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider()
  const result = await signInWithPopup(auth, provider)
  return result.user
}
```

## Troubleshooting

### "Firebase: Error (auth/invalid-email)"
- Check that email format is valid

### "Firebase: Error (auth/weak-password)"
- Password must be at least 6 characters

### "Firebase: Error (auth/email-already-in-use)"
- User already exists, use sign in instead

### "Firebase: Error (auth/user-not-found)"
- No user with that email, use sign up instead

### "Firebase: Error (auth/wrong-password)"
- Incorrect password for the email

## Environment Variables (Optional)

While your credentials are hardcoded with fallbacks, you can override them with environment variables in `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

## Next Steps

1. ✅ Test the authentication flow
2. ✅ Visit the dashboard at `/dashboard`
3. 📝 Add more protected routes as needed
4. 🔐 Enable email verification in Firebase Console
5. 📧 Implement password reset functionality
6. 🎨 Customize the auth UI to match your brand
7. 🚀 Deploy to production

## Resources

- [Firebase Auth Documentation](https://firebase.google.com/docs/auth)
- [Next.js Authentication Patterns](https://nextjs.org/docs/authentication)
- [Zustand Documentation](https://docs.pmnd.rs/zustand/getting-started/introduction)

---

**Status**: ✅ Fully Configured and Ready to Use!

