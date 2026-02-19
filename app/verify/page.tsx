'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Modal, useModal } from '@/components/ui/alert-modal';
import { 
  FileText, 
  Download, 
  Upload, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  AlertCircle,
  DollarSign
} from 'lucide-react';

interface DocumentInfo {
  tokenId: string;
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

function VerifyPageContent() {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get('token');

  const [token, setToken] = useState(tokenFromUrl || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [documentInfo, setDocumentInfo] = useState<DocumentInfo | null>(null);
  const [hasPaid, setHasPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifierEmail, setVerifierEmail] = useState('');
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [hasAutoLoaded, setHasAutoLoaded] = useState(false);
  const { modal, showAlert, closeModal } = useModal();

  // Auto-load if token is in URL
  useEffect(() => {
    if (tokenFromUrl && !documentInfo && !hasAutoLoaded) {
      setHasAutoLoaded(true);
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenFromUrl, documentInfo, hasAutoLoaded]);

  const extractToken = (input: string): string => {
    const trimmed = input.trim();
    
    // Check if it's a full URL
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

  const handleVerify = async () => {
    if (!token.trim()) {
      setError('Please enter a verification token');
      return;
    }

    setIsLoading(true);
    setError(null);
    setDocumentInfo(null);
    setHasPaid(false);

    try {
      const extractedToken = extractToken(token);
      const response = await fetch(`/api/verify/${extractedToken}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to verify token');
      }

      const data = await response.json();
      setDocumentInfo(data);
      setToken(extractedToken); // Update token state with extracted value
    } catch (error: any) {
      console.error('Verification error:', error);
      setError(error.message || 'Failed to verify token');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!documentInfo) return;

    setIsPaying(true);
    setError(null);

    try {
      const response = await fetch(`/api/verify/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ verifierEmail: verifierEmail.trim() || 'anonymous@example.com' }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Payment failed');
      }

      setHasPaid(true);
    } catch (error: any) {
      console.error('Payment error:', error);
      setError(error.message || 'Payment failed');
    } finally {
      setIsPaying(false);
    }
  };

  const handleDownload = async () => {
    if (!hasPaid || !documentInfo) return;

    setIsDownloading(true);
    try {
      const response = await fetch(`/api/verify/${token}/download`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get download URL');
      }

      const { url } = await response.json();
      window.open(url, '_blank');
    } catch (error: any) {
      console.error('Download error:', error);
      await showAlert(error.message || 'Failed to download document');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setComparisonResult(null);
    }
  };

  const handleCompare = async () => {
    if (!selectedFile || !hasPaid || !documentInfo) return;

    setIsComparing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(`/api/verify/${token}/compare`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Comparison failed');
      }

      const result = await response.json();
      setComparisonResult(result);
    } catch (error: any) {
      console.error('Comparison error:', error);
      setError(error.message || 'Failed to compare files');
    } finally {
      setIsComparing(false);
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

  return (
    <div className="min-h-screen bg-background p-8">
      <Modal
        isOpen={modal.isOpen}
        message={modal.message}
        type={modal.type}
        onConfirm={() => closeModal(true)}
        onCancel={() => closeModal(false)}
      />
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Document Verification</h1>
              <p className="text-muted-foreground">
                Verify the authenticity of documents and compare file hashes
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => window.location.href = '/verify/dashboard'}
            >
              Verify Multiple Documents
            </Button>
          </div>
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md text-sm">
            <p className="text-blue-900 dark:text-blue-100">
              💡 <strong>Tip:</strong> Need to verify multiple documents? Use our{' '}
              <a href="/verify/dashboard" className="underline font-medium">
                Dashboard
              </a>{' '}
              to add multiple links and pay once for all.
            </p>
          </div>
        </div>

        {/* Token Input */}
        <div className="bg-card border rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Step 1: Enter Verification Link</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste verification token or full URL"
              className="flex-1 px-4 py-2 border rounded-md"
              disabled={isLoading || hasPaid}
            />
            <Button
              onClick={handleVerify}
              disabled={isLoading || !token.trim() || hasPaid}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify'
              )}
            </Button>
          </div>
          {error && !documentInfo && (
            <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Document Info & Payment */}
        {documentInfo && !hasPaid && (
          <div className="bg-card border rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Step 2: Payment Required</h2>
            
            <div className="mb-6 p-4 bg-muted rounded-lg">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-1">
                    {documentInfo.document.originalFilename || 
                     getDocumentTypeLabel(documentInfo.document.documentType)}
                  </h3>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Type: {getDocumentTypeLabel(documentInfo.document.documentType)}</p>
                    <p>Size: {(documentInfo.document.fileSizeBytes / 1024).toFixed(0)} KB</p>
                    <p>Created: {formatDate(documentInfo.document.createdAt)}</p>
                  </div>
                </div>
              </div>
            </div>

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
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <span className="text-lg font-semibold">Payment Amount: $2.00</span>
                </div>
                <Button
                  onClick={handlePayment}
                  disabled={isPaying}
                  size="lg"
                >
                  {isPaying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <DollarSign className="h-4 w-4 mr-2" />
                      Pay $2 (Mock)
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                This is a mock payment. Click the button to instantly gain access to the document.
              </p>
            </div>
          </div>
        )}

        {/* Document Access & Comparison */}
        {documentInfo && hasPaid && (
          <div className="space-y-6">
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="text-green-900 dark:text-green-100 font-medium">
                Payment successful! You now have access to this document.
              </span>
            </div>

            {/* Document Details */}
            <div className="bg-card border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Document Details</h2>
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2">
                        {documentInfo.document.originalFilename || 
                         getDocumentTypeLabel(documentInfo.document.documentType)}
                      </h3>
                      <div className="text-sm space-y-1">
                        <p><strong>Type:</strong> {getDocumentTypeLabel(documentInfo.document.documentType)}</p>
                        <p><strong>File Type:</strong> {documentInfo.document.fileMimeType}</p>
                        <p><strong>Size:</strong> {(documentInfo.document.fileSizeBytes / 1024).toFixed(0)} KB</p>
                        <p><strong>Created:</strong> {formatDate(documentInfo.document.createdAt)}</p>
                        <p className="break-all"><strong>Hash (SHA-256):</strong> <code className="text-xs bg-muted px-1 py-0.5 rounded">{documentInfo.document.fileHash}</code></p>
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="w-full"
                  size="lg"
                >
                  {isDownloading ? (
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
              </div>
            </div>

            {/* Hash Comparison */}
            <div className="bg-card border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Compare File Hash</h2>
              <p className="text-muted-foreground mb-4">
                Upload a file to compare its hash with the original document. This verifies document authenticity.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Upload File to Compare
                  </label>
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    className="block w-full text-sm text-muted-foreground
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-md file:border-0
                      file:text-sm file:font-semibold
                      file:bg-primary file:text-primary-foreground
                      hover:file:bg-primary/90
                      cursor-pointer"
                  />
                </div>

                {selectedFile && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                    <FileText className="h-4 w-4" />
                    <span className="text-sm">{selectedFile.name}</span>
                    <span className="text-sm text-muted-foreground">
                      ({(selectedFile.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                )}

                <Button
                  onClick={handleCompare}
                  disabled={!selectedFile || isComparing}
                  className="w-full"
                >
                  {isComparing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Comparing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Compare Hash
                    </>
                  )}
                </Button>

                {comparisonResult && (
                  <div className={`p-4 rounded-lg border ${
                    comparisonResult.matches 
                      ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' 
                      : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                  }`}>
                    <div className="flex items-start gap-3">
                      {comparisonResult.matches ? (
                        <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <h3 className={`font-semibold mb-2 ${
                          comparisonResult.matches 
                            ? 'text-green-900 dark:text-green-100' 
                            : 'text-red-900 dark:text-red-100'
                        }`}>
                          {comparisonResult.matches 
                            ? '✓ Hash Match - Document is Authentic' 
                            : '✗ Hash Mismatch - Document May Be Modified'}
                        </h3>
                        <div className="text-sm space-y-1">
                          <p className="break-all">
                            <strong>Original Hash:</strong> <code className="text-xs bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded">{comparisonResult.originalHash}</code>
                          </p>
                          <p className="break-all">
                            <strong>Uploaded Hash:</strong> <code className="text-xs bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded">{comparisonResult.uploadedHash}</code>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {error && comparisonResult === null && (
                  <div className="p-3 bg-destructive/10 text-destructive rounded-md flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background p-8 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading verification page...</p>
        </div>
      </div>
    }>
      <VerifyPageContent />
    </Suspense>
  );
}
