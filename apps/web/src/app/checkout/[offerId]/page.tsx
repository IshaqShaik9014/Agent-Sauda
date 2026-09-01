'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '../../../components/Navbar';
import { PaymentModal } from '../../../components/PaymentModal';
import { api } from '../../../lib/api';
import { openRazorpayCheckout } from '../../../lib/razorpay';
import type { OfferResponse, RazorpayCheckoutPayload } from '@agent-sauda/domain';
import {
  ShieldCheck,
  CreditCard,
  Tag,
  ArrowRight,
  Loader2,
  Lock,
  ArrowLeft,
  CheckCircle,
  Truck,
  MapPin,
  AlertCircle
} from 'lucide-react';

interface PageProps {
  params: Promise<{ offerId: string }>;
}

export default function CheckoutPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const offerId = resolvedParams.offerId;
  const router = useRouter();

  const [offer, setOffer] = useState<OfferResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form inputs
  const [buyerName, setBuyerName] = useState('Ishaq Shaik');
  const [buyerEmail, setBuyerEmail] = useState('ishaq@agent-sauda.com');
  const [buyerPhone, setBuyerPhone] = useState('+91 9876543210');
  const [shippingAddress, setShippingAddress] = useState('H-104 Cyber City, Hyderabad, TS, 500081');
  const [deliveryNotes, setDeliveryNotes] = useState('Please call prior to delivery.');

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [activePaymentPayload, setActivePaymentPayload] = useState<RazorpayCheckoutPayload | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  useEffect(() => {
    async function loadOffer() {
      try {
        setIsLoading(true);
        const res = await api.getOffer(offerId);
        setOffer(res.offer);
      } catch (err: unknown) {
        setError((err as Error).message || 'Failed to load quotation details');
      } finally {
        setIsLoading(false);
      }
    }

    loadOffer();
  }, [offerId]);

  const handleInitiateCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offer) return;

    try {
      setIsProcessingOrder(true);
      setError(null);

      // Step 1: Convert accepted quote to order with atomic stock reservation
      const orderRes = await api.createOrderFromOffer({
        offerId: offer.id,
        notes: `${deliveryNotes} | Ship To: ${shippingAddress}`
      });
      const order = orderRes.order;
      setCreatedOrderId(order.id);

      // Step 2: Initiate Razorpay payment in integer paise
      const payRes = await api.initiatePayment(order.id);
      const checkoutPayload = payRes.payment.checkoutPayload;

      if (!checkoutPayload) {
        throw new Error('Missing Razorpay checkout payload from backend');
      }

      setActivePaymentPayload(checkoutPayload);

      // Step 3: Attempt live Razorpay SDK or fallback to test simulation modal
      const openedLive = await openRazorpayCheckout(
        checkoutPayload,
        async (response) => {
          await handleVerifyAndCompletePayment({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature
          }, order.id);
        },
        (failErr) => {
          console.warn('Payment failed or dismissed:', failErr);
          setIsPaymentModalOpen(true);
        }
      );

      if (!openedLive) {
        // Open simulation modal in local dev
        setIsPaymentModalOpen(true);
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to initiate order checkout');
    } finally {
      setIsProcessingOrder(false);
    }
  };

  const handleVerifyAndCompletePayment = async (
    details: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string },
    orderIdToVerify?: string
  ) => {
    const targetOrderId = orderIdToVerify || createdOrderId;
    if (!targetOrderId) {
      alert('Missing order ID to verify payment');
      return;
    }

    try {
      await api.verifyPayment({
        orderId: targetOrderId,
        razorpayOrderId: details.razorpayOrderId,
        razorpayPaymentId: details.razorpayPaymentId,
        razorpaySignature: details.razorpaySignature
      });

      setIsPaymentModalOpen(false);
      // Redirect to live order tracking timeline
      router.push(`/orders/${targetOrderId}/track`);
    } catch (err: unknown) {
      alert(`Signature verification failed: ${(err as Error).message}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400 mb-3" />
        <p className="text-sm font-medium text-zinc-400">Loading Order Review...</p>
      </div>
    );
  }

  if (error && !offer) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100 p-4">
        <AlertCircle className="h-10 w-10 text-red-400 mb-3" />
        <h2 className="text-base font-bold">Could Not Load Quotation</h2>
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

  const currency = offer?.merchant?.currency || 'INR';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col antialiased">
      <Navbar merchantName={offer?.merchant?.name} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Breadcrumb Back */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Negotiation Chat</span>
          </button>

          <div className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <Lock className="h-3.5 w-3.5" />
            <span>256-Bit Encrypted Checkout</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Left Column: Shipping & Details Form */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl backdrop-blur-sm">
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2 mb-1">
                <Truck className="h-5 w-5 text-emerald-400" />
                Shipping & Delivery Information
              </h2>
              <p className="text-xs text-zinc-400 mb-5">
                Enter delivery contact and destination for your negotiated order
              </p>

              <form onSubmit={handleInitiateCheckout} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={buyerEmail}
                      onChange={(e) => setBuyerEmail(e.target.value)}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Phone Number (for Courier Tracking)
                  </label>
                  <input
                    type="tel"
                    required
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Complete Shipping Address
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Delivery Instructions / Notes
                  </label>
                  <input
                    type="text"
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {error && (
                  <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-xs text-red-300 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isProcessingOrder}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-xs font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all disabled:opacity-50 mt-2"
                >
                  {isProcessingOrder ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Reserving Stock & Connecting Razorpay...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" />
                      <span>
                        Pay ₹{offer?.totalAmount.toLocaleString('en-IN')} via Razorpay
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Order Summary Card */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
                <span className="text-sm font-bold text-zinc-100">Quotation Summary</span>
                <span className="text-xs font-mono text-emerald-400 font-semibold">
                  #{offer?.offerNumber}
                </span>
              </div>

              {/* Line Items */}
              <div className="divide-y divide-zinc-800/60 space-y-3 pb-4">
                {offer?.items.map((item) => (
                  <div key={item.id} className="pt-3 first:pt-0 flex justify-between text-xs">
                    <div>
                      <span className="font-semibold text-zinc-200">{item.productTitle}</span>
                      <span className="block text-[11px] text-zinc-500">Qty: {item.quantity}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-zinc-100">
                        ₹{item.subtotal.toLocaleString('en-IN')}
                      </span>
                      {item.agreedPrice < item.unitPrice && (
                        <span className="block text-[10px] text-zinc-500 line-through">
                          ₹{(item.unitPrice * item.quantity).toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Price Breakdown */}
              <div className="border-t border-zinc-800 pt-3 space-y-2 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Catalog Base Value</span>
                  <span>₹{offer?.subtotal.toLocaleString('en-IN')}</span>
                </div>

                {(offer?.discountAmount ?? 0) > 0 && (
                  <div className="flex justify-between text-emerald-400 font-medium">
                    <span className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      Negotiated Savings ({offer?.discountPercent}%)
                    </span>
                    <span>-₹{offer?.discountAmount.toLocaleString('en-IN')}</span>
                  </div>
                )}

                <div className="flex justify-between text-zinc-400">
                  <span>Estimated Taxes (GST)</span>
                  <span>₹0.00 (Included)</span>
                </div>

                <div className="border-t border-zinc-800 pt-3 flex justify-between items-baseline text-sm font-bold">
                  <span className="text-zinc-100">Final Total</span>
                  <div className="text-right">
                    <span className="text-xl font-extrabold text-emerald-400">
                      ₹{offer?.totalAmount.toLocaleString('en-IN')}
                    </span>
                    <span className="ml-1 text-[10px] text-zinc-500">{currency}</span>
                  </div>
                </div>
              </div>

              {/* Inventory Guarantee */}
              <div className="mt-5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 p-3 text-[11px] text-emerald-300 flex items-start gap-2">
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                <span>
                  <strong>Two-Phase Inventory Lock:</strong> Stock is allocated during checkout and permanently deducted upon Razorpay capture.
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Test Payment Simulation Modal */}
      {activePaymentPayload && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          payload={activePaymentPayload}
          onConfirmSuccess={async (details) => {
            await handleVerifyAndCompletePayment(details);
          }}
          onSimulateFailure={(err) => setError(`Payment simulation error: ${err}`)}
        />
      )}
    </div>
  );
}
