'use client';

import React, { useState, useEffect } from 'react';
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
  Database
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

export default function KnowledgePage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [docs, setDocs] = useState<IngestedDoc[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);

  // Form State
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState('RETURN_POLICY');
  const [content, setContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Search Test State
  const [searchQuery, setSearchQuery] = useState('Can I return this chair after assembling it?');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  useEffect(() => {
    const s = auth.getSession();
    setSession(s);
    if (s?.merchant?.id && s?.token) {
      loadDocuments(s.merchant.id, s.token);
    }
  }, []);

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

      setUploadSuccess(`Document "${title}" ingested successfully! Created ${data.document.chunksCount} pgvector chunks.`);
      setTitle('');
      setContent('');
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
          Upload unstructured merchant policies (Return, Warranty, Shipping, FAQs).
          Chunks and 768-dim embeddings are persisted directly in PostgreSQL with pgvector for grounded AI answers.
        </p>
      </div>

      {/* Grid: Ingestion Form & Semantic Test */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Upload / Ingestion Form */}
        <div className="lg:col-span-7 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-zinc-200">Ingest Knowledge Document</h2>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
              <Database className="h-3 w-3 text-emerald-400" />
              <span>PostgreSQL + pgvector</span>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-[10px] font-medium text-zinc-400 self-center">Templates:</span>
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
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Document Content / Policy Text
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={7}
                placeholder="Paste or type merchant unstructured policy text here..."
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

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
              disabled={isUploading}
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold py-2.5 text-xs transition-colors disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Computing Embeddings & Storing in pgvector...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Ingest & Vectorize Document</span>
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
            No documents uploaded yet. Use the form above to add your store's return, warranty, or shipping policies.
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
