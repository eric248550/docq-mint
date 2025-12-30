# Google Authentication Setup Guide

## ✅ Google Sign-In Implementation Complete!

Google authentication has been added to your Firebase project. Follow these steps to enable it in your Firebase Console.

## 🚀 Quick Setup (3 Steps)

### Step 1: Enable Google Sign-In in Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/project/docq-mint/authentication/providers)
2. Click on **Authentication** in the left sidebar
3. Click on **Sign-in method** tab
4. Find **Google** in the list of providers
5. Click on **Google**
6. Toggle the **Enable** switch to ON
7. Set the **Project support email** (use your email)
8. Click **Save**

### Step 2: Test Google Sign-In

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Visit http://localhost:3000

3. Click the **"Continue with Google"** button

4. Select your Google account

5. You'll be automatically signed in!

### Step 3: Add Authorized Domains (For Production)

When deploying to production, add your domain:

1. Go to [Firebase Console Authentication Settings](https://console.firebase.google.com/project/docq-mint/authentication/settings)
2. Scroll to **Authorized domains**
3. Click **Add domain**
4. Enter your production domain (e.g., `yourdomain.com`)
5. Click **Add**

## 📋 What's Been Implemented

### New Auth Functions (`lib/firebase/auth.ts`)

#### 1. **signInWithGoogle()** - Popup Method (Default)
```typescript
import { signInWithGoogle } from '@/lib/firebase/auth'

const { user, error } = await signInWithGoogle()
if (user) {
  console.log('Signed in:', user.email)
}
```

**Features:**
- Opens popup window
- Best for desktop
- Instant feedback
- No page reload

#### 2. **signInWithGoogleRedirect()** - Redirect Method (Mobile)
```typescript
import { signInWithGoogleRedirect, checkGoogleRedirectResult } from '@/lib/firebase/auth'

// Initiate sign-in (redirects user to Google)
await signInWithGoogleRedirect()

// After redirect back, check result
const { user, error } = await checkGoogleRedirectResult()
```

**Features:**
- Full page redirect
- Better for mobile devices
- Works when popups are blocked
- Requires checking result after redirect

### Updated Components

#### **AuthExample Component**
- ✅ "Continue with Google" button with Google logo
- ✅ Beautiful divider ("Or continue with email")
- ✅ Handles Google sign-in errors gracefully
- ✅ Loading states during authentication

#### **useAuth Hook**
- ✅ Includes `signInWithGoogle()` method
- ✅ Includes `signInWithGoogleRedirect()` method
- ✅ Easy to use in any component

## 🎨 UI Updates

The auth form now includes:

```
┌─────────────────────────────────┐
│  Continue with Google [G Logo]  │  ← New Google Button
├─────────────────────────────────┤
│   Or continue with email        │  ← Divider
├─────────────────────────────────┤
│  Email Input                    │
│  Password Input                 │
│  [Sign In] [Sign Up]           │
└─────────────────────────────────┘
```

## 💡 Usage Examples

### Basic Usage in Any Component

```typescript
'use client'
import { signInWithGoogle } from '@/lib/firebase/auth'

export default function MyComponent() {
  const handleGoogleSignIn = async () => {
    const { user, error } = await signInWithGoogle()
    
    if (error) {
      alert(error)
    } else {
      console.log('Welcome!', user?.displayName)
    }
  }

  return (
    <button onClick={handleGoogleSignIn}>
      Sign in with Google
    </button>
  )
}
```

### Using the Custom Hook

```typescript
'use client'
import { useAuth } from '@/hooks/useAuth'

export default function MyComponent() {
  const { signInWithGoogle, user } = useAuth()

  if (user) {
    return <p>Welcome {user.displayName}!</p>
  }

  return (
    <button onClick={signInWithGoogle}>
      Sign in with Google
    </button>
  )
}
```

### Mobile-Friendly Redirect Method

```typescript
'use client'
import { useEffect } from 'react'
import { signInWithGoogleRedirect, checkGoogleRedirectResult } from '@/lib/firebase/auth'

export default function LoginPage() {
  // Check for redirect result on mount
  useEffect(() => {
    checkGoogleRedirectResult().then(({ user, error }) => {
      if (user) {
        console.log('Signed in after redirect:', user.email)
      }
      if (error) {
        console.error('Redirect error:', error)
      }
    })
  }, [])

  const handleGoogleSignIn = async () => {
    // This will redirect to Google
    await signInWithGoogleRedirect()
  }

  return (
    <button onClick={handleGoogleSignIn}>
      Sign in with Google (Redirect)
    </button>
  )
}
```

## 🔒 User Information Available

When signed in with Google, you get access to:

```typescript
const user = useAuthStore().user

// Available user properties:
user.uid              // Unique user ID
user.email            // Email address
user.displayName      // Full name (e.g., "John Doe")
user.photoURL         // Profile picture URL
user.emailVerified    // true (Google emails are verified)
user.providerData     // Array of linked providers
```

### Display User Profile Picture

```typescript
'use client'
import { useAuthStore } from '@/store/useAuthStore'
import Image from 'next/image'

export default function UserProfile() {
  const { user } = useAuthStore()

  if (!user) return null

  return (
    <div className="flex items-center gap-2">
      {user.photoURL && (
        <Image
          src={user.photoURL}
          alt={user.displayName || 'User'}
          width={40}
          height={40}
          className="rounded-full"
        />
      )}
      <div>
        <p className="font-medium">{user.displayName}</p>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>
    </div>
  )
}
```

## 🐛 Error Handling

Common errors and solutions:

### "Sign-in popup was closed"
**Cause:** User closed the popup before completing sign-in  
**Solution:** User can try again

### "Sign-in popup was blocked by browser"
**Cause:** Browser blocked the popup window  
**Solution:** Use redirect method instead:
```typescript
await signInWithGoogleRedirect()
```

### "auth/popup-blocked"
**Cause:** Browser settings blocking popups  
**Solution:** 
1. Allow popups for localhost/your domain
2. Or use `signInWithGoogleRedirect()` instead

### "auth/unauthorized-domain"
**Cause:** Domain not authorized in Firebase  
**Solution:** Add domain in Firebase Console → Authentication → Settings → Authorized domains

## 🧪 Testing Google Sign-In

### Local Development (http://localhost:3000)
✅ Already authorized by default

### Custom Local Domain (e.g., http://myapp.local)
1. Go to Firebase Console → Authentication → Settings
2. Add `myapp.local` to Authorized domains

### Production (https://yourdomain.com)
1. Add `yourdomain.com` to Authorized domains
2. Ensure HTTPS is enabled (required for Google OAuth)

## 🌐 Production Deployment

### Vercel / Netlify
1. Deploy your app
2. Get your production URL
3. Add URL to Firebase Authorized domains
4. Google Sign-In will work automatically

### Custom Domain
1. Configure your domain in hosting provider
2. Add domain to Firebase Authorized domains
3. Ensure SSL/HTTPS is enabled
4. Test Google Sign-In on production

## 📊 Firebase Console - View Google Users

After users sign in with Google:

1. Go to [Firebase Console Users](https://console.firebase.google.com/project/docq-mint/authentication/users)
2. You'll see users listed with their:
   - Email
   - Display Name
   - Provider: "google.com"
   - Photo URL
   - Sign-in date

## 🎯 Next Steps

### Additional Features You Can Add:

#### 1. **Link Multiple Providers**
Allow users to link Google with email/password:
```typescript
import { linkWithPopup, GoogleAuthProvider } from 'firebase/auth'

const linkGoogle = async () => {
  const provider = new GoogleAuthProvider()
  await linkWithPopup(auth.currentUser!, provider)
}
```

#### 2. **Unlink Providers**
```typescript
import { unlink } from 'firebase/auth'

const unlinkGoogle = async () => {
  await unlink(auth.currentUser!, 'google.com')
}
```

#### 3. **Request Additional Scopes**
Get access to Google Calendar, Drive, etc:
```typescript
const provider = new GoogleAuthProvider()
provider.addScope('https://www.googleapis.com/auth/calendar')
provider.addScope('https://www.googleapis.com/auth/drive.file')
```

#### 4. **Get Google Access Token**
```typescript
import { GoogleAuthProvider } from 'firebase/auth'

const result = await signInWithPopup(auth, provider)
const credential = GoogleAuthProvider.credentialFromResult(result)
const accessToken = credential?.accessToken
// Use accessToken to call Google APIs
```

## 📚 Resources

- [Firebase Google Sign-In Docs](https://firebase.google.com/docs/auth/web/google-signin)
- [Google Identity Services](https://developers.google.com/identity)
- [OAuth 2.0 Scopes](https://developers.google.com/identity/protocols/oauth2/scopes)

## ✅ Checklist

Before going to production:

- [ ] Enable Google provider in Firebase Console
- [ ] Set project support email
- [ ] Add production domain to authorized domains
- [ ] Test Google Sign-In on localhost
- [ ] Test on mobile devices
- [ ] Test popup blocked scenario
- [ ] Test redirect method as fallback
- [ ] Verify user data is saved correctly
- [ ] Check error handling works
- [ ] Ensure HTTPS on production

---

## 🎉 Status

✅ **Google Authentication Code**: Implemented  
⏳ **Firebase Console Setup**: Pending (follow Step 1 above)  
✅ **UI Updated**: Google button added  
✅ **Error Handling**: Complete  
✅ **Documentation**: Complete

**Start Testing:** Follow Step 1 to enable Google Sign-In in Firebase Console, then test at http://localhost:3000

