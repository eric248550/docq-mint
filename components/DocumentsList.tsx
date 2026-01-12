'use client';

import { useState, useEffect, useRef } from 'react';
import { useSchoolDocuments, useSchoolMembers } from '@/hooks/useSchools';
import { useS3Upload } from '@/hooks/useS3Upload';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/button';
import { FileText, Upload, Loader2, Trash2, Download, UserPlus, CheckCircle2, Circle, Rocket } from 'lucide-react';
import { DBDocument } from '@/lib/db/types';

interface DocumentsListProps {
  schoolId: string;
  limit?: number;
}

export function DocumentsList({ schoolId, limit }: DocumentsListProps) {
  const { documents, isLoading, error, createDocument, updateDocument, deleteDocument, refetch } = useSchoolDocuments(schoolId);
  const { members } = useSchoolMembers(schoolId);
  const { uploadFile, progress, reset } = useS3Upload();
  const { getAuthToken } = useAuthStore();
  
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [formData, setFormData] = useState({
    student_id: '',
    document_type: 'report_card',
  });
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [isMinting, setIsMinting] = useState(false);
  const [mintingDocId, setMintingDocId] = useState<string | null>(null);

  // Only show students who have actually signed up (user_id is not null)
  const students = members.filter(m => m.role === 'student' && m.user_id !== null);
  
  const isUploading = progress.status === 'uploading' || uploadingFiles.size > 0;
  
  // Get unminted documents
  const unmintedDocuments = documents.filter(doc => !doc.is_published);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    // Filter for accepted file types
    const acceptedFiles = files.filter(file => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      return ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'].includes(extension || '');
    });

    if (acceptedFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...acceptedFiles]);
    }

    if (acceptedFiles.length < files.length) {
      alert(`${files.length - acceptedFiles.length} file(s) were rejected. Only PDF, DOC, DOCX, JPG, JPEG, and PNG files are accepted.`);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const calculateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedFiles.length === 0) {
      alert('Please select at least one file');
      return;
    }

    const studentId = formData.student_id && formData.student_id.trim() !== '' 
      ? formData.student_id 
      : undefined;

    let successCount = 0;
    let failedFiles: string[] = [];

    try {
      // Upload files sequentially
      for (const file of selectedFiles) {
        try {
          setUploadingFiles(prev => new Set(prev).add(file.name));

          // Reset any previous upload state
          reset();
          
          // Upload to S3
          const uploadResult = await uploadFile(file);
          
          if (!uploadResult) {
            throw new Error('Failed to upload file to S3');
          }
          
          // Calculate file hash
          const fileHash = await calculateFileHash(file);

          // Create document record
          await createDocument({
            student_id: studentId,
            document_type: formData.document_type,
            file_storage_provider: 's3',
            file_storage_url: uploadResult.url,
            file_hash: fileHash,
            file_mime_type: file.type,
            file_size_bytes: file.size,
            original_filename: file.name,
          });

          successCount++;
          
          setUploadingFiles(prev => {
            const next = new Set(prev);
            next.delete(file.name);
            return next;
          });
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
          failedFiles.push(file.name);
          setUploadingFiles(prev => {
            const next = new Set(prev);
            next.delete(file.name);
            return next;
          });
        }
      }

      // Show results
      if (successCount === selectedFiles.length) {
        alert(`All ${successCount} document(s) uploaded successfully!`);
      } else if (successCount > 0) {
        alert(`${successCount} document(s) uploaded successfully.\n\nFailed: ${failedFiles.join(', ')}`);
      } else {
        alert(`Failed to upload all documents.\n\nFailed: ${failedFiles.join(', ')}`);
      }

      // Reset form if any uploads succeeded
      if (successCount > 0) {
        setShowUploadForm(false);
        setSelectedFiles([]);
        setFormData({
          student_id: '',
          document_type: 'report_card',
        });
        reset();
      }
    } catch (error) {
      console.error('Failed to upload documents:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to upload documents: ${errorMessage}`);
      reset();
      setUploadingFiles(new Set());
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

  const handleMintDocuments = async (documentIds: string[]) => {
    if (documentIds.length === 0) {
      alert('No documents to publish');
      return;
    }

    const confirmMessage = documentIds.length === 1
      ? 'Are you sure you want to publish this document to the blockchain? This action cannot be undone.'
      : `Are you sure you want to publish ${documentIds.length} documents to the blockchain? This action cannot be undone.`;

    if (!confirm(confirmMessage)) return;

    setIsMinting(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/schools/${schoolId}/documents/mint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ documentIds }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to publish documents');
      }

      const result = await response.json();
      
      alert(
        `Publishing job queued for ${result.documentCount} document(s)!\n\n` +
        `The minting process is running in the background and will be confirmed on the blockchain.\n\n` +
        `Please refresh the page in a few minutes to see the updated status.`
      );
      
      // Refetch documents to update UI
      await refetch();
    } catch (error) {
      console.error('Failed to publish documents:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to publish documents: ${errorMessage}`);
    } finally {
      setIsMinting(false);
      setMintingDocId(null);
    }
  };

  const handleMintAll = async () => {
    const unmintedIds = unmintedDocuments.map(doc => doc.id);
    await handleMintDocuments(unmintedIds);
  };

  const handleMintSingle = async (documentId: string) => {
    setMintingDocId(documentId);
    await handleMintDocuments([documentId]);
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
          <div className="flex gap-2">
            {unmintedDocuments.length > 0 && (
              <Button 
                onClick={handleMintAll} 
                size="sm"
                variant="default"
                disabled={isMinting}
              >
                {isMinting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4 mr-2" />
                    Publish All ({unmintedDocuments.length})
                  </>
                )}
              </Button>
            )}
            <Button onClick={() => setShowUploadForm(!showUploadForm)} size="sm" variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </div>
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
            <label className="text-sm font-medium">Files</label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`mt-1 border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isDragging 
                  ? 'border-primary bg-primary/5' 
                  : 'border-gray-300 hover:border-primary/50'
              }`}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                Drag and drop files here, or click to browse
              </p>
              <input
                type="file"
                onChange={handleFileChange}
                multiple
                className="hidden"
                id="file-upload"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                disabled={isUploading}
              />
              <label htmlFor="file-upload">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploading}
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  Browse Files
                </Button>
              </label>
              <p className="text-xs text-muted-foreground mt-2">
                Supported: PDF, DOC, DOCX, JPG, JPEG, PNG
              </p>
            </div>

            {selectedFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium">Selected Files ({selectedFiles.length})</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between p-2 bg-muted rounded-md"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(0)} KB
                          </p>
                        </div>
                      </div>
                      {uploadingFiles.has(file.name) ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          disabled={isUploading}
                          className="flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
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
            <Button type="submit" disabled={isUploading || selectedFiles.length === 0}>
              {isUploading 
                ? `Uploading... (${uploadingFiles.size}/${selectedFiles.length})` 
                : `Upload ${selectedFiles.length} Document${selectedFiles.length !== 1 ? 's' : ''}`}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowUploadForm(false);
                setSelectedFiles([]);
                setUploadingFiles(new Set());
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
              students={students}
              onDelete={!limit ? handleDelete : undefined}
              onAssign={!limit ? updateDocument : undefined}
              onMint={!limit ? handleMintSingle : undefined}
              isMinting={mintingDocId === doc.id}
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
  students: Array<{ id: string; user_id: string | null; email: string | null; role: string }>;
  onDelete?: (id: string) => void;
  onAssign?: (documentId: string, data: { student_id?: string | null }) => Promise<any>;
  onMint?: (documentId: string) => Promise<void>;
  isMinting?: boolean;
}

function DocumentRow({ document, students, onDelete, onAssign, onMint, isMinting }: DocumentRowProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const { getAuthToken } = useAuthStore();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAssignDropdown(false);
      }
    };

    if (showAssignDropdown) {
      window.document.addEventListener('mousedown', handleClickOutside);
      return () => window.document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAssignDropdown]);

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

  const handleAssignStudent = async (studentId: string | null) => {
    if (!onAssign) return;
    
    setIsAssigning(true);
    setShowAssignDropdown(false);
    try {
      await onAssign(document.id, { student_id: studentId });
    } catch (error) {
      console.error('Failed to assign student:', error);
      alert('Failed to assign student. Please try again.');
    } finally {
      setIsAssigning(false);
    }
  };

  const getAssignedStudentName = () => {
    if (!document.student_id) return 'Unassigned';
    const student = students.find(s => s.user_id === document.student_id);
    return student?.email || 'Unknown Student';
  };

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:border-primary/50 transition-colors">
      <div className="flex items-center gap-3 flex-1">
        <FileText className="h-5 w-5 text-primary" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium truncate">
              {document.original_filename || getDocumentTypeLabel(document.document_type)}
            </p>
            {document.is_published ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                <CheckCircle2 className="h-3 w-3" />
                Published
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                <Circle className="h-3 w-3" />
                Unpublished
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {document.original_filename && (
              <>
                <span>{getDocumentTypeLabel(document.document_type)}</span>
                <span>•</span>
              </>
            )}
            <span>{formatDate(document.created_at)}</span>
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
        {onAssign && (
          <div className="relative" ref={dropdownRef}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAssignDropdown(!showAssignDropdown)}
              disabled={isAssigning}
              className="text-xs"
            >
              {isAssigning ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <UserPlus className="h-3 w-3 mr-1" />
              )}
              {getAssignedStudentName()}
            </Button>
            {showAssignDropdown && (
              <div className="absolute right-0 mt-1 w-64 bg-white border rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                <div className="p-2">
                  <button
                    onClick={() => handleAssignStudent(null)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                  >
                    Unassign
                  </button>
                  {students.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No active students
                    </div>
                  ) : (
                    students.map((student) => (
                      <button
                        key={student.id}
                        onClick={() => handleAssignStudent(student.user_id!)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded ${
                          document.student_id === student.user_id ? 'bg-primary/10' : ''
                        }`}
                      >
                        {student.email || 'Unknown'}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {onMint && !document.is_published && (
          <Button
            variant="default"
            size="sm"
            onClick={() => onMint(document.id)}
            disabled={isMinting}
            title="Publish to blockchain"
          >
            {isMinting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="h-4 w-4" />
            )}
          </Button>
        )}
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

