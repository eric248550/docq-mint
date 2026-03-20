import { NextRequest } from 'next/server';
import * as admin from 'firebase-admin';

function getAdminApp(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const privateKeyId = process.env.FIREBASE_PRIVATE_KEY_ID;

  if (!projectId || !clientEmail || !privateKey || !privateKeyId) {
    throw new Error('Missing Firebase Admin environment variables');
  }

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
      // @ts-expect-error privateKeyId is valid but not in the type definition
      privateKeyId,
    }),
  });
}

/**
 * Extract Firebase token from Authorization header
 */
export function extractFirebaseToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Verify Firebase ID token using Firebase Admin SDK
 */
export async function verifyFirebaseToken(token: string): Promise<{ uid: string; email?: string } | null> {
  try {
    const app = getAdminApp();
    const decodedToken = await admin.auth(app).verifyIdToken(token);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };
  } catch (error) {
    console.error('Firebase token verification error:', error);
    return null;
  }
}

