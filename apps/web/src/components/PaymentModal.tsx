'use client';

import React, { useState } from 'react';
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Zap,
  Loader2,
  X,
  Smartphone,
  Building,
  Lock
} from 'lucide-react';
import type { RazorpayCheckoutPayload } from '@agent-sauda/domain';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  payload: RazorpayCheckoutPayload;
  onConfirmSuccess: (paymentDetails: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) => Promise<void>;
  onSimulateFailure?: (error: string) => void;
}

export function PaymentModal({
  isOpen,
  onClose,
  payload,
  onConfirmSuccess,
  onSimulateFailure
}: PaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handlePaySuccess = async () => {
    try {
      setIsProcessing(true);
      const mockPaymentId = `pay_mock_${Date.now()}`;
      const mockSignature = `sig_mock_${Math.random().toString(36).substring(2, 15)}`;

      await onConfirmSuccess({
        razorpayOrderId: payload.razorpayOrderId,
        razorpayPaymentId: mockPaymentId,
        razorpaySignature: mockSignature
      });
    } catch (err: unknown) {
      alert(`Payment verification failed: ${(err as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayFailure = () => {
    if (onSimulateFailure) {
      onSimulateFailure('Card declined by bank simulator');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-zinc-100">Razorpay Secure Checkout</span>
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[9px] font-bold text-emerald-400 uppercase">
                  Test Mode
                </span>
              </div>
              <p className="text-[10px] text-zinc-400">{payload.merchantName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Order Summary Ribbon */}
        <div className="border-b border-zinc-800/80 bg-zinc-950/50 px-5 py-3 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-zinc-400">Amount Payable</span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-extrabold text-emerald-400">
                ₹{payload.amountInRupees.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-zinc-500">
                ({payload.amountInPaise.toLocaleString('en-IN')} paise)
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-zinc-500">Order ID</span>
            <p className="text-[11px] font-mono text-zinc-300 truncate max-w-[140px]">
              {payload.razorpayOrderId}
            </p>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Select Payment Method
            </span>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedMethod('upi')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                  selectedMethod === 'upi'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <Smartphone className="h-5 w-5 mb-1" />
                <span className="text-[11px] font-semibold">UPI / QR</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod('card')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                  selectedMethod === 'card'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <CreditCard className="h-5 w-5 mb-1" />
                <span className="text-[11px] font-semibold">Card</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod('netbanking')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                  selectedMethod === 'netbanking'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <Building className="h-5 w-5 mb-1" />
                <span className="text-[11px] font-semibold">Net Banking</span>
              </button>
            </div>
          </div>

          {/* Prefill details */}
          <div className="rounded-xl bg-zinc-950/60 p-3 border border-zinc-800/80 text-xs space-y-1">
            <div className="flex justify-between text-zinc-400">
              <span>Customer:</span>
              <span className="text-zinc-200">{payload.prefill?.name || 'Customer'}</span>
            </div>
            {payload.prefill?.email && (
              <div className="flex justify-between text-zinc-400">
                <span>Email:</span>
                <span className="text-zinc-200">{payload.prefill.email}</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-[10px] text-emerald-400 pt-1 border-t border-zinc-800/60">
              <Lock className="h-3 w-3" />
              <span>256-Bit SSL Encrypted Payment Simulation</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              onClick={handlePaySuccess}
              disabled={isProcessing}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-xs font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verifying HMAC Signature...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Simulate Successful Payment (₹{payload.amountInRupees.toLocaleString('en-IN')})</span>
                </>
              )}
            </button>

            <button
              onClick={handlePayFailure}
              disabled={isProcessing}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-red-400 transition-colors disabled:opacity-50"
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>Simulate Payment Decline / Cancel</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
