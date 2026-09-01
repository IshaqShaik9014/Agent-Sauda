'use client';

import React, { useState, useEffect } from 'react';
import { MetricCard } from '../../components/MetricCard';
import { auth } from '../../lib/auth';
import { api } from '../../lib/api';
import type { CompleteAnalyticsDashboardResponse, TopProductPerformance } from '@agent-sauda/domain';
import {
  DollarSign,
  TrendingUp,
  Percent,
  Bot,
  Package,
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  RefreshCw,
  ShoppingBag
} from 'lucide-react';

export default function AdminOverviewPage() {
  const [analytics, setAnalytics] = useState<CompleteAnalyticsDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = async (refresh = false) => {
    const activeMerchant = auth.getActiveMerchant();
    if (!activeMerchant) return;

    try {
      if (refresh) setIsRefreshing(true);
      const res = await api.getCompleteAnalytics(activeMerchant.id);
      setAnalytics(res.dashboard);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load merchant analytics');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400 mb-2" />
        <p className="text-xs text-zinc-400">Aggregating commercial analytics...</p>
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-6 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-red-400 mb-2" />
        <h3 className="text-sm font-bold text-zinc-100">Analytics Unavailable</h3>
        <p className="text-xs text-zinc-400 mt-1">{error}</p>
        <button
          onClick={() => loadAnalytics(true)}
          className="mt-3 rounded-lg bg-zinc-800 px-3.5 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  const kpis = analytics?.commercialKPIs;
  const negotiation = analytics?.negotiationAnalytics;
  const approvals = analytics?.approvalPerformance;
  const topProducts: TopProductPerformance[] = analytics?.topProducts || [];

  return (
    <div className="space-y-6">
      {/* Top Title & Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">
            Commercial Analytics & Performance
          </h1>
          <p className="text-xs text-zinc-400">
            Real-time profit tracking, policy effectiveness, and AI negotiation metrics
          </p>
        </div>

        <button
          onClick={() => loadAnalytics(true)}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Gross Realized Revenue"
          value={`₹${(kpis?.grossRevenue || 0).toLocaleString('en-IN')}`}
          subtitle={`${kpis?.paidOrdersCount || 0} completed orders`}
          icon={DollarSign}
          color="emerald"
        />

        <MetricCard
          title="Net Realized Profit"
          value={`₹${(kpis?.netGrossProfit || 0).toLocaleString('en-IN')}`}
          subtitle={`Margin: ${kpis?.averageMarginPercent || 0}%`}
          icon={TrendingUp}
          color="indigo"
        />

        <MetricCard
          title="AI Negotiation Win Rate"
          value={`${negotiation?.negotiationWinRatePercent || 0}%`}
          subtitle={`${negotiation?.acceptedOffersCount || 0} accepted of ${negotiation?.totalOffersProposed || 0} quotes`}
          icon={Bot}
          color="amber"
        />

        <MetricCard
          title="Avg Discount Depth"
          value={`${negotiation?.averageDiscountPercent || 0}%`}
          subtitle="Governed by policy limits"
          icon={Percent}
          color="blue"
        />
      </div>

      {/* Two Column Layout: Negotiation Insights & Top Products */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left Column: Negotiation & Approvals Breakdown */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-xl backdrop-blur-sm">
            <h3 className="text-sm font-bold text-zinc-100 border-b border-zinc-800 pb-3 mb-4 flex items-center gap-2">
              <Bot className="h-4 w-4 text-emerald-400" />
              Autonomous Negotiation Health
            </h3>

            <div className="space-y-4 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                <span className="text-zinc-400">Total Quotes Proposed:</span>
                <span className="font-bold text-zinc-100">{negotiation?.totalOffersProposed || 0}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                <span className="text-zinc-400">Quotes Accepted by Buyers:</span>
                <span className="font-bold text-emerald-400">{negotiation?.acceptedOffersCount || 0}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                <span className="text-zinc-400">Quotes Rejected:</span>
                <span className="font-bold text-zinc-400">{negotiation?.rejectedOffersCount || 0}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                <span className="text-zinc-400">HITL Approval Requests:</span>
                <span className="font-bold text-amber-400">{approvals?.totalApprovalsRequested || 0}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-zinc-400">Manager Approval Rate:</span>
                <span className="font-bold text-indigo-400">{approvals?.approvalRatePercent || 0}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Top Performing Products */}
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-xl backdrop-blur-sm">
            <h3 className="text-sm font-bold text-zinc-100 border-b border-zinc-800 pb-3 mb-4 flex items-center gap-2">
              <Package className="h-4 w-4 text-emerald-400" />
              Top Products by Commercial Performance
            </h3>

            {topProducts.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">
                No product sales recorded yet. Once orders are completed, ranking will appear here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400">
                      <th className="pb-2 font-medium">Product</th>
                      <th className="pb-2 font-medium text-right">Units Sold</th>
                      <th className="pb-2 font-medium text-right">Revenue</th>
                      <th className="pb-2 font-medium text-right">Avg Unit Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {topProducts.map((prod: TopProductPerformance) => (
                      <tr key={prod.productId} className="hover:bg-zinc-800/30">
                        <td className="py-2.5 font-medium text-zinc-200 max-w-[180px] truncate">
                          {prod.title}
                        </td>
                        <td className="py-2.5 text-right text-zinc-300 font-mono">
                          {prod.unitsSold}
                        </td>
                        <td className="py-2.5 text-right font-medium text-emerald-400 font-bold">
                          ₹{prod.totalRevenue.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 text-right font-mono text-zinc-300">
                          ₹{prod.averageAgreedPrice.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
