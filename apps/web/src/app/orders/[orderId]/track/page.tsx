'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Navbar } from '../../../../components/Navbar';
import { TrackingTimeline } from '../../../../components/TrackingTimeline';
import { api } from '../../../../lib/api';
import type { OrderTrackingResponse } from '@agent-sauda/domain';
import {
  PackageCheck,
  RefreshCw,
  ArrowRight,
  Loader2,
  AlertCircle,
  Home,
  CheckCircle2,
  Receipt,
  Truck
} from 'lucide-react';

interface PageProps {
  params: Promise<{ orderId: string }>;
}

export default function OrderTrackingPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const orderId = resolvedParams.orderId;

  const [trackingData, setTrackingData] = useState<OrderTrackingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTracking = async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) setIsRefreshing(true);
      const res = await api.trackOrder(orderId);
      setTrackingData(res.tracking);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to fetch order tracking status');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTracking();
  }, [orderId]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400 mb-3" />
        <p className="text-sm font-medium text-zinc-400">Loading Order Tracking...</p>
      </div>
    );
  }

  if (error && !trackingData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100 p-4">
        <AlertCircle className="h-10 w-10 text-red-400 mb-3" />
        <h2 className="text-base font-bold">Tracking Information Unavailable</h2>
        <p className="text-xs text-zinc-400 mt-1">{error}</p>
        <Link
          href="/"
          className="mt-4 rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
        >
          Return Home
        </Link>
      </div>
    );
  }

  const isCompleted = trackingData?.status === 'COMPLETED';
  const currency = trackingData?.currency || 'INR';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col antialiased">
      <Navbar merchantName={trackingData?.merchant.name} />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Success Header Card */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-zinc-900 via-emerald-950/20 to-zinc-900 p-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <PackageCheck className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-zinc-100">
                    Order #{trackingData?.orderNumber}
                  </h1>
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                    {trackingData?.status}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Placed with <strong className="text-zinc-200">{trackingData?.merchant.name}</strong> &bull; Total Paid: <strong className="text-emerald-400">₹{trackingData?.totalAmount.toLocaleString('en-IN')} {currency}</strong>
                </p>
              </div>
            </div>

            <button
              onClick={() => fetchTracking(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/90 px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Refresh Status</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-12 gap-6">
          {/* Left Column: 5-Milestone Stepper */}
          <div className="md:col-span-7">
            {trackingData?.timeline && (
              <TrackingTimeline timeline={trackingData.timeline} />
            )}
          </div>

          {/* Right Column: Ordered Items & Next Action */}
          <div className="md:col-span-5 space-y-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl backdrop-blur-sm">
              <h3 className="text-sm font-bold text-zinc-100 border-b border-zinc-800 pb-3 mb-3 flex items-center gap-2">
                <Receipt className="h-4 w-4 text-emerald-400" />
                Purchased Line Items
              </h3>

              <div className="divide-y divide-zinc-800/60 space-y-2.5 pb-3">
                {trackingData?.items.map((item) => (
                  <div key={item.id} className="pt-2.5 first:pt-0 flex justify-between text-xs">
                    <div>
                      <span className="font-semibold text-zinc-200">{item.title}</span>
                      <span className="block text-[11px] text-zinc-500">Qty: {item.quantity}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-emerald-400">
                        ₹{item.total.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-zinc-800 pt-3 flex justify-between text-xs font-bold text-zinc-200">
                <span>Total Amount Paid</span>
                <span className="text-emerald-400 font-extrabold text-sm">
                  ₹{trackingData?.totalAmount.toLocaleString('en-IN')} {currency}
                </span>
              </div>
            </div>

            {/* Return to Home / Negotiate More */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 text-center space-y-3">
              <p className="text-xs text-zinc-400">
                Want to negotiate additional products or browse other stores?
              </p>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-zinc-800 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors"
              >
                <Home className="h-4 w-4" />
                <span>Return to Storefront Directory</span>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
