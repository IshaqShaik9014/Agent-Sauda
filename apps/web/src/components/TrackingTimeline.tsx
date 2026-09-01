'use client';

import React from 'react';
import {
  CheckCircle2,
  Clock,
  Package,
  CreditCard,
  Truck,
  Sparkles,
  MapPin
} from 'lucide-react';
import type { OrderTimelineEvent } from '@agent-sauda/domain';

interface TrackingTimelineProps {
  timeline: OrderTimelineEvent[];
  carrier?: string | null;
  trackingNumber?: string | null;
}

export function TrackingTimeline({
  timeline,
  carrier,
  trackingNumber
}: TrackingTimelineProps) {
  const getStepIcon = (step: string, completed: boolean) => {
    switch (step) {
      case 'OFFER_ACCEPTED':
        return <Sparkles className={`h-4 w-4 ${completed ? 'text-emerald-400' : 'text-zinc-500'}`} />;
      case 'ORDER_CREATED':
        return <Package className={`h-4 w-4 ${completed ? 'text-emerald-400' : 'text-zinc-500'}`} />;
      case 'PAYMENT_CAPTURED':
        return <CreditCard className={`h-4 w-4 ${completed ? 'text-emerald-400' : 'text-zinc-500'}`} />;
      case 'FULFILLMENT_PROCESSING':
        return <Truck className={`h-4 w-4 ${completed ? 'text-emerald-400' : 'text-zinc-500'}`} />;
      case 'ORDER_DELIVERED_COMPLETED':
        return <CheckCircle2 className={`h-4 w-4 ${completed ? 'text-emerald-400' : 'text-zinc-500'}`} />;
      default:
        return <Clock className="h-4 w-4 text-zinc-500" />;
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
        <div>
          <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <Truck className="h-4 w-4 text-emerald-400" />
            Live Fulfillment Timeline
          </h3>
          <p className="text-[11px] text-zinc-400">
            Real-time milestone progression from quotation to physical delivery
          </p>
        </div>
      </div>

      {/* Stepper List */}
      <div className="relative pl-6 space-y-6">
        {/* Continuous background line */}
        <div className="absolute left-[19px] top-3 bottom-3 w-0.5 bg-zinc-800" />

        {timeline.map((event, idx) => {
          const isDone = event.completed;
          const isCurrent = isDone && (idx === timeline.length - 1 || !timeline[idx + 1]?.completed);

          return (
            <div key={event.step} className="relative flex items-start gap-4">
              {/* Node Icon */}
              <div
                className={`relative z-10 -ml-6 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                  isDone
                    ? 'border-emerald-500 bg-zinc-950 text-emerald-400 shadow-md shadow-emerald-950/40'
                    : 'border-zinc-700 bg-zinc-950 text-zinc-600'
                }`}
              >
                {getStepIcon(event.step, isDone)}
              </div>

              {/* Event Content */}
              <div className="flex-1 pt-0.5">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span
                    className={`text-xs font-semibold ${
                      isDone ? 'text-zinc-100' : 'text-zinc-500'
                    }`}
                  >
                    {event.title}
                  </span>

                  {isCurrent && (
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-400 border border-emerald-500/30 uppercase animate-pulse">
                      In Progress
                    </span>
                  )}

                  {event.timestamp && (
                    <span className="text-[10px] text-zinc-500">
                      {new Date(event.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  )}
                </div>

                <p className="mt-0.5 text-[11px] text-zinc-400 leading-relaxed">
                  {event.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Shipping Details Card */}
      {(carrier || trackingNumber) && (
        <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300 mb-2">
            <MapPin className="h-4 w-4 text-emerald-400" />
            <span>Courier Dispatch Information</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300">
            <div>
              <span className="text-[10px] text-zinc-500 block">Courier Carrier:</span>
              <span className="font-medium text-zinc-100">{carrier || 'Standard Courier'}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 block">Tracking Number:</span>
              <span className="font-mono text-emerald-400 font-bold">{trackingNumber || 'Pending'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
