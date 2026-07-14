'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { TotpSecret } from 'firebase/auth';
import {
  getEnrolledFactors,
  startTotpEnrollment,
  finalizeTotpEnrollment,
  unenrollFactor,
  reauthenticateWithPassword,
  reauthenticateWithGoogle,
  getPrimaryProviderId,
} from '@/lib/firebase/auth';
import { Button } from '@/components/ui/button';
import { ShieldCheck, ShieldOff, Loader2, Copy, Check } from 'lucide-react';

type EnrolledFactor = { uid: string; displayName?: string | null };

// A step in the enrollment wizard: idle → reauth (if needed) → showing QR → done
type Stage = 'idle' | 'reauth' | 'qr';

export function TwoFactorSettings() {
  const [factors, setFactors] = useState<EnrolledFactor[]>([]);
  const [stage, setStage] = useState<Stage>('idle');
  const [secret, setSecret] = useState<TotpSecret | null>(null);
  const [qrUrl, setQrUrl] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // After reauth, remember what the user was trying to do (enroll or remove-this-uid)
  const [pendingUnenrollUid, setPendingUnenrollUid] = useState<string | null>(null);

  const providerId = getPrimaryProviderId();
  const isPasswordUser = providerId === 'password';

  const refreshFactors = () => {
    setFactors(
      getEnrolledFactors().map((f) => ({ uid: f.uid, displayName: f.displayName }))
    );
  };

  useEffect(() => {
    refreshFactors();
  }, []);

  const resetFlow = () => {
    setStage('idle');
    setSecret(null);
    setQrUrl('');
    setCode('');
    setPassword('');
    setError(null);
    setPendingUnenrollUid(null);
  };

  // Kick off enrollment; may need re-auth first
  const beginEnroll = async () => {
    setLoading(true);
    setError(null);
    const res = await startTotpEnrollment();
    if (res.error) {
      if (res.code === 'auth/requires-recent-login') {
        setStage('reauth');
      } else {
        setError(res.error);
      }
      setLoading(false);
      return;
    }
    setSecret(res.secret);
    setQrUrl(res.qrCodeUrl);
    setStage('qr');
    setLoading(false);
  };

  // Verify the 6-digit code and finish enrollment
  const confirmEnroll = async () => {
    if (!secret) return;
    setLoading(true);
    setError(null);
    const res = await finalizeTotpEnrollment(secret, code.trim());
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }
    refreshFactors();
    resetFlow();
    setLoading(false);
  };

  const beginUnenroll = async (uid: string) => {
    setLoading(true);
    setError(null);
    const res = await unenrollFactor(uid);
    if (res.error) {
      if (res.code === 'auth/requires-recent-login') {
        setPendingUnenrollUid(uid);
        setStage('reauth');
      } else {
        setError(res.error);
      }
      setLoading(false);
      return;
    }
    refreshFactors();
    resetFlow();
    setLoading(false);
  };

  // Re-authenticate, then resume whatever action was pending
  const doReauth = async () => {
    setLoading(true);
    setError(null);
    const res = isPasswordUser
      ? await reauthenticateWithPassword(password)
      : await reauthenticateWithGoogle();
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setPassword('');
    setLoading(false);
    // Resume the original intent
    if (pendingUnenrollUid) {
      const uid = pendingUnenrollUid;
      setPendingUnenrollUid(null);
      await beginUnenroll(uid);
    } else {
      await beginEnroll();
    }
  };

  const copySecret = async () => {
    if (!secret) return;
    await navigator.clipboard.writeText(secret.secretKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isEnabled = factors.length > 0;

  return (
    <div className="max-w-lg mt-10 pt-8 border-t">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Two-Factor Authentication</h2>
          <p className="text-sm text-muted-foreground">
            Add a one-time code from an authenticator app to your sign-in
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 mb-4 bg-destructive/10 text-destructive rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Status + enrolled factors */}
      {isEnabled && stage === 'idle' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-green-600">
            <ShieldCheck className="h-4 w-4" />
            Two-factor authentication is <strong>on</strong>.
          </div>
          {factors.map((f) => (
            <div
              key={f.uid}
              className="flex items-center justify-between p-3 border rounded-md"
            >
              <span className="text-sm">{f.displayName || 'Authenticator app'}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => beginUnenroll(f.uid)}
              >
                <ShieldOff className="h-4 w-4 mr-2" />
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      {!isEnabled && stage === 'idle' && (
        <Button onClick={beginEnroll} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4 mr-2" />
          )}
          Enable two-factor authentication
        </Button>
      )}

      {/* Re-auth step */}
      {stage === 'reauth' && (
        <div className="space-y-4 p-4 border rounded-md">
          <p className="text-sm text-muted-foreground">
            For your security, please confirm your identity to continue.
          </p>
          {isPasswordUser ? (
            <>
              <input
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex gap-2">
                <Button onClick={doReauth} disabled={loading || !password}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Confirm
                </Button>
                <Button variant="ghost" onClick={resetFlow} disabled={loading}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <div className="flex gap-2">
              <Button onClick={doReauth} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm with Google
              </Button>
              <Button variant="ghost" onClick={resetFlow} disabled={loading}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      {/* QR + code entry */}
      {stage === 'qr' && (
        <div className="space-y-4 p-4 border rounded-md">
          <p className="text-sm text-muted-foreground">
            1. Scan this QR code with an authenticator app (Google Authenticator,
            Authy, 1Password, etc.).
          </p>
          {qrUrl && (
            <div className="flex justify-center bg-white p-4 rounded-md w-fit mx-auto">
              <QRCodeSVG value={qrUrl} size={180} />
            </div>
          )}

          {secret && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">
                Or enter this key manually:
              </p>
              <button
                type="button"
                onClick={copySecret}
                className="inline-flex items-center gap-2 font-mono text-sm bg-muted px-3 py-1.5 rounded-md hover:bg-muted/70"
              >
                {secret.secretKey}
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            2. Enter the 6-digit code from the app to finish:
          </p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full px-3 py-2 border rounded-md bg-background text-center text-lg tracking-[0.3em] font-mono focus:outline-none focus:ring-2 focus:ring-primary"
          />

          <div className="flex gap-2">
            <Button onClick={confirmEnroll} disabled={loading || code.length !== 6}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Verify &amp; enable
            </Button>
            <Button variant="ghost" onClick={resetFlow} disabled={loading}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
