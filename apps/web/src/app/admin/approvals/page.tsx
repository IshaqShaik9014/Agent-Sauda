'use client';

import React, { useState, useEffect } from 'react';
import { auth } from '../../../lib/auth';
import { api, type PendingApproval } from '../../../lib/api';
import {
  CheckSquare,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Percent,
  RefreshCw,
  Loader2,
  AlertCircle,
  ShieldAlert
} from 'lucide-react';

export default function AdminApprovalsPage() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadApprovals = async (refresh = false) => {
    const activeMerchant = auth.getActiveMerchant();
    if (!activeMerchant) return;

    try {
      if (refresh) setIsRefreshing(true);
      const res = await api.getPendingApprovals(activeMerchant.id);
      setApprovals(res.approvals);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load approval requests');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, []);

  const handleApprove = async (approvalId: string) => {
    const activeMerchant = auth.getActiveMerchant();
    if (!activeMerchant) return;

    try {
      setProcessingId(approvalId);
      await api.approveOffer(activeMerchant.id, approvalId, 'Approved by Store Manager');
      await loadApprovals(true);
    } catch (err: unknown) {
      alert(`Approval action failed: ${(err as Error).message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (approvalId: string) => {
    const activeMerchant = auth.getActiveMerchant();
    if (!activeMerchant) return;

    const reason = prompt('Reason for declining this quotation:', 'Margin too thin for current warehouse stock');
    if (!reason) return;

    try {
      setProcessingId(approvalId);
      await api.rejectApproval(activeMerchant.id, approvalId, reason);
      await loadApprovals(true);
    } catch (err: unknown) {
      alert(`Rejection action failed: ${(err as Error).message}`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-emerald-400" />
            Human-in-the-Loop (HITL) Approvals
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Review and authorize high-value AI quotes locked in DRAFT status by deterministic policy triggers
          </p>
        </div>

        <button
          onClick={() => loadApprovals(true)}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Approvals Table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-xl overflow-hidden backdrop-blur-sm">
        {isLoading ? (
          <div className="flex h-48 flex-col items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-400 mb-2" />
            <p className="text-xs text-zinc-400">Loading pending requests...</p>
          </div>
        ) : approvals.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-400 space-y-2">
            <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500" />
            <p className="font-semibold text-zinc-200">No Pending Approvals in Queue</p>
            <p className="text-zinc-500">
              All AI agent quotes are currently operating smoothly within autonomous policy limits.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {approvals.map((appr) => (
              <div
                key={appr.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-800/20"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-zinc-100">
                      Offer #{appr.offerNumber}
                    </span>
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/20">
                      NEEDS MANAGER APPROVAL
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                    <span>
                      Quote Total: <strong className="text-zinc-100 font-bold">₹{appr.totalAmount.toLocaleString('en-IN')}</strong>
                    </span>
                    <span>&bull;</span>
                    <span>
                      Discount: <strong className="text-emerald-400 font-mono">{appr.discountPercent}%</strong>
                    </span>
                    <span>&bull;</span>
                    <span>
                      Gross Margin: <strong className="text-indigo-400 font-mono">{appr.marginPercent}%</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-amber-300 pt-1">
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                    <span>Reason: {appr.reason}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApprove(appr.id)}
                    disabled={processingId === appr.id}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-zinc-950 shadow-md shadow-emerald-500/20 hover:bg-emerald-400 transition-all disabled:opacity-50"
                  >
                    {processingId === appr.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    <span>Authorize Quote</span>
                  </button>

                  <button
                    onClick={() => handleReject(appr.id)}
                    disabled={processingId === appr.id}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 hover:text-red-400 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    <span>Decline</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
