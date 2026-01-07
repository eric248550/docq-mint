'use client';

import { useState } from 'react';
import { useStudentDocuments } from '@/hooks/useSchools';
import { useAuthStore } from '@/store/useAuthStore';
import { DBDocument } from '@/lib/db/types';
import { FileText, Download, Calendar, Loader2 } from 'lucide-react';
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
          View and download your academic documents
        </p>
      </div>

      {documents.length === 0 ? (
        <div className="text-center p-12 border rounded-lg">
          <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">No documents yet</h3>
          <p className="text-muted-foreground">
            Your school will upload your academic documents here
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

  return (
    <div className="border rounded-lg p-6 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4 flex-1">
          <div className="p-3 bg-primary/10 rounded-lg">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold mb-1">
              {getDocumentTypeLabel(document.document_type)}
            </h3>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(document.created_at)}</span>
              </div>
              {document.file_mime_type && (
                <span className="uppercase">{document.file_mime_type.split('/')[1]}</span>
              )}
              {document.file_size_bytes && (
                <span>{(document.file_size_bytes / 1024).toFixed(0)} KB</span>
              )}
            </div>
          </div>
        </div>
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
  );
}

