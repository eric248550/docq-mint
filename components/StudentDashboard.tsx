'use client';

import { useState } from 'react';
import { useStudentDocuments } from '@/hooks/useSchools';
import { useAuthStore } from '@/store/useAuthStore';
import { DBDocument } from '@/lib/db/types';
import { FileText, Download, Calendar, Loader2, Share2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function StudentDashboard() {
  const { documents, isLoading, error } = useStudentDocuments();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 text-red-500">
        <p>Error loading documents: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2">My Documents</h2>
        <p className="text-muted-foreground">
          View and download your published documents
        </p>
      </div>

      {documents.length === 0 ? (
        <div className="text-center p-12 border rounded-lg">
          <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">No documents yet</h3>
          <p className="text-muted-foreground">
            Your published documents will appear here
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {documents.map((doc) => (
            <DocumentCard key={doc.id} document={doc} />
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentCard({ document }: { document: DBDocument }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { getAuthToken } = useAuthStore();

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
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

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      // Get auth token
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Get presigned URL from backend
      const response = await fetch(`/api/documents/${document.id}/download`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get download URL');
      }

      const { url, fileName } = await response.json();
      
      // Open in new tab
      window.open(url, '_blank');
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download document. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      // Get auth token
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Generate verification link
      const response = await fetch(`/api/documents/${document.id}/share`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate share link');
      }

      const { url } = await response.json();
      setShareUrl(url);
    } catch (error) {
      console.error('Share error:', error);
      alert('Failed to generate share link. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="border rounded-lg p-6 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4 flex-1">
          <div className="p-3 bg-primary/10 rounded-lg">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold mb-1 truncate">
              {document.original_filename || getDocumentTypeLabel(document.document_type)}
            </h3>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {document.original_filename && (
                <span>{getDocumentTypeLabel(document.document_type)}</span>
              )}
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(document.created_at)}</span>
              </div>
              {document.file_size_bytes && (
                <span>{(document.file_size_bytes / 1024).toFixed(0)} KB</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            disabled={isSharing}
          >
            {isSharing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download
              </>
            )}
          </Button>
        </div>
      </div>
      
      {shareUrl && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm font-medium mb-2">Verification Link:</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={shareUrl}
              readOnly
              className="flex-1 px-3 py-2 text-sm border rounded-md bg-muted"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Share this link with third parties to verify your document. They will need to pay $2 to access it.
          </p>
        </div>
      )}
    </div>
  );
}

