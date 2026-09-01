'use client';

import React, { useState, useEffect } from 'react';
import { auth } from '../../../lib/auth';
import { api, type AdminPolicy } from '../../../lib/api';
import {
  Sliders,
  ShieldCheck,
  Percent,
  DollarSign,
  Layers,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

export default function AdminPolicyPage() {
  const [policy, setPolicy] = useState<AdminPolicy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [maxDiscountPercent, setMaxDiscountPercent] = useState(20);
  const [minimumMarginPercent, setMinimumMarginPercent] = useState(15);
  const [autonomousOrderLimit, setAutonomousOrderLimit] = useState(50000);
  const [approvalThreshold, setApprovalThreshold] = useState(100000);
  const [maxQuantityPerOrder, setMaxQuantityPerOrder] = useState(10);

  const loadPolicy = async () => {
    const activeMerchant = auth.getActiveMerchant();
    if (!activeMerchant) return;

    try {
      setIsLoading(true);
      const res = await api.getMerchantPolicy(activeMerchant.id);
      setPolicy(res.policy);
      setMaxDiscountPercent(res.policy.maxDiscountPercent);
      setMinimumMarginPercent(res.policy.minimumMarginPercent);
      setAutonomousOrderLimit(res.policy.autonomousOrderLimit);
      setApprovalThreshold(res.policy.approvalThreshold);
      setMaxQuantityPerOrder(res.policy.maxQuantityPerOrder);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load policy');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPolicy();
  }, []);

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeMerchant = auth.getActiveMerchant();
    if (!activeMerchant) return;

    try {
      setIsSaving(true);
      setSuccessMessage(null);
      setError(null);

      const res = await api.updateMerchantPolicy(activeMerchant.id, {
        maxDiscountPercent: Number(maxDiscountPercent),
        minimumMarginPercent: Number(minimumMarginPercent),
        autonomousOrderLimit: Number(autonomousOrderLimit),
        approvalThreshold: Number(approvalThreshold),
        maxQuantityPerOrder: Number(maxQuantityPerOrder)
      });

      setPolicy(res.policy);
      setSuccessMessage('Deterministic negotiation policy updated and enforced successfully!');
    } catch (err: unknown) {
      setError((err as Error).message || 'Could not update policy');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400 mb-2" />
        <p className="text-xs text-zinc-400">Loading policy guardrails...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Top Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
          <Sliders className="h-5 w-5 text-emerald-400" />
          Deterministic Policy Guardrails
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Configure strict mathematical boundaries that the AI sales agent cannot breach under any circumstances
        </p>
      </div>

      {successMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-4 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-4 text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Policy Form */}
      <form onSubmit={handleSavePolicy} className="space-y-6">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl space-y-6 backdrop-blur-sm">
          {/* Max Discount Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className="font-semibold text-zinc-200 flex items-center gap-2">
                <Percent className="h-4 w-4 text-emerald-400" />
                Maximum Allowed Discount Cap
              </label>
              <span className="font-extrabold text-sm text-emerald-400 font-mono">
                {maxDiscountPercent}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              step="1"
              value={maxDiscountPercent}
              onChange={(e) => setMaxDiscountPercent(Number(e.target.value))}
              className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <p className="text-[11px] text-zinc-500">
              The AI agent will never propose or accept any quote exceeding this discount percentage.
            </p>
          </div>

          {/* Minimum Margin Slider */}
          <div className="space-y-2 pt-4 border-t border-zinc-800/80">
            <div className="flex justify-between items-center text-xs">
              <label className="font-semibold text-zinc-200 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-indigo-400" />
                Minimum Gross Profit Margin
              </label>
              <span className="font-extrabold text-sm text-indigo-400 font-mono">
                {minimumMarginPercent}%
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="60"
              step="1"
              value={minimumMarginPercent}
              onChange={(e) => setMinimumMarginPercent(Number(e.target.value))}
              className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <p className="text-[11px] text-zinc-500">
              Protects profitability: (Agreed Price - Cost Price) / Agreed Price &ge; Min Margin %
            </p>
          </div>

          {/* Numerical Thresholds */}
          <div className="grid sm:grid-cols-3 gap-4 pt-4 border-t border-zinc-800/80">
            <div>
              <label className="block text-xs font-semibold text-zinc-200 mb-1.5">
                Autonomous Order Limit (₹)
              </label>
              <input
                type="number"
                required
                value={autonomousOrderLimit}
                onChange={(e) => setAutonomousOrderLimit(Number(e.target.value))}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
              />
              <span className="text-[10px] text-zinc-500 block mt-1">
                AI auto-approves below this value
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-200 mb-1.5">
                HITL Approval Threshold (₹)
              </label>
              <input
                type="number"
                required
                value={approvalThreshold}
                onChange={(e) => setApprovalThreshold(Number(e.target.value))}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
              />
              <span className="text-[10px] text-zinc-500 block mt-1">
                Locks quote in DRAFT for manager
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-200 mb-1.5">
                Max Quantity Per Order
              </label>
              <input
                type="number"
                required
                value={maxQuantityPerOrder}
                onChange={(e) => setMaxQuantityPerOrder(Number(e.target.value))}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
              />
              <span className="text-[10px] text-zinc-500 block mt-1">
                Prevents warehouse inventory dry-out
              </span>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-xs font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving Guardrails...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Save & Enforce Policy</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
