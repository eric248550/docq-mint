'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Modal, useModal } from '@/components/ui/alert-modal';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAuthStore } from '@/store/useAuthStore';
import {
  FileText,
  Download,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  DollarSign,
  Plus,
  Trash2
} from 'lucide-react';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!);

interface DocumentInfo {
  token: string;
  tokenId: string;
  hasAccess?: boolean;
  document: {
    id: string;
    documentType: string;
    originalFilename: string;
    fileHash: string;
    fileMimeType: string;
    fileSizeBytes: number;
    issuedAt: Date | null;
    createdAt: Date;
  };
}

interface ComparisonResult {
  matches: boolean;
  originalHash: string;
  uploadedHash: string;
  fileName: string;
  fileSize: number;
}

function DashboardCheckoutForm({
  documents,
  verifierEmail,
  verifierId,
  getAuthToken,
  onSuccess,
}: {
  documents: DocumentInfo[];
  verifierEmail: string;
  verifierId?: string;
  getAuthToken: () => Promise<string | null>;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setError(null);

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (confirmError) {
      setError(confirmError.message || 'Payment failed');
      setIsProcessing(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      const authToken = await getAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      // Confirm access for all tokens
      for (const doc of documents) {
        await fetch(`/api/verify/${doc.token}/access`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            paymentIntentId: paymentIntent.id,
            verifierEmail: verifierEmail || undefined,
            verifierId: verifierId || undefined,
          }),
        });
      }
      onSuccess();
    }

    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-md flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}
      <Button type="submit" disabled={!stripe || isProcessing} size="lg" className="w-full">
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <DollarSign className="h-4 w-4 mr-2" />
            Pay ${(documents.length * 2).toFixed(2)}
          </>
        )}
      </Button>
    </form>
  );
}

export default function VerifierDashboardPage() {
  const { user, getAuthToken, selectedVerifierId } = useAuthStore();
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [newTokenInput, setNewTokenInput] = useState('');
  const [isAddingToken, setIsAddingToken] = useState(false);
  const [hasPaid, setHasPaid] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [verifierEmail, setVerifierEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [comparisonResults, setComparisonResults] = useState<Record<string, ComparisonResult>>({});
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});
  const [downloadingDocs, setDownloadingDocs] = useState<Record<string, boolean>>({});
  const { modal, showAlert, closeModal } = useModal();

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('verifier_documents');
    const savedPaid = localStorage.getItem('verifier_paid');
    const savedEmail = localStorage.getItem('verifier_email');

    if (saved) setDocuments(JSON.parse(saved));
    if (savedPaid === 'true') setHasPaid(true);
    if (savedEmail) setVerifierEmail(savedEmail);
  }, []);

  // Pre-fill email from logged-in user
  useEffect(() => {
    if (user?.email) setVerifierEmail(user.email);
  }, [user?.email]);

  // Save to localStorage
  useEffect(() => {
    if (documents.length > 0) {
      localStorage.setItem('verifier_documents', JSON.stringify(documents));
    }
  }, [documents]);

  const extractToken = (input: string): string => {
    const trimmed = input.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      try {
        const url = new URL(trimmed);
        const tokenParam = url.searchParams.get('token');
        return tokenParam || trimmed;
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  };

  const handleAddToken = async () => {
    if (!newTokenInput.trim()) {
      setError('Please enter verification links');
      return;
    }

    setIsAddingToken(true);
    setError(null);

    try {
      const lines = newTokenInput
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);

      if (lines.length === 0) {
        setError('Please enter at least one verification link');
        return;
      }

      const newDocs: DocumentInfo[] = [];
      const errors: string[] = [];
      const existingTokens = new Set(documents.map(d => d.token));

      for (const line of lines) {
        const token = extractToken(line);

        if (existingTokens.has(token) || newDocs.some(d => d.token === token)) {
          errors.push(`Skipped duplicate: ${line.substring(0, 30)}...`);
          continue;
        }

        try {
          const authToken = await getAuthToken();
          const fetchHeaders: Record<string, string> = {};
          if (authToken) fetchHeaders['Authorization'] = `Bearer ${authToken}`;
          const qs = selectedVerifierId ? `?verifierId=${selectedVerifierId}` : '';
          const response = await fetch(`/api/verify/${token}${qs}`, { headers: fetchHeaders });
          if (!response.ok) {
            const err = await response.json();
            errors.push(`Failed: ${line.substring(0, 30)}... - ${err.error}`);
            continue;
          }
          const data = await response.json();
          newDocs.push({ token, ...data });
        } catch (err: any) {
          errors.push(`Error: ${line.substring(0, 30)}... - ${err.message}`);
        }
      }

      if (newDocs.length > 0) {
        setDocuments(prev => {
          const merged = [...prev, ...newDocs];
          // If every doc already has access, skip payment
          if (merged.length > 0 && merged.every(d => d.hasAccess)) {
            setHasPaid(true);
          }
          return merged;
        });
        setNewTokenInput('');
      }

      if (errors.length > 0) {
        setError(`Added ${newDocs.length} document(s). ${errors.length} failed:\n${errors.join('\n')}`);
      } else if (newDocs.length === 0) {
        setError('No valid documents were added');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify tokens');
    } finally {
      setIsAddingToken(false);
    }
  };

  const handleRemoveDocument = (token: string) => {
    setDocuments(prev => prev.filter(doc => doc.token !== token));
    if (documents.length === 1) {
      localStorage.removeItem('verifier_documents');
    }
  };

  const handleInitiatePayment = async () => {
    if (documents.length === 0) {
      setError('Please add at least one document first');
      return;
    }
    if (unpaidDocs.length === 0) {
      setHasPaid(true);
      return;
    }
    setError(null);

    try {
      const authToken = await getAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const res = await fetch('/api/stripe/create-intent', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amount: unpaidDocs.length * 200,
          tokenIds: unpaidDocs.map(d => d.tokenId),
          verifierEmail: verifierEmail.trim() || undefined,
          verifierId: selectedVerifierId || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to initiate payment');
      }
      const { clientSecret: secret } = await res.json();
      setClientSecret(secret);
      if (verifierEmail.trim()) {
        localStorage.setItem('verifier_email', verifierEmail.trim());
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initiate payment');
    }
  };

  const handleDownload = async (token: string) => {
    if (!hasPaid) return;
    setDownloadingDocs(prev => ({ ...prev, [token]: true }));
    try {
      const response = await fetch(`/api/verify/${token}/download`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to get download URL');
      }
      const { url } = await response.json();
      window.open(url, '_blank');
    } catch (err: any) {
      await showAlert(err.message || 'Failed to download document');
    } finally {
      setDownloadingDocs(prev => ({ ...prev, [token]: false }));
    }
  };

  const handleFileSelect = async (token: string, file: File) => {
    if (!hasPaid) return;
    setUploadingFiles(prev => ({ ...prev, [token]: true }));
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`/api/verify/${token}/compare`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Comparison failed');
      }
      const result = await response.json();
      setComparisonResults(prev => ({ ...prev, [token]: result }));
    } catch (err: any) {
      setError(err.message || 'Failed to compare files');
    } finally {
      setUploadingFiles(prev => ({ ...prev, [token]: false }));
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      report_card: 'Report Card',
      transcript: 'Transcript',
      certificate: 'Certificate',
      diploma: 'Diploma',
      others: 'Document',
    };
    return labels[type] || type;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const unpaidDocs = documents.filter(d => !d.hasAccess);
  const totalCost = unpaidDocs.length * 2;

  return (
    <div className="min-h-screen bg-background p-8">
      <Modal
        isOpen={modal.isOpen}
        message={modal.message}
        type={modal.type}
        onConfirm={() => closeModal(true)}
        onCancel={() => closeModal(false)}
      />
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Verification Dashboard</h1>
          <p className="text-muted-foreground">
            Add multiple verification links, pay once, and verify all your documents
          </p>
          {!user && (
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md text-sm">
              <p className="text-yellow-900 dark:text-yellow-100">
                Verifying anonymously — sign in to save records to your account.{' '}
                <a href="/" className="underline font-medium">Sign in</a>
              </p>
            </div>
          )}
        </div>

        {/* Add Document Section */}
        <div className="bg-card border rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Add Verification Links</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Paste one or more verification links, each on a new line
          </p>
          <div className="space-y-2">
            <textarea
              value={newTokenInput}
              onChange={(e) => setNewTokenInput(e.target.value)}
              placeholder={'Paste verification links here (one per line)\nhttp://localhost:3000/verify?token=abc123\n...'}
              className="w-full px-4 py-3 border rounded-md min-h-[120px] font-mono text-sm resize-y"
              disabled={isAddingToken || hasPaid}
            />
            <Button
              onClick={handleAddToken}
              disabled={isAddingToken || !newTokenInput.trim() || hasPaid}
              className="w-full"
            >
              {isAddingToken ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding Documents...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Document(s)
                </>
              )}
            </Button>
          </div>
          {error && !hasPaid && (
            <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <pre className="text-sm whitespace-pre-wrap break-words">{error}</pre>
              </div>
            </div>
          )}
        </div>

        {/* Documents List */}
        {documents.length > 0 && (
          <div className="bg-card border rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Documents ({documents.length})</h2>
              {!hasPaid && (
                <span className="text-sm text-muted-foreground">Total: ${totalCost.toFixed(2)}</span>
              )}
            </div>

            <div className="space-y-3">
              {documents.map((doc) => (
                <div key={doc.token} className="p-4 border rounded-lg">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">
                        {doc.document.originalFilename ||
                         getDocumentTypeLabel(doc.document.documentType)}
                      </h3>
                      <div className="text-sm text-muted-foreground">
                        {getDocumentTypeLabel(doc.document.documentType)} •{' '}
                        {(doc.document.fileSizeBytes / 1024).toFixed(0)} KB
                      </div>
                    </div>
                    {!hasPaid && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveDocument(doc.token)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    {hasPaid && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpandedDocId(
                          expandedDocId === doc.document.id ? null : doc.document.id
                        )}
                      >
                        {expandedDocId === doc.document.id ? 'Hide' : 'View Details'}
                      </Button>
                    )}
                  </div>

                  {/* Expanded Details */}
                  {hasPaid && expandedDocId === doc.document.id && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      <div className="bg-muted p-4 rounded-lg text-sm space-y-2">
                        <p><strong>Type:</strong> {getDocumentTypeLabel(doc.document.documentType)}</p>
                        <p><strong>File Type:</strong> {doc.document.fileMimeType}</p>
                        <p><strong>Size:</strong> {(doc.document.fileSizeBytes / 1024).toFixed(0)} KB</p>
                        <p><strong>Created:</strong> {formatDate(doc.document.createdAt)}</p>
                        <p className="break-all">
                          <strong>Hash:</strong>{' '}
                          <code className="text-xs bg-background px-1 py-0.5 rounded">
                            {doc.document.fileHash}
                          </code>
                        </p>
                      </div>

                      <Button
                        onClick={() => handleDownload(doc.token)}
                        disabled={downloadingDocs[doc.token]}
                        className="w-full"
                      >
                        {downloadingDocs[doc.token] ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <Download className="h-4 w-4 mr-2" />
                            View Original Document
                          </>
                        )}
                      </Button>

                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Upload File to Compare Hash
                        </label>
                        <input
                          type="file"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileSelect(doc.token, file);
                          }}
                          disabled={uploadingFiles[doc.token]}
                          className="block w-full text-sm text-muted-foreground
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-md file:border-0
                            file:text-sm file:font-semibold
                            file:bg-primary file:text-primary-foreground
                            hover:file:bg-primary/90
                            cursor-pointer disabled:opacity-50"
                        />
                      </div>

                      {uploadingFiles[doc.token] && (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="h-6 w-6 animate-spin" />
                          <span className="ml-2">Comparing hash...</span>
                        </div>
                      )}

                      {comparisonResults[doc.token] && (
                        <div className={`p-4 rounded-lg border ${
                          comparisonResults[doc.token].matches
                            ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                            : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                        }`}>
                          <div className="flex items-start gap-3">
                            {comparisonResults[doc.token].matches ? (
                              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <h4 className={`font-semibold mb-2 ${
                                comparisonResults[doc.token].matches
                                  ? 'text-green-900 dark:text-green-100'
                                  : 'text-red-900 dark:text-red-100'
                              }`}>
                                {comparisonResults[doc.token].matches
                                  ? '✓ Hash Match - Document is Authentic'
                                  : '✗ Hash Mismatch - Document May Be Modified'}
                              </h4>
                              <div className="text-sm space-y-1">
                                <p className="break-all">
                                  <strong>Original:</strong>{' '}
                                  <code className="text-xs bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded">
                                    {comparisonResults[doc.token].originalHash}
                                  </code>
                                </p>
                                <p className="break-all">
                                  <strong>Uploaded:</strong>{' '}
                                  <code className="text-xs bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded">
                                    {comparisonResults[doc.token].uploadedHash}
                                  </code>
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payment Section */}
        {unpaidDocs.length > 0 && !hasPaid && (
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Complete Payment</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Email Address (optional, for receipt)
                </label>
                <input
                  type="email"
                  value={verifierEmail}
                  onChange={(e) => setVerifierEmail(e.target.value)}
                  placeholder="your@email.com (optional)"
                  className="w-full px-4 py-2 border rounded-md"
                  disabled={!!clientSecret}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-5 w-5 text-primary" />
                    <span className="text-lg font-semibold">Total: ${totalCost.toFixed(2)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    $2.00 × {unpaidDocs.length} document{unpaidDocs.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {!clientSecret ? (
                <Button onClick={handleInitiatePayment} size="lg" className="w-full">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Continue to Payment
                </Button>
              ) : (
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <DashboardCheckoutForm
                    documents={unpaidDocs}
                    verifierEmail={verifierEmail}
                    verifierId={selectedVerifierId || undefined}
                    getAuthToken={getAuthToken}
                    onSuccess={() => {
                      setHasPaid(true);
                      localStorage.setItem('verifier_paid', 'true');
                    }}
                  />
                </Elements>
              )}

              {error && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-md flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Success Message */}
        {hasPaid && (
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            <span className="text-green-900 dark:text-green-100 font-medium">
              Payment successful! Click &ldquo;View Details&rdquo; on any document to view and verify it.
            </span>
          </div>
        )}

        {/* Empty State */}
        {documents.length === 0 && (
          <div className="text-center p-12 border rounded-lg">
            <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No documents added yet</h3>
            <p className="text-muted-foreground">
              Paste verification links above to add documents to your dashboard
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
