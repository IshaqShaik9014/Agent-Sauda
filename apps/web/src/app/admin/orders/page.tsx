'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { auth } from '../../../lib/auth';
import { api } from '../../../lib/api';
import type { OrderResponse } from '@agent-sauda/domain';
import {
  ShoppingBag,
  Truck,
  PackageCheck,
  RefreshCw,
  Loader2,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  Clock,
  X
} from 'lucide-react';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

  // Dispatch Modal State
  const [dispatchModalOrder, setDispatchModalOrder] = useState<OrderResponse | null>(null);
  const [carrier, setCarrier] = useState('BlueDart Express');
  const [trackingNumber, setTrackingNumber] = useState('');

  const loadOrders = async (refresh = false) => {
    const activeMerchant = auth.getActiveMerchant();
    if (!activeMerchant) return;

    try {
      if (refresh) setIsRefreshing(true);
      const res = await api.getMerchantOrders(activeMerchant.id, statusFilter || undefined);
      setOrders(res.orders);
    } catch (err: unknown) {
      alert(`Could not load orders: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  const handleStartFulfillment = async (orderId: string) => {
    const activeMerchant = auth.getActiveMerchant();
    if (!activeMerchant) return;

    try {
      setProcessingOrderId(orderId);
      await api.startFulfillment(activeMerchant.id, orderId, 'Started packaging in warehouse');
      await loadOrders(true);
    } catch (err: unknown) {
      alert(`Could not start fulfillment: ${(err as Error).message}`);
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleConfirmDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeMerchant = auth.getActiveMerchant();
    if (!activeMerchant || !dispatchModalOrder) return;

    try {
      setProcessingOrderId(dispatchModalOrder.id);
      await api.fulfillOrder(activeMerchant.id, dispatchModalOrder.id, carrier, trackingNumber);
      setDispatchModalOrder(null);
      await loadOrders(true);
    } catch (err: unknown) {
      alert(`Could not complete dispatch: ${(err as Error).message}`);
    } finally {
      setProcessingOrderId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'FULFILLMENT_PENDING':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'COMPLETED':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'PAYMENT_PENDING':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'CANCELLED':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-emerald-400" />
            Orders & Fulfillment Pipeline
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Track customer orders and manage warehouse packaging and courier dispatch
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Status filter chips */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
          >
            <option value="">All Order Statuses</option>
            <option value="PAID">Paid (Ready for Packaging)</option>
            <option value="FULFILLMENT_PROCESSING">In Packaging</option>
            <option value="COMPLETED">Completed / Shipped</option>
            <option value="PAYMENT_PENDING">Payment Pending</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <button
            onClick={() => loadOrders(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-xl overflow-hidden backdrop-blur-sm">
        {isLoading ? (
          <div className="flex h-48 flex-col items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-400 mb-2" />
            <p className="text-xs text-zinc-400">Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-400 space-y-2">
            <ShoppingBag className="h-8 w-8 mx-auto text-zinc-600" />
            <p className="font-semibold text-zinc-200">No Orders Found</p>
            <p className="text-zinc-500">
              When buyers complete checkout, orders will appear here for fulfillment dispatch.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/60 border-b border-zinc-800 text-zinc-400">
                <tr>
                  <th className="p-4 font-semibold">Order Number</th>
                  <th className="p-4 font-semibold">Items</th>
                  <th className="p-4 font-semibold text-right">Total Amount</th>
                  <th className="p-4 font-semibold text-center">Status</th>
                  <th className="p-4 font-semibold">Delivery Notes</th>
                  <th className="p-4 font-semibold text-right">Fulfillment Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-zinc-800/20">
                    <td className="p-4 font-medium text-zinc-100">
                      <div className="font-semibold font-mono text-zinc-100">
                        #{order.orderNumber}
                      </div>
                      <span className="text-[10px] text-zinc-500">
                        {new Date(order.createdAt).toLocaleString([], {
                          dateStyle: 'short',
                          timeStyle: 'short'
                        })}
                      </span>
                    </td>
                    <td className="p-4 text-zinc-300">
                      {order.items?.length || 0} line items
                    </td>
                    <td className="p-4 text-right font-bold text-emerald-400">
                      ₹{order.totalAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border uppercase ${getStatusBadge(
                          order.status
                        )}`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="p-4 text-zinc-400 max-w-[200px] truncate">
                      {order.notes || 'Standard Delivery'}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      {order.status === 'PAID' && (
                        <button
                          onClick={() => handleStartFulfillment(order.id)}
                          disabled={processingOrderId === order.id}
                          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors disabled:opacity-50"
                        >
                          <Truck className="h-3.5 w-3.5" />
                          <span>Start Packing</span>
                        </button>
                      )}

                      {order.status === 'FULFILLMENT_PENDING' && (
                        <button
                          onClick={() => {
                            setDispatchModalOrder(order);
                            setTrackingNumber(`BD-EXP-${Date.now().toString(36).toUpperCase()}`);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-zinc-950 hover:bg-emerald-400 transition-colors"
                        >
                          <PackageCheck className="h-3.5 w-3.5" />
                          <span>Dispatch Courier</span>
                        </button>
                      )}

                      <Link
                        href={`/orders/${order.id}/track`}
                        target="_blank"
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
                      >
                        <span>Timeline</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Courier Dispatch Modal */}
      {dispatchModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Truck className="h-4 w-4 text-emerald-400" />
                Dispatch Order #{dispatchModalOrder.orderNumber}
              </h3>
              <button
                onClick={() => setDispatchModalOrder(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmDispatch} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Courier Carrier Partner
                </label>
                <input
                  type="text"
                  required
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  placeholder="e.g. BlueDart Express / Delhivery"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Courier Tracking Waybill Number
                </label>
                <input
                  type="text"
                  required
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="e.g. BD-EXP-12345678"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-100 font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={processingOrderId === dispatchModalOrder.id}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all disabled:opacity-50"
                >
                  {processingOrderId === dispatchModalOrder.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span>Confirm Dispatch & Mark Completed</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
