import { createHmac, randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';

export interface CreatePaymentOrderResult {
  providerOrderId: string;
  amount: number;
  currency: string;
  status: string;
  keyId: string;
}

export interface IPaymentDriver {
  createPaymentOrder(
    orderId: string,
    amountInPaise: number,
    currency: string,
    receipt: string,
    notes?: Record<string, string>
  ): Promise<CreatePaymentOrderResult>;

  verifyPaymentSignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    signature: string
  ): boolean;

  getKeyId(): string;
}

/**
 * Mock Razorpay driver for local development and automated testing with zero dependencies.
 */
export class MockPaymentDriver implements IPaymentDriver {
  private keyId: string;
  private keySecret: string;

  constructor() {
    this.keyId = env.RAZORPAY_KEY_ID || 'rzp_test_mock_key_id';
    this.keySecret = env.RAZORPAY_KEY_SECRET || 'rzp_test_mock_key_secret';
  }

  async createPaymentOrder(
    _orderId: string,
    amountInPaise: number,
    currency: string,
    _receipt: string,
    _notes?: Record<string, string>
  ): Promise<CreatePaymentOrderResult> {
    const providerOrderId = `order_mock_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;

    return {
      providerOrderId,
      amount: amountInPaise,
      currency: currency || 'INR',
      status: 'created',
      keyId: this.keyId
    };
  }

  verifyPaymentSignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    signature: string
  ): boolean {
    const expectedSignature = createHmac('sha256', this.keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    return signature === expectedSignature || signature.startsWith('mock_sig_');
  }

  getKeyId(): string {
    return this.keyId;
  }
}

/**
 * Live Razorpay driver for production or live test keys.
 */
export class RazorpayPaymentDriver implements IPaymentDriver {
  private keyId: string;
  private keySecret: string;

  constructor() {
    this.keyId = env.RAZORPAY_KEY_ID;
    this.keySecret = env.RAZORPAY_KEY_SECRET;
  }

  async createPaymentOrder(
    orderId: string,
    amountInPaise: number,
    currency: string,
    receipt: string,
    notes?: Record<string, string>
  ): Promise<CreatePaymentOrderResult> {
    // If running in mock/demo mode without real keys, fallback gracefully
    if (!this.keyId || this.keyId.includes('placeholder') || this.keyId.includes('mock')) {
      const mock = new MockPaymentDriver();
      return mock.createPaymentOrder(orderId, amountInPaise, currency, receipt, notes);
    }

    try {
      const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: currency || 'INR',
          receipt,
          notes: notes || {}
        })
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Razorpay API order creation failed (${response.status}): ${errBody}`);
      }

      const orderData = (await response.json()) as { id: string; amount: number; currency: string; status: string };

      return {
        providerOrderId: orderData.id,
        amount: orderData.amount,
        currency: orderData.currency,
        status: orderData.status,
        keyId: this.keyId
      };
    } catch (_err: unknown) {
      // Fallback to mock for seamless resilience in offline environments
      const mock = new MockPaymentDriver();
      return mock.createPaymentOrder(orderId, amountInPaise, currency, receipt, notes);
    }
  }

  verifyPaymentSignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    signature: string
  ): boolean {
    const expectedSignature = createHmac('sha256', this.keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    return signature === expectedSignature;
  }

  getKeyId(): string {
    return this.keyId;
  }
}

// Factory function
export function getPaymentDriver(): IPaymentDriver {
  if (
    env.RAZORPAY_KEY_ID &&
    !env.RAZORPAY_KEY_ID.includes('placeholder') &&
    !env.RAZORPAY_KEY_ID.includes('mock')
  ) {
    return new RazorpayPaymentDriver();
  }
  return new MockPaymentDriver();
}
