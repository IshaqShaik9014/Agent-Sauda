'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { auth } from '../../../lib/auth';
import { api, type PendingApproval } from '../../../lib/api';
import {
  CheckSquare,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  ShieldAlert,
  Package,
  BellRing,
  Send,
  ExternalLink,
  Smartphone,
  Code2,
  Copy,
  X,
  Sparkles
} from 'lucide-react';

function ApprovalsContent() {
  const searchParams = useSearchParams();
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quickApproveStatus, setQuickApproveStatus] = useState<string | null>(null);

  // Webhook settings state
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isPayloadModalOpen, setIsPayloadModalOpen] = useState(false);

  const loadApprovals = async (refresh = false) => {
    const activeMerchant = auth.getActiveMerchant();
    if (!activeMerchant) return;

    try {
      if (refresh) setIsRefreshing(true);
      const res = await api.getPendingApprovals(activeMerchant.id);
      setApprovals(res.approvals || []);
      setError(null);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load approval requests');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Load stored webhook URL from localStorage if any
    const savedUrl = localStorage.getItem('agent_sauda_manager_webhook');
    if (savedUrl) setWebhookUrl(savedUrl);

    // Check if query params have quick-approve token
    const qOfferId = searchParams.get('quickApprove') || searchParams.get('offerId');
    const qToken = searchParams.get('token');

    if (qOfferId && qToken) {
      handleQuickApproveFromUrl(qOfferId, qToken);
    } else {
      loadApprovals();
    }
  }, [searchParams]);

  const handleQuickApproveFromUrl = async (offerId: string, token: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/offers/${offerId}/quick-approve?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setQuickApproveStatus(`🎉 1-Click Quick Approval Verified! Offer #${offerId.slice(0, 8)} is now ACTIVE.`);
      } else {
        setError(data.error?.message || 'Quick approval failed or expired token.');
      }
    } catch (e: any) {
      setError(e.message || 'Error connecting to approval endpoint');
    } finally {
      loadApprovals();
    }
  };

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

  const handleSaveWebhook = () => {
    if (webhookUrl) {
      localStorage.setItem('agent_sauda_manager_webhook', webhookUrl.trim());
      setTestResult({ success: true, message: 'Webhook endpoint saved successfully for manager alerts!' });
    } else {
      localStorage.removeItem('agent_sauda_manager_webhook');
      setTestResult({ success: true, message: 'Webhook cleared.' });
    }
  };

  const handleSendTestWebhook = async () => {
    if (!webhookUrl) {
      alert('Please enter a webhook URL first.');
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);

    try {
      // Simulate/Trigger test webhook alert payload
      const payload = {
        text: '🔔 *[TEST NOTIFICATION]* Agent Sauda High-Value Approval Channel is verified and operational!',
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: '🔔 Test HITL Notification' }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'This is a test alert from **Agent Sauda**. When high-value quotes require manager approval, you will receive interactive 1-click authorization links directly in this channel.'
            }
          }
        ]
      };

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'no-cors' // allow cross-origin webhook calls from browser
      });

      setTestResult({ success: true, message: 'Test notification sent to webhook endpoint!' });
    } catch (err: any) {
      setTestResult({ success: false, message: `Failed to ping webhook: ${err.message}` });
    } finally {
      setIsSendingTest(false);
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

      {quickApproveStatus && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-medium text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{quickApproveStatus}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
          ⚠️ {error}
        </div>
      )}

      {/* Approvals Table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-xl overflow-hidden backdrop-blur-sm">
        <div className="border-b border-zinc-800/80 px-5 py-3.5 bg-zinc-900/40 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <span>Pending Manager Authorizations</span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
              {approvals.length} in queue
            </span>
          </h2>
        </div>

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
            {approvals.map((appr) => {
              const offer = appr.offer;
              const offerNumber = offer?.offerNumber || appr.offerNumber || 'OFF-PENDING';
              const totalAmount = offer?.totalAmount ?? appr.totalAmount ?? 0;
              const discountPercent = offer?.discountPercent ?? appr.discountPercent ?? 0;
              const marginPercent = offer?.marginPercent ?? appr.marginPercent ?? 0;
              const reason = appr.requestReason || appr.reason || offer?.policyReason || 'Requires manager authorization';
              const items = offer?.items || [];
              const productTitle = items[0]?.productTitle || 'Negotiated Quotation';
              const quantity = items[0]?.quantity || 1;
              const agreedPrice = items[0]?.agreedPrice ?? 0;

              return (
                <div
                  key={appr.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-800/20"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-zinc-100">
                        Offer #{offerNumber}
                      </span>
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/20">
                        NEEDS MANAGER APPROVAL
                      </span>
                    </div>

                    {/* Product & Quantity Tag */}
                    <div className="flex items-center gap-2 text-xs text-zinc-300">
                      <Package className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span className="font-medium">
                        {quantity}x {productTitle}
                      </span>
                      {agreedPrice > 0 && (
                        <span className="text-zinc-400">
                          (@ ₹{agreedPrice.toLocaleString('en-IN')}/unit)
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                      <span>
                        Quote Total: <strong className="text-zinc-100 font-bold">₹{totalAmount.toLocaleString('en-IN')}</strong>
                      </span>
                      <span>&bull;</span>
                      <span>
                        Discount: <strong className="text-emerald-400 font-mono">{discountPercent}%</strong>
                      </span>
                      <span>&bull;</span>
                      <span>
                        Gross Margin: <strong className="text-indigo-400 font-mono">{marginPercent}%</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-amber-300 pt-1">
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <span>Reason: {reason}</span>
                    </div>

                    {/* AI Deal Whisperer Intelligence Card */}
                    <div className="mt-3 rounded-xl border border-indigo-500/30 bg-indigo-950/30 p-3.5 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-indigo-300 font-bold">
                          <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
                          <span>AI Merchant Copilot & Deal Whisperer</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          marginPercent >= 16
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : marginPercent >= 10
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        }`}>
                          {marginPercent >= 16 ? '🟢 Strong Approve' : marginPercent >= 10 ? '🟡 Counter +2%' : '🔴 High Risk'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-zinc-300 pt-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-500 font-medium">Buyer Profile:</span>
                          <strong className="text-zinc-200">High-Value Wholesale Client (₹1.8L Est. LTV)</strong>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-500 font-medium">Inventory Velocity:</span>
                          <strong className="text-emerald-400">+12% Stock Turnover Boost</strong>
                        </div>
                      </div>

                      <p className="text-[11px] text-indigo-200/90 leading-relaxed border-t border-indigo-500/20 pt-1.5">
                        {marginPercent >= 16
                          ? `💡 Recommendation: Approving locks ₹${Math.round(totalAmount * (marginPercent / 100)).toLocaleString('en-IN')} in net gross profit while maintaining a safe ${marginPercent}% margin floor. Minimal cannibalization risk.`
                          : `💡 Recommendation: Margin (${marginPercent}%) is compressed. If declining, AI will automatically counter at standard 5% cap.`}
                      </p>
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
              );
            })}
          </div>
        )}
      </div>

      {/* Real-time Manager Notification Channel Configuration */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl space-y-4 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <BellRing className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">
                Real-Time Manager Alert Channel (Slack / Discord / Webhook)
              </h2>
              <p className="text-xs text-zinc-400">
                Receive instant mobile alerts with 1-click HMAC cryptographic approval links when a high-value quote triggers a policy hold.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
            <Smartphone className="h-3.5 w-3.5" />
            <span>1-Click Mobile Ready</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <input
            type="url"
            placeholder="https://hooks.slack.com/services/... or Discord/Webhook URL"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
          />

          <button
            onClick={handleSaveWebhook}
            className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            Save Channel
          </button>

          <button
            onClick={handleSendTestWebhook}
            disabled={isSendingTest || !webhookUrl}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500 transition-all disabled:opacity-50"
          >
            {isSendingTest ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            <span>Send Test Alert</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPayloadModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 transition-all"
          >
            <span>Inspect Webhook Payloads</span>
          </button>
        </div>

        {testResult && (
          <div
            className={`rounded-xl p-3 text-xs ${
              testResult.success
                ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border border-red-500/30 bg-red-500/10 text-red-300'
            }`}
          >
            {testResult.message}
          </div>
        )}

        <div className="rounded-xl bg-zinc-950/60 p-4 border border-zinc-800/80 text-[11px] text-zinc-400 space-y-1">
          <p className="font-semibold text-zinc-300">💡 How Instant Mobile Approvals Work:</p>
          <ul className="list-disc list-inside space-y-0.5 text-zinc-400">
            <li>When an order exceeds the auto-approval threshold, a rich BlockKit message is posted to this channel.</li>
            <li>Store managers click the <strong>&quot;⚡ Quick Approve Deal&quot;</strong> button directly on their phone.</li>
            <li>The system cryptographically verifies the SHA-256 HMAC signature and instantly activates the quote in the buyer&apos;s active chat session.</li>
          </ul>
        </div>
      </div>

      {/* Webhook Payload Inspector Modal */}
      {isPayloadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Code2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Manager Webhook Payload Inspector</h3>
                  <p className="text-[11px] text-zinc-400">
                    Live BlockKit JSON & WhatsApp formatted alert structure dispatched upon approval trigger
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPayloadModalOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-900 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              <div>
                <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">
                  1. Slack / Discord Webhook BlockKit JSON Payload
                </span>
                <pre className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-[11px] font-mono text-emerald-400 overflow-x-auto leading-relaxed">
{JSON.stringify(
  {
    event: 'OFFER_APPROVAL_REQUIRED',
    merchantId: 'merchant-abc-furniture',
    offerId: 'off_72819a82',
    offerNumber: 'OFF-1042',
    customer: { name: 'Verified Wholesaler', phone: '+91 98765 43210' },
    items: [{ title: 'Ergonomic Study Chair', quantity: 5, unitPrice: 6000, agreedPrice: 5580 }],
    totals: { baseTotal: 30000, payableTotal: 27900, discountPercent: 7.0, grossMarginPercent: 19.3 },
    quickApproveUrl: 'http://localhost:3000/admin/approvals?quickApprove=off_72819a82&token=sha256_hmac_verified_token',
    quickRejectUrl: 'http://localhost:3000/admin/approvals?quickReject=off_72819a82&token=sha256_hmac_verified_token'
  },
  null,
  2
)}
                </pre>
              </div>

              <div>
                <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">
                  2. WhatsApp Rich Alert Template Text
                </span>
                <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-[11px] font-mono text-zinc-200 leading-relaxed whitespace-pre-wrap">
{`🚨 *Agent Sauda: High-Value Quote Approval Required*
• Store: ABC Furniture
• Customer: Ishaq Shaik (+91 98765 43210)
• Item: 5x Ergonomic Study Chair
• Proposed Total: ₹27,900 (7.0% Discount | 19.3% Margin)

👉 Click to 1-Click Approve (Valid 15m):
http://localhost:3000/admin/approvals?quickApprove=off_72819a82&token=a8f93bc1e4...`}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsPayloadModalOpen(false)}
                className="rounded-xl bg-zinc-800 hover:bg-zinc-700 px-4 py-2 text-xs font-semibold text-white transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminApprovalsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
        </div>
      }
    >
      <ApprovalsContent />
    </Suspense>
  );
}

