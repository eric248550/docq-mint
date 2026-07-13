'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStudentDocuments } from '@/hooks/useSchools';
import { useAuthStore } from '@/store/useAuthStore';
import { DBDocument } from '@/lib/db/types';
import { FileText, Download, Calendar, Loader2, Share2, Copy, Check, Search, ArrowUpDown } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Modal, useModal } from '@/components/ui/alert-modal';
import { TagChip } from '@/components/DocumentsList';

export function StudentDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [documentType, setDocumentType] = useState(searchParams.get('docType') || '');
  const [sortOrder, setSortOrder] = useState(searchParams.get('sort') || 'desc');

  const { documents, pagination, isLoading, error, refetch } = useStudentDocuments();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch on every filter change
  useEffect(() => {
    refetch({ page, search, documentType, sortOrder });
  }, [page, search, documentType, sortOrder]);

  // Sync to URL (wrapped in startTransition so the URL update is non-blocking
  // and never interrupts an active search input)
  useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', String(page));
    if (search) params.set('search', search);
    if (documentType) params.set('docType', documentType);
    if (sortOrder !== 'desc') params.set('sort', sortOrder);
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `?${qs}` : '?', { scroll: false });
    });
  }, [page, search, documentType, sortOrder]);

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

      {/* Filter controls */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by filename..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border rounded-md bg-background"
          />
        </div>
        <select
          value={documentType}
          onChange={e => { setDocumentType(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border rounded-md bg-background"
        >
          <option value="">All Types</option>
          <optgroup label="Enrollment / Identity">
            <option value="birth_certificate">Birth Certificate</option>
            <option value="national_id">National ID (Aadhar / SSN)</option>
            <option value="address_proof">Address Proof</option>
            <option value="passport_photo">Passport Photo</option>
          </optgroup>
          <optgroup label="Transfer / Admissions">
            <option value="transfer_certificate">Transfer Certificate (LC/TC)</option>
          </optgroup>
          <optgroup label="Academic Records">
            <option value="report_card">Report Card / Marksheet</option>
            <option value="transcript">Transcript</option>
            <option value="cumulative_record">Cumulative Record</option>
            <option value="diploma">Diploma</option>
            <option value="certificate">Certificate</option>
          </optgroup>
          <optgroup label="Health">
            <option value="health_fitness_card">Health &amp; Fitness Card</option>
          </optgroup>
          <optgroup label="Other">
            <option value="others">Others</option>
          </optgroup>
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setSortOrder(s => s === 'desc' ? 'asc' : 'desc'); setPage(1); }}
          className="flex items-center gap-1"
        >
          <ArrowUpDown className="h-3 w-3" />
          {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
        </Button>
      </div>

      {documents.length === 0 ? (
        <div className="text-center p-12 border rounded-lg">
          <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">No documents found</h3>
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

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => p - 1)}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => p + 1)}
            disabled={page >= pagination.totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

interface ShareLink {
  id: string;
  token: string;
  url: string;
  expiresAt: string | null;
  createdAt: string;
  isExpired: boolean;
}

function DocumentCard({ document }: { document: DBDocument }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [neverExpires, setNeverExpires] = useState(false);
  const [expiryInput, setExpiryInput] = useState('');
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [isLoadingLinks, setIsLoadingLinks] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedQrId, setExpandedQrId] = useState<string | null>(null);
  const { getAuthToken } = useAuthStore();
  const { modal, showAlert, closeModal } = useModal();

  const fetchLinks = async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;
      const response = await fetch(`/api/documents/${document.id}/share`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const { links: fetched } = await response.json();
      setLinks(fetched ?? []);
    } catch (error) {
      console.error('Failed to load share links:', error);
    } finally {
      setIsLoadingLinks(false);
    }
  };

  useEffect(() => {
    fetchLinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.id]);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      // Enrollment / Identity
      birth_certificate:   'Birth Certificate',
      national_id:         'National ID (Aadhar / SSN)',
      address_proof:       'Address Proof',
      passport_photo:      'Passport Photo',
      // Transfer / Admissions
      transfer_certificate: 'Transfer Certificate (LC/TC)',
      // Academic Records
      report_card:         'Report Card / Marksheet',
      transcript:          'Transcript',
      cumulative_record:   'Cumulative Record',
      diploma:             'Diploma',
      certificate:         'Certificate',
      // Health
      health_fitness_card: 'Health & Fitness Card',
      // Catch-all
      others:              'Others',
    };
    return labels[type] || type;
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/documents/${document.id}/download`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get download URL');
      }

      const { url } = await response.json();
      window.open(url, '_blank');
    } catch (error) {
      console.error('Download error:', error);
      await showAlert('Failed to download document. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const openShareModal = () => {
    setExpiryInput('');
    setNeverExpires(false);
    setShowShareModal(true);
  };

  const handleGenerate = async () => {
    // Resolve expiration: never expires -> null, custom date -> ISO string,
    // empty input -> undefined (server applies its 30-day default)
    let expiresAt: string | null | undefined;
    if (neverExpires) {
      expiresAt = null;
    } else if (expiryInput) {
      const parsed = new Date(expiryInput);
      if (isNaN(parsed.getTime())) {
        await showAlert('Please enter a valid expiration date and time.');
        return;
      }
      if (parsed.getTime() <= Date.now()) {
        await showAlert('Expiration date must be in the future.');
        return;
      }
      expiresAt = parsed.toISOString();
    } else {
      expiresAt = undefined;
    }

    setIsSharing(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/documents/${document.id}/share`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(expiresAt === undefined ? {} : { expiresAt }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate share link');
      }

      const created = await response.json();
      setShowShareModal(false);
      await fetchLinks();
      // Auto-expand the QR for the freshly created link
      setExpandedQrId(created.token);
    } catch (error) {
      console.error('Share error:', error);
      await showAlert('Failed to generate share link. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyLink = (link: ShareLink) => {
    navigator.clipboard.writeText(link.url);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId((prev) => (prev === link.id ? null : prev)), 2000);
  };

  const formatExpiry = (link: ShareLink) => {
    if (!link.expiresAt) return 'Never expires';
    const label = new Date(link.expiresAt).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
    return link.isExpired ? `Expired on ${label}` : `Expires ${label}`;
  };

  const activeLinks = links.filter((link) => !link.isExpired);
  const expiredCount = links.length - activeLinks.length;

  return (
    <div className="border rounded-lg p-6 hover:border-primary/50 transition-colors">
      <Modal
        isOpen={modal.isOpen}
        message={modal.message}
        type={modal.type}
        onConfirm={() => closeModal(true)}
        onCancel={() => closeModal(false)}
      />
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
            {document.tags && document.tags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap mt-2">
                {document.tags.map(tag => (
                  <TagChip key={tag.id} tag={tag} />
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={openShareModal}
            disabled={isSharing}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share
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

      {/* Existing shared links */}
      {(isLoadingLinks || links.length > 0) && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm font-medium mb-2">Shared Links:</p>
          {isLoadingLinks ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading links...
            </div>
          ) : (
            <div className="space-y-3">
              {activeLinks.map((link) => (
                <div key={link.id} className="border rounded-md p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                        Active
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {formatExpiry(link)}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setExpandedQrId((prev) => (prev === link.token ? null : link.token))
                        }
                      >
                        {expandedQrId === link.token ? 'Hide QR' : 'Show QR'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyLink(link)}
                      >
                        {copiedId === link.id ? (
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
                  </div>
                  {expandedQrId === link.token && (
                    <div className="mt-3 flex flex-col sm:flex-row gap-4 items-start">
                      <div className="flex-shrink-0 p-3 bg-white rounded-lg border">
                        <QRCodeSVG value={link.url} size={160} level="M" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <input
                          type="text"
                          value={link.url}
                          readOnly
                          className="w-full px-3 py-2 text-sm border rounded-md bg-muted"
                        />
                        <p className="text-xs text-muted-foreground">
                          Share this link or scan the QR code with third parties to verify your document. They will need to pay $2 to access it.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {activeLinks.length === 0 && (
                <p className="text-xs text-muted-foreground">No active links.</p>
              )}
              {expiredCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {expiredCount} {expiredCount === 1 ? 'link' : 'links'} expired
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Share / expiration modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-1">Create Shareable Link</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Set when this verification link should expire.
            </p>

            <label className="block text-sm font-medium mb-1">Expiration date &amp; time</label>
            <input
              type="datetime-local"
              value={expiryInput}
              onChange={(e) => setExpiryInput(e.target.value)}
              disabled={neverExpires || isSharing}
              className="w-full px-3 py-2 text-sm border rounded-md bg-background disabled:opacity-50"
            />

            <label className="flex items-center gap-2 text-sm cursor-pointer select-none mt-3">
              <input
                type="checkbox"
                checked={neverExpires}
                onChange={(e) => setNeverExpires(e.target.checked)}
                disabled={isSharing}
                className="h-4 w-4"
              />
              Never expires
            </label>

            {!neverExpires && !expiryInput && (
              <p className="text-xs text-muted-foreground mt-2">
                Leave blank to default to 30 days from now.
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowShareModal(false)}
                disabled={isSharing}
              >
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={isSharing}>
                {isSharing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4 mr-2" />
                    Generate Link
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
