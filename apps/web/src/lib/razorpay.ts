import type { RazorpayCheckoutPayload } from '@agent-sauda/domain';

export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

/**
 * Dynamically loads the Razorpay Standard Checkout script.
 */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Opens Razorpay Standard Checkout modal or falls back to test simulator.
 */
export async function openRazorpayCheckout(
  payload: RazorpayCheckoutPayload,
  onSuccess: (response: RazorpaySuccessResponse) => void,
  onFailure: (error: any) => void
): Promise<boolean> {
  const isLoaded = await loadRazorpayScript();

  // If live key is provided and script loaded, open standard Razorpay modal
  if (isLoaded && (window as any).Razorpay && !payload.keyId.includes('mock')) {
    try {
      const options = {
        key: payload.keyId,
        amount: payload.amountInPaise,
        currency: payload.currency,
        name: payload.merchantName,
        description: `Order #${payload.orderNumber}`,
        order_id: payload.razorpayOrderId,
        prefill: {
          name: payload.prefill?.name || '',
          email: payload.prefill?.email || '',
          contact: payload.prefill?.contact || ''
        },
        theme: {
          color: '#10b981' // Emerald 500
        },
        handler: (response: RazorpaySuccessResponse) => {
          onSuccess(response);
        },
        modal: {
          ondismiss: () => {
            onFailure(new Error('Payment modal closed by user'));
          }
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', (response: any) => {
        onFailure(response.error);
      });
      rzp.open();
      return true;
    } catch (err) {
      console.warn('Razorpay SDK error, falling back to simulated modal:', err);
      return false;
    }
  }

  // Fallback to simulated payment modal
  return false;
}
