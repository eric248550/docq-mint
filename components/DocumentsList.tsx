'use client';

import { useState } from 'react';
import { useSchoolDocuments, useSchoolMembers } from '@/hooks/useSchools';
import { useS3Upload } from '@/hooks/useS3Upload';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/button';
import { FileText, Upload, Loader2, Trash2, Download } from 'lucide-react';
import { DBDocument } from '@/lib/db/types';

interface DocumentsListProps {
  schoolId: string;
  limit?: number;
}

export function DocumentsList({ schoolId, limit }: DocumentsListProps) {
  const { documents, isLoading, error, createDocument, deleteDocument } = useSchoolDocuments(schoolId);
  const { members } = useSchoolMembers(schoolId);
  const { uploadFile, progress, reset } = useS3Upload();
  
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    student_id: '',
    document_type: 'report_card',
  });

  // Only show students who have actually signed up (user_id is not null)
  const students = members.filter(m => m.role === 'student' && m.user_id !== null);
  
  const isUploading = progress.status === 'uploading';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const calculateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      alert('Please select a file');
      return;
    }

    try {
      // Reset any previous upload state
      reset();
      
      // Upload to S3
      console.log('Uploading file to S3...');
      const uploadResult = await uploadFile(selectedFile);
      
      if (!uploadResult) {
        throw new Error('Failed to upload file to S3');
      }
      
      console.log('File uploaded to S3:', uploadResult.url);

      // Calculate file hash
      console.log('Calculating file hash...');
      const fileHash = await calculateFileHash(selectedFile);
      console.log('File hash calculated:', fileHash);

      // Validate student_id
      const studentId = formData.student_id && formData.student_id.trim() !== '' 
        ? formData.student_id 
        : undefined;

      console.log('Creating document record...', { studentId, type: formData.document_type });

      // Create document record
      await createDocument({
        student_id: studentId,
        document_type: formData.document_type,
        file_storage_provider: 's3',
        file_storage_url: uploadResult.url,
        file_hash: fileHash,
        file_mime_type: selectedFile.type,
        file_size_bytes: selectedFile.size,
      });

      console.log('Document created successfully');

      // Reset form
      setShowUploadForm(false);
      setSelectedFile(null);
      setFormData({
        student_id: '',
        document_type: 'report_card',
      });
      reset();
      
      alert('Document uploaded successfully!');
    } catch (error) {
      console.error('Failed to upload document:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to upload document: ${errorMessage}`);
      reset();
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      await deleteDocument(documentId);
    } catch (error) {
      console.error('Failed to delete document:', error);
      alert('Failed to delete document');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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

  const displayDocuments = limit ? documents.slice(0, limit) : documents;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Documents ({documents.length})</h3>
        {!limit && (
          <Button onClick={() => setShowUploadForm(!showUploadForm)} size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        )}
      </div>

      {showUploadForm && (
        <form onSubmit={handleUpload} className="border rounded-lg p-4 space-y-4">
          <div>
            <label className="text-sm font-medium">Student</label>
            <select
              value={formData.student_id}
              onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
            >
              <option value="">Select student (optional)</option>
              {students.length === 0 ? (
                <option disabled>No active students yet</option>
              ) : (
                students.map((student) => (
                  <option key={student.id} value={student.user_id!}>
                    {student.email || 'Student'}
                  </option>
                ))
              )}
            </select>
            {students.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Students must sign in before documents can be assigned to them.
              </p>
            )}
          </div>
          
          <div>
            <label className="text-sm font-medium">Document Type</label>
            <select
              value={formData.document_type}
              onChange={(e) => setFormData({ ...formData, document_type: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
            >
              <option value="report_card">Report Card</option>
              <option value="transcript">Transcript</option>
              <option value="certificate">Certificate</option>
              <option value="diploma">Diploma</option>
              <option value="others">Others</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">File</label>
            <input
              type="file"
              onChange={handleFileChange}
              className="w-full mt-1"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            />
            {selectedFile && (
              <p className="text-xs text-muted-foreground mt-1">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
              </p>
            )}
          </div>

          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Uploading {progress.fileName}...</span>
                <span>{progress.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
            </div>
          )}
          
          {progress.status === 'error' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
              {progress.error}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={isUploading || !selectedFile}>
              {isUploading ? 'Uploading...' : 'Upload Document'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowUploadForm(false);
                setSelectedFile(null);
                reset();
              }}
              disabled={isUploading}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {displayDocuments.length === 0 ? (
        <div className="text-center p-8 border rounded-lg">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No documents yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayDocuments.map((doc) => (
            <DocumentRow
              key={doc.id}
              document={doc}
              onDelete={!limit ? handleDelete : undefined}
            />
          ))}
        </div>
      )}

      {limit && documents.length > limit && (
        <p className="text-sm text-center text-muted-foreground">
          and {documents.length - limit} more...
        </p>
      )}
    </div>
  );
}

interface DocumentRowProps {
  document: DBDocument;
  onDelete?: (id: string) => void;
}

function DocumentRow({ document, onDelete }: DocumentRowProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const { getAuthToken } = useAuthStore();

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
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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
      
      // Open in new tab or trigger download
      window.open(url, '_blank');
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download document. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:border-primary/50 transition-colors">
      <div className="flex items-center gap-3 flex-1">
        <FileText className="h-5 w-5 text-primary" />
        <div className="flex-1 min-w-0">
          <p className="font-medium">{getDocumentTypeLabel(document.document_type)}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatDate(document.created_at)}</span>
            {document.file_mime_type && (
              <>
                <span>•</span>
                <span className="uppercase">{document.file_mime_type.split('/')[1]}</span>
              </>
            )}
            {document.file_size_bytes && (
              <>
                <span>•</span>
                <span>{(document.file_size_bytes / 1024).toFixed(0)} KB</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDownload}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(document.id)}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        )}
      </div>
    </div>
  );
}

