'use client';

import React, { useState } from 'react';
import {
  CheckCircle,
  Clock,
  Tag,
  ArrowRight,
  ShieldAlert,
  Loader2,
  XCircle,
  Sparkles,
  FileText
} from 'lucide-react';
import type { OfferResponse, SupportedCurrency } from '@agent-sauda/domain';
import { formatCurrencyAmount } from '@agent-sauda/domain';
import { InvoiceModal, type InvoiceData } from './InvoiceModal';

interface OfferCardProps {
  offer: OfferResponse;
  currency?: SupportedCurrency;
  onAccept?: (offerId: string) => Promise<void>;
  onReject?: (offerId: string) => Promise<void>;
  onProceedToCheckout?: (offerId: string) => void;
}

export function OfferCard({
  offer,
  currency = 'INR',
  onAccept,
  onReject,
  onProceedToCheckout
}: OfferCardProps) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);

  const handleAccept = async () => {
    if (!onAccept) {
      if (onProceedToCheckout) onProceedToCheckout(offer.id);
      return;
    }
    try {
      setIsAccepting(true);
      await onAccept(offer.id);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!onReject) return;
    try {
      setIsRejecting(true);
      await onReject(offer.id);
    } finally {
      setIsRejecting(false);
    }
  };

  const isDraft = offer.status === 'DRAFT';
  const isAccepted = offer.status === 'ACCEPTED';
  const isRejected = offer.status === 'REJECTED';
  const isExpired = offer.isExpired || offer.status === 'EXPIRED';
  const activeCurrency = currency || (offer.merchant?.currency as SupportedCurrency) || 'INR';

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-emerald-500/30 bg-zinc-900/90 shadow-lg shadow-emerald-950/20 backdrop-blur-sm transition-all hover:border-emerald-500/50">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-emerald-500/20 text-emerald-400">
            <Tag className="h-3.5 w-3.5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-200">
              Formal Quote #{offer.offerNumber}
            </span>
            <button
              type="button"
              onClick={() => setIsInvoiceOpen(true)}
              title="Export Proforma Tax Quote (PDF / Print)"
              className="inline-flex items-center gap-1 rounded-md border border-zinc-700/80 bg-zinc-800/80 px-2 py-0.5 text-[10px] font-semibold text-zinc-300 hover:bg-zinc-700 hover:text-white transition"
            >
              <FileText className="h-3 w-3 text-indigo-400" />
              <span>PDF Quote</span>
            </button>
          </div>
        </div>

        {/* Status Badges */}
        <div>
          {isDraft && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-400 border border-amber-500/20">
              <ShieldAlert className="h-3 w-3" />
              Pending Manager Review
            </span>
          )}
          {isAccepted && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
              <CheckCircle className="h-3 w-3" />
              Quote Accepted
            </span>
          )}
          {isRejected && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-[11px] font-medium text-red-400 border border-red-500/20">
              <XCircle className="h-3 w-3" />
              Quote Declined
            </span>
          )}
          {isExpired && (
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] font-medium text-zinc-400 border border-zinc-700">
              <Clock className="h-3 w-3" />
              Quote Expired
            </span>
          )}
          {!isDraft && !isAccepted && !isRejected && !isExpired && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/30 animate-pulse">
              <Sparkles className="h-3 w-3" />
              Active Offer
            </span>
          )}
        </div>
      </div>

      {/* Item Line Items */}
      <div className="divide-y divide-zinc-800/50 px-4 py-3">
        {offer.items.map((item) => {
          const hasDiscount = item.agreedPrice < item.unitPrice;
          return (
            <div key={item.id} className="flex items-center justify-between py-2 text-xs">
              <div className="flex flex-col">
                <span className="font-medium text-zinc-200">{item.productTitle}</span>
                <span className="text-[11px] text-zinc-400">Qty: {item.quantity}</span>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1.5 justify-end">
                  {hasDiscount && (
                    <span className="text-[11px] text-zinc-500 line-through">
                      {formatCurrencyAmount(item.unitPrice, activeCurrency)}
                    </span>
                  )}
                  <span className="font-semibold text-zinc-100">
                    {formatCurrencyAmount(item.agreedPrice, activeCurrency)}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-400">
                  Total: {formatCurrencyAmount(item.subtotal, activeCurrency)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Financial Totals & Discount Savings */}
      <div className="border-t border-zinc-800/80 bg-zinc-950/40 px-4 py-3">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>Catalog Base Price</span>
          <span>{formatCurrencyAmount(offer.subtotal, activeCurrency)}</span>
        </div>

        {offer.discountAmount > 0 && (
          <div className="mt-1 flex items-center justify-between text-xs text-emerald-400">
            <span className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              Negotiated Discount ({offer.discountPercent}%)
            </span>
            <span className="font-medium">-{formatCurrencyAmount(offer.discountAmount, activeCurrency)}</span>
          </div>
        )}

        <div className="mt-2.5 flex items-center justify-between border-t border-zinc-800 pt-2 text-sm">
          <span className="font-semibold text-zinc-200">Total Payable</span>
          <div className="text-right">
            <span className="text-base font-bold text-emerald-400">
              {formatCurrencyAmount(offer.totalAmount, activeCurrency)}
            </span>
            <span className="ml-1 text-[10px] text-zinc-500 font-mono">({activeCurrency})</span>
          </div>
        </div>

        {/* Expiration Note */}
        <div className="mt-2 flex items-center gap-1 text-[10px] text-zinc-400">
          <Clock className="h-3 w-3 text-amber-400" />
          <span>Valid for 24 hours (Guaranteed inventory reservation upon acceptance)</span>
        </div>
      </div>

      {/* CTA Action Buttons */}
      {!isAccepted && !isRejected && !isExpired && (
        <div className="flex items-center gap-2 border-t border-zinc-800/80 bg-zinc-950/70 p-3">
          {isDraft ? (
            <div className="w-full text-center py-1 text-xs text-amber-400 bg-amber-950/30 rounded-lg border border-amber-800/40">
              ⏳ Awaiting store manager review for high-value authorization.
            </div>
          ) : (
            <>
              <button
                onClick={handleReject}
                disabled={isRejecting || isAccepting}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors disabled:opacity-50"
              >
                {isRejecting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Decline'}
              </button>

              <button
                onClick={handleAccept}
                disabled={isAccepting || isRejecting}
                className="flex-[2] inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 shadow-md shadow-emerald-500/20 hover:bg-emerald-400 transition-all disabled:opacity-50"
              >
                {isAccepting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>Accept & Checkout</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </>
          )}
        </div>
      )}

      {isAccepted && onProceedToCheckout && (
        <div className="border-t border-zinc-800/80 bg-zinc-950/70 p-3">
          <button
            onClick={() => onProceedToCheckout(offer.id)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all"
          >
            <span>Proceed to Payment</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Formal Tax Proforma Quote Modal */}
      <InvoiceModal
        isOpen={isInvoiceOpen}
        onClose={() => setIsInvoiceOpen(false)}
        data={{
          documentType: 'PROFORMA_QUOTE',
          documentNumber: offer.offerNumber || 'QUOTE-ACTIVE',
          date: new Date(offer.createdAt).toLocaleDateString(),
          validUntil: offer.expiresAt ? new Date(offer.expiresAt).toLocaleDateString() : undefined,
          merchantName: offer.merchant?.name || 'Agent Sauda Storefront',
          merchantGstin: '29AABCU9603R1ZM',
          customerName: 'Verified B2B Buyer',
          customerPhone: '+91 98765 43210',
          customerEmail: 'buyer@enterprise.in',
          isCustomerVerified: true,
          items: offer.items.map((i) => ({
            id: i.id,
            productTitle: i.productTitle,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            agreedPrice: i.agreedPrice,
            subtotal: i.subtotal
          })),
          subtotal: offer.subtotal,
          discountAmount: offer.discountAmount,
          discountPercent: offer.discountPercent,
          totalAmount: offer.totalAmount,
          currency: activeCurrency,
          status: offer.status
        }}
      />
    </div>
  );
}
