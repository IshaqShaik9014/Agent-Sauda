import type {
  ChatInput,
  ChatResponse,
  OfferResponse,
  OrderResponse,
  OrderTrackingResponse,
  PaymentResponse,
  VerifyPaymentInput
} from '@agent-sauda/domain';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface PublicCatalogProduct {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  basePrice: number;
  inStock: boolean;
  merchant: {
    id: string;
    name: string;
    slug: string;
    currency: string;
  };
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    try {
      const response = await fetch(url, { ...options, headers });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error?.message || `Request failed with status ${response.status}`);
      }

      return data as T;
    } catch (err: unknown) {
      console.error(`[API Error] ${options.method || 'GET'} ${path}:`, err);
      throw err;
    }
  }

  /**
   * Fetch public redacted catalog for a merchant
   */
  async getAgentCatalog(params: {
    merchantSlug?: string;
    merchantId?: string;
    category?: string;
    search?: string;
  }): Promise<{ success: boolean; products: PublicCatalogProduct[] }> {
    const searchParams = new URLSearchParams();
    if (params.merchantSlug) searchParams.append('merchantSlug', params.merchantSlug);
    if (params.merchantId) searchParams.append('merchantId', params.merchantId);
    if (params.category) searchParams.append('category', params.category);
    if (params.search) searchParams.append('search', params.search);

    return this.request<{ success: boolean; products: PublicCatalogProduct[] }>(
      `/api/agent/catalog?${searchParams.toString()}`
    );
  }

  /**
   * Send negotiation message to AI sales agent
   */
  async sendChatMessage(input: ChatInput): Promise<ChatResponse> {
    return this.request<ChatResponse>('/api/agent/chat', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  }

  /**
   * Get public details of a formal quote / offer
   */
  async getOffer(offerId: string): Promise<{ success: boolean; offer: OfferResponse }> {
    return this.request<{ success: boolean; offer: OfferResponse }>(`/api/offers/${offerId}`);
  }

  /**
   * Buyer accepts formal offer
   */
  async acceptOffer(offerId: string): Promise<{ success: boolean; offer: OfferResponse }> {
    return this.request<{ success: boolean; offer: OfferResponse }>(`/api/offers/${offerId}/accept`, {
      method: 'POST',
      body: JSON.stringify({})
    });
  }

  /**
   * Buyer rejects formal offer
   */
  async rejectOffer(offerId: string, reason?: string): Promise<{ success: boolean; offer: OfferResponse }> {
    return this.request<{ success: boolean; offer: OfferResponse }>(`/api/offers/${offerId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || 'Customer declined quote' })
    });
  }

  /**
   * Convert accepted offer into Order with atomic stock reservation
   */
  async createOrderFromOffer(input: {
    offerId: string;
    notes?: string;
  }): Promise<{ success: boolean; order: OrderResponse }> {
    return this.request<{ success: boolean; order: OrderResponse }>('/api/orders/create-from-offer', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  }

  /**
   * Get public checkout order summary
   */
  async getOrder(orderId: string): Promise<{ success: boolean; order: OrderResponse }> {
    return this.request<{ success: boolean; order: OrderResponse }>(`/api/orders/${orderId}`);
  }

  /**
   * Track order delivery timeline
   */
  async trackOrder(orderId: string): Promise<{ success: boolean; tracking: OrderTrackingResponse }> {
    return this.request<{ success: boolean; tracking: OrderTrackingResponse }>(`/api/orders/${orderId}/track`);
  }

  /**
   * Initiate Razorpay payment in integer Paise
   */
  async initiatePayment(orderId: string): Promise<{ success: boolean; payment: PaymentResponse }> {
    return this.request<{ success: boolean; payment: PaymentResponse }>(`/api/orders/${orderId}/pay`, {
      method: 'POST',
      body: JSON.stringify({})
    });
  }

  /**
   * Verify client checkout signature
   */
  async verifyPayment(input: VerifyPaymentInput): Promise<{
    success: boolean;
    order: { id: string; orderNumber: string; status: string; totalAmount: number; currency: string };
    payment: { id: string; status: string; amount: number; razorpayPaymentId: string };
  }> {
    return this.request<{
      success: boolean;
      order: { id: string; orderNumber: string; status: string; totalAmount: number; currency: string };
      payment: { id: string; status: string; amount: number; razorpayPaymentId: string };
    }>('/api/payments/verify', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  }
}

export const api = new ApiClient(API_BASE_URL);
