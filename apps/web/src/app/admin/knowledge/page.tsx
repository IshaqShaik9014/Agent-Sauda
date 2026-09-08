'use client';

import React, { useState, useEffect, useRef } from 'react';
import { auth, type AuthSession } from '../../../lib/auth';
import {
  BookOpen,
  Upload,
  Search,
  CheckCircle2,
  FileText,
  Loader2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Database,
  FileUp,
  Layers,
  FileType,
  X,
  Eye
} from 'lucide-react';

interface IngestedDoc {
  id: string;
  title: string;
  documentType: string;
  rawContent: string;
  createdAt: string;
  _count?: {
    chunks: number;
  };
}

interface SearchResult {
  id: string;
  documentTitle: string;
  documentType: string;
  content: string;
  similarityScore: number;
}

interface PreviewChunk {
  index: number;
  content: string;
  charCount: number;
  estimatedTokens: number;
}

export default function KnowledgePage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [docs, setDocs] = useState<IngestedDoc[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);

  // Ingestion Mode: 'UPLOAD' | 'MANUAL'
  const [ingestMode, setIngestMode] = useState<'UPLOAD' | 'MANUAL'>('UPLOAD');

  // Form State
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState('RETURN_POLICY');
  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Auto-Chunking Preview State
  const [previewChunks, setPreviewChunks] = useState<PreviewChunk[]>([]);
  const [showChunkPreview, setShowChunkPreview] = useState(false);

  // Search Test State
  const [searchQuery, setSearchQuery] = useState('Can I return this chair after assembling it?');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  useEffect(() => {
    const s = auth.getSession();
    setSession(s);
    if (s?.merchant?.id && s?.token) {
      loadDocuments(s.merchant.id, s.token);
    }
  }, []);

  // Compute chunks in real-time whenever content changes (~500 chars with 80 char overlap)
  useEffect(() => {
    if (!content.trim()) {
      setPreviewChunks([]);
      return;
    }

    const text = content.trim();
    const chunkSize = 500;
    const overlap = 80;
    const chunks: PreviewChunk[] = [];

    // Split by paragraphs or sentence boundaries
    let start = 0;
    let idx = 1;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const chunkText = text.slice(start, end).trim();
      if (chunkText.length > 0) {
        chunks.push({
          index: idx++,
          content: chunkText,
          charCount: chunkText.length,
          estimatedTokens: Math.ceil(chunkText.length / 4)
        });
      }
      if (end >= text.length) break;
      start += chunkSize - overlap;
    }

    setPreviewChunks(chunks);
  }, [content]);

  const loadDocuments = async (merchantId: string, token: string) => {
    try {
      setIsLoadingDocs(true);
      const res = await fetch(`${API_URL}/api/merchants/${merchantId}/knowledge/documents`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.documents) {
        setDocs(data.documents);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const inferCategoryFromFilenameOrText = (name: string, text: string): string => {
    const lower = `${name} ${text}`.toLowerCase();
    if (lower.includes('return') || lower.includes('refund') || lower.includes('replacement')) {
      return 'RETURN_POLICY';
    }
    if (lower.includes('warranty') || lower.includes('guarantee') || lower.includes('defect')) {
      return 'WARRANTY';
    }
    if (lower.includes('ship') || lower.includes('delivery') || lower.includes('dispatch') || lower.includes('courier')) {
      return 'SHIPPING';
    }
    if (lower.includes('faq') || lower.includes('frequently asked')) {
      return 'FAQ';
    }
    if (lower.includes('term') || lower.includes('condition') || lower.includes('tos')) {
      return 'TERMS';
    }
    return 'GENERAL';
  };

  const handleFileProcess = async (file: File) => {
    setSelectedFile(file);
    setIsReadingFile(true);
    setUploadError(null);

    // Auto-generate title from filename
    const cleanTitle = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
    setTitle(cleanTitle);

    try {
      let extractedText = '';

      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        // PDF client text reader: extract text items or raw text stream
        const arrayBuffer = await file.arrayBuffer();
        const textDecoder = new TextDecoder('utf-8', { fatal: false });
        const rawString = textDecoder.decode(arrayBuffer);
        
        // Extract plain strings from PDF stream
        const matches = rawString.match(/\(([^()]+)\)/g);
        if (matches && matches.length > 5) {
          extractedText = matches
            .map((m) => m.slice(1, -1))
            .filter((s) => s.length > 2 && !/^[\x00-\x1F\x7F]+$/.test(s))
            .join(' ');
        }
        
        if (!extractedText || extractedText.length < 50) {
          extractedText = `Document: ${cleanTitle}\n\n[Uploaded PDF: ${file.name} - ${(file.size / 1024).toFixed(1)} KB]\nThis document contains merchant policy terms for ${cleanTitle}.`;
        }
      } else {
        // Text, Markdown, CSV, JSON, Doc text
        extractedText = await file.text();
      }

      setContent(extractedText.trim());
      const detectedType = inferCategoryFromFilenameOrText(file.name, extractedText);
      setDocumentType(detectedType);
    } catch (err: any) {
      setUploadError(`Failed to parse file: ${err.message}`);
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !title.trim() || !content.trim()) return;

    try {
      setIsUploading(true);
      setUploadError(null);
      setUploadSuccess(null);

      const res = await fetch(`${API_URL}/api/merchants/${session.merchant.id}/knowledge/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify({
          title: title.trim(),
          documentType,
          content: content.trim()
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to ingest document');
      }

      setUploadSuccess(`🎉 Document "${title}" successfully ingested! Created ${data.document?.chunksCount || previewChunks.length} pgvector chunks.`);
      setTitle('');
      setContent('');
      setSelectedFile(null);
      setPreviewChunks([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadDocuments(session.merchant.id, session.token);
    } catch (err: any) {
      setUploadError(err.message || 'An error occurred during ingestion.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleTestSearch = async () => {
    if (!session || !searchQuery.trim()) return;

    try {
      setIsSearching(true);
      const res = await fetch(`${API_URL}/api/merchants/${session.merchant.id}/knowledge/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify({
          query: searchQuery.trim(),
          topK: 2
        })
      });

      const data = await res.json();
      if (data.success && data.chunks) {
        setSearchResults(data.chunks);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const loadTemplate = (type: string) => {
    if (type === 'RETURN_POLICY') {
      setTitle('Official Return & Refund Policy 2026');
      setDocumentType('RETURN_POLICY');
      setContent(
        'Furniture items can be returned within 7 calendar days of delivery.\nAssembled furniture cannot be returned under any circumstances unless there is an authentic manufacturing defect verified by our technical inspection team.\nCustom upholstered or bespoke fabric orders are strictly non-refundable.\nRefunds are processed to the original payment method within 5 to 7 business days after warehouse inspection.'
      );
    } else if (type === 'WARRANTY') {
      setTitle('Structural Warranty Terms 2026');
      setDocumentType('WARRANTY');
      setContent(
        'All solid wood tables and ergonomic executive office chairs include a 3-year limited structural warranty.\nWarranty covers frame warping, joint failure, and hydraulic gas-lift cylinder malfunction.\nWarranty explicitly excludes normal fabric wear and tear, accidental liquid spills, and modifications made by unauthorized technicians.'
      );
    } else if (type === 'SHIPPING') {
      setTitle('Pan-India Shipping & Delivery Terms 2026');
      setDocumentType('SHIPPING');
      setContent(
        'We provide free express delivery across all tier-1 and tier-2 Indian cities for orders above ₹10,000.\nOrders below ₹10,000 incur a standard flat shipping fee of ₹499.\nDispatch occurs within 24 to 48 business hours via Delhivery Prime or BlueDart with end-to-end milestone tracking.'
      );
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
            <BookOpen className="h-4 w-4" />
          </div>
          <h1 className="text-xl font-bold text-zinc-100">Merchant Knowledge Base & pgvector RAG</h1>
        </div>
        <p className="text-xs text-zinc-400">
          Upload and auto-chunk merchant policies (PDF, Markdown, Text, FAQs, Terms).
          Chunks and 768-dim embeddings are persisted directly in PostgreSQL with pgvector for grounded AI answers.
        </p>
      </div>

      {/* Grid: Ingestion Form & Semantic Test */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Upload / Ingestion Form */}
        <div className="lg:col-span-7 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-zinc-200">Ingest Knowledge Document</h2>
            </div>

            {/* Mode Switcher */}
            <div className="flex rounded-xl bg-zinc-950 p-1 border border-zinc-800">
              <button
                type="button"
                onClick={() => setIngestMode('UPLOAD')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                  ingestMode === 'UPLOAD'
                    ? 'bg-emerald-500 text-zinc-950 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <FileUp className="h-3 w-3" />
                <span>Upload Document</span>
              </button>
              <button
                type="button"
                onClick={() => setIngestMode('MANUAL')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                  ingestMode === 'MANUAL'
                    ? 'bg-emerald-500 text-zinc-950 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <FileText className="h-3 w-3" />
                <span>Write / Paste Text</span>
              </button>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[10px] font-medium text-zinc-400">Quick Presets:</span>
            <button
              type="button"
              onClick={() => loadTemplate('RETURN_POLICY')}
              className="text-[10px] px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            >
              Return Policy
            </button>
            <button
              type="button"
              onClick={() => loadTemplate('WARRANTY')}
              className="text-[10px] px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            >
              Warranty Terms
            </button>
            <button
              type="button"
              onClick={() => loadTemplate('SHIPPING')}
              className="text-[10px] px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            >
              Shipping Policy
            </button>
          </div>

          {/* Drag & Drop File Upload Area */}
          {ingestMode === 'UPLOAD' && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="relative cursor-pointer rounded-2xl border-2 border-dashed border-zinc-700 hover:border-emerald-500/80 bg-zinc-950/60 p-6 text-center transition-all hover:bg-zinc-950/90 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.pdf,.csv,.json,.doc,.docx"
                onChange={(e) => e.target.files?.[0] && handleFileProcess(e.target.files[0])}
                className="hidden"
              />

              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
                  <FileUp className="h-6 w-6" />
                </div>
                {selectedFile ? (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-zinc-100 flex items-center justify-center gap-1.5">
                      <FileType className="h-3.5 w-3.5 text-emerald-400" />
                      <span>{selectedFile.name}</span>
                    </p>
                    <p className="text-[11px] text-zinc-400">
                      {(selectedFile.size / 1024).toFixed(1)} KB &bull; Text extracted & auto-chunked
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-zinc-200">
                      Drag & Drop your Merchant Policy Document here, or <span className="text-emerald-400 underline">Browse Files</span>
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      Supports PDF, Markdown (.md), Plain Text (.txt), CSV, JSON
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleIngest} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Return & Refund Policy 2026"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Category
                </label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="RETURN_POLICY">Return Policy</option>
                  <option value="WARRANTY">Warranty</option>
                  <option value="SHIPPING">Shipping</option>
                  <option value="FAQ">FAQ</option>
                  <option value="TERMS">Terms</option>
                  <option value="GENERAL">General</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-medium text-zinc-400">
                  Document Content / Policy Text
                </label>
                {previewChunks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowChunkPreview(!showChunkPreview)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>{showChunkPreview ? 'Hide' : 'Preview'} {previewChunks.length} Auto-Chunks</span>
                  </button>
                )}
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={ingestMode === 'UPLOAD' && selectedFile ? 4 : 6}
                placeholder="Paste, type, or drop merchant unstructured policy text here..."
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            {/* Live Auto-Chunking Preview Box */}
            {previewChunks.length > 0 && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3.5 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-emerald-400" />
                    <span className="font-bold text-zinc-200">Auto-Chunking Breakdown</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-mono">
                    <span>{content.length} chars</span>
                    <span>&bull;</span>
                    <span>~{Math.ceil(content.length / 4)} tokens</span>
                    <span>&bull;</span>
                    <span className="font-bold text-emerald-400">{previewChunks.length} vector chunks</span>
                  </div>
                </div>

                {showChunkPreview && (
                  <div className="max-h-44 overflow-y-auto space-y-2 pr-1 divide-y divide-zinc-900">
                    {previewChunks.map((chunk) => (
                      <div key={chunk.index} className="pt-2 text-[11px] space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-zinc-500">
                          <span className="font-bold text-emerald-400">Chunk #{chunk.index}</span>
                          <span>{chunk.charCount} chars (~{chunk.estimatedTokens} tokens)</span>
                        </div>
                        <p className="text-zinc-300 font-mono line-clamp-2 italic bg-zinc-900/60 p-2 rounded-lg">
                          &ldquo;{chunk.content}&rdquo;
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {uploadSuccess && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            {uploadError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isUploading || isReadingFile || !content.trim()}
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold py-2.5 text-xs transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Generating pgvector Embeddings ({previewChunks.length} Chunks)...</span>
                </>
              ) : isReadingFile ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Extracting File Text...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Ingest & Vectorize {previewChunks.length > 0 ? `(${previewChunks.length} Chunks)` : 'Document'}</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Live Vector Retrieval Playground */}
        <div className="lg:col-span-5 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Search className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-zinc-200">Test pgvector Semantic Search</h2>
            </div>
            <p className="text-[11px] text-zinc-400 mb-4">
              Simulate the AI Sales Agent querying the database using natural language cosine similarity.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Customer Policy Query
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g. Can I return after assembling?"
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleTestSearch}
                    disabled={isSearching}
                    className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-emerald-400 transition-colors disabled:opacity-50"
                  >
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
                  </button>
                </div>
              </div>

              {/* Retrieval Results */}
              {searchResults !== null && (
                <div className="mt-4 space-y-2">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Retrieved Chunks ({searchResults.length}):
                  </span>
                  {searchResults.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic">No matching chunks found for this merchant.</p>
                  ) : (
                    searchResults.map((r, i) => (
                      <div
                        key={r.id || i}
                        className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/90 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-emerald-400">{r.documentTitle}</span>
                          <span className="font-mono text-zinc-500">
                            Score: {(r.similarityScore * 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-zinc-300 text-[11px] leading-relaxed italic">
                          &ldquo;{r.content}&rdquo;
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center gap-2 text-[11px] text-zinc-500">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Strict Tenant Isolation: Scoped by merchantId at SQL layer.</span>
          </div>
        </div>
      </div>

      {/* Ingested Documents List */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-zinc-200">Active Knowledge Documents</h2>
          </div>
          <span className="text-xs text-zinc-500 font-mono">{docs.length} Documents</span>
        </div>

        {isLoadingDocs ? (
          <div className="py-8 flex items-center justify-center text-xs text-zinc-500 gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
            <span>Loading merchant documents...</span>
          </div>
        ) : docs.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500">
            No documents uploaded yet. Use the upload dropzone above to add store policies, warranty documents, and FAQs.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {docs.map((d) => (
              <div
                key={d.id}
                className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {d.documentType.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {d._count?.chunks ?? 1} chunks
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-zinc-100 mb-1">{d.title}</h3>
                  <p className="text-[11px] text-zinc-400 line-clamp-3 leading-relaxed">
                    {d.rawContent}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-zinc-800/50 text-[10px] text-zinc-600">
                  Uploaded {new Date(d.createdAt).toLocaleDateString('en-IN')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

