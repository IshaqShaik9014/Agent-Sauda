import { auth } from './auth';
import type {
  ChatInput,
  ChatResponse,
  OfferResponse,
  OrderResponse,
  OrderTrackingResponse,
  PaymentResponse,
  VerifyPaymentInput,
  CompleteAnalyticsDashboardResponse,
  RegisterInput,
  LoginInput,
  AuthResponse
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

export interface AdminProduct {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  basePrice: number;
  costPrice: number;
  isActive: boolean;
  inventory?: {
    availableUnits: number;
    reservedUnits: number;
    location?: string;
  };
}

export interface AdminPolicy {
  id: string;
  maxDiscountPercent: number;
  minimumMarginPercent: number;
  autonomousOrderLimit: number;
  approvalThreshold: number;
  maxQuantityPerOrder: number;
  rules: any;
  isActive: boolean;
}

export interface PendingApproval {
  id: string;
  offerId: string;
  merchantId?: string;
  requestedById?: string;
  approvedById?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  requestReason?: string;
  resolutionNotes?: string;
  requestedAt?: string;
  resolvedAt?: string;
  offer?: OfferResponse;
  approvedBy?: {
    id: string;
    name: string;
    email: string;
  };
  offerNumber?: string;
  totalAmount?: number;
  marginPercent?: number;
  discountPercent?: number;
  requestedBy?: string;
  reason?: string;
  createdAt?: string;
}

export interface AuditEventItem {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorType: string;
  actorId: string;
  reason?: string;
  metadata?: any;
  createdAt: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const token = auth.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string>)
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

  // ==========================================================================
  // Auth Endpoints
  // ==========================================================================

  async register(input: RegisterInput): Promise<AuthResponse> {
    return this.request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    return this.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  }

  // ==========================================================================
  // Public Buyer & Negotiation Endpoints
  // ==========================================================================

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

  async sendChatMessage(input: ChatInput): Promise<ChatResponse> {
    return this.request<ChatResponse>('/api/agent/chat', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  }

  async getOffer(offerId: string): Promise<{ success: boolean; offer: OfferResponse }> {
    return this.request<{ success: boolean; offer: OfferResponse }>(`/api/offers/${offerId}`);
  }

  async acceptOffer(offerId: string): Promise<{ success: boolean; offer: OfferResponse }> {
    return this.request<{ success: boolean; offer: OfferResponse }>(`/api/offers/${offerId}/accept`, {
      method: 'POST',
      body: JSON.stringify({})
    });
  }

  async rejectOffer(offerId: string, reason?: string): Promise<{ success: boolean; offer: OfferResponse }> {
    return this.request<{ success: boolean; offer: OfferResponse }>(`/api/offers/${offerId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || 'Customer declined quote' })
    });
  }

  async createOrderFromOffer(input: {
    offerId: string;
    notes?: string;
  }): Promise<{ success: boolean; order: OrderResponse }> {
    return this.request<{ success: boolean; order: OrderResponse }>('/api/orders/create-from-offer', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  }

  async getOrder(orderId: string): Promise<{ success: boolean; order: OrderResponse }> {
    return this.request<{ success: boolean; order: OrderResponse }>(`/api/orders/${orderId}`);
  }

  async trackOrder(orderId: string): Promise<{ success: boolean; tracking: OrderTrackingResponse }> {
    return this.request<{ success: boolean; tracking: OrderTrackingResponse }>(`/api/orders/${orderId}/track`);
  }

  async initiatePayment(orderId: string): Promise<{ success: boolean; payment: PaymentResponse }> {
    return this.request<{ success: boolean; payment: PaymentResponse }>(`/api/orders/${orderId}/pay`, {
      method: 'POST',
      body: JSON.stringify({})
    });
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<{
    success: boolean;
    orderId: string;
    paymentId: string;
  }> {
    return this.request<{
      success: boolean;
      orderId: string;
      paymentId: string;
    }>('/api/payments/verify', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  }

  // ==========================================================================
  // Merchant Admin Endpoints
  // ==========================================================================

  async getCompleteAnalytics(
    merchantId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{ success: boolean; dashboard: CompleteAnalyticsDashboardResponse }> {
    const searchParams = new URLSearchParams();
    if (startDate) searchParams.append('startDate', startDate);
    if (endDate) searchParams.append('endDate', endDate);

    return this.request<{ success: boolean; dashboard: CompleteAnalyticsDashboardResponse }>(
      `/api/merchants/${merchantId}/analytics/dashboard?${searchParams.toString()}`
    );
  }

  async getMerchantCatalog(merchantId: string): Promise<{ success: boolean; products: AdminProduct[] }> {
    return this.request<{ success: boolean; products: AdminProduct[] }>(
      `/api/merchants/${merchantId}/catalog/products`
    );
  }

  async createProduct(
    merchantId: string,
    input: {
      title: string;
      slug: string;
      description?: string;
      category: string;
      basePrice: number;
      costPrice: number;
      initialStock?: number;
      location?: string;
    }
  ): Promise<{ success: boolean; product: AdminProduct }> {
    return this.request<{ success: boolean; product: AdminProduct }>(
      `/api/merchants/${merchantId}/catalog/products`,
      {
        method: 'POST',
        body: JSON.stringify(input)
      }
    );
  }

  async updateInventory(
    merchantId: string,
    productId: string,
    input: {
      availableUnits: number;
      reservedUnits?: number;
      location?: string;
    }
  ): Promise<{ success: boolean; inventory: any }> {
    return this.request<{ success: boolean; inventory: any }>(
      `/api/merchants/${merchantId}/catalog/inventory/${productId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(input)
      }
    );
  }

  async getMerchantPolicy(merchantId: string): Promise<{ success: boolean; policy: AdminPolicy }> {
    return this.request<{ success: boolean; policy: AdminPolicy }>(`/api/merchants/${merchantId}/policy`);
  }

  async updateMerchantPolicy(
    merchantId: string,
    input: Partial<AdminPolicy>
  ): Promise<{ success: boolean; policy: AdminPolicy }> {
    return this.request<{ success: boolean; policy: AdminPolicy }>(
      `/api/merchants/${merchantId}/policy`,
      {
        method: 'PUT',
        body: JSON.stringify(input)
      }
    );
  }

  async getPendingApprovals(
    merchantId: string
  ): Promise<{ success: boolean; approvals: PendingApproval[]; count: number }> {
    return this.request<{ success: boolean; approvals: PendingApproval[]; count: number }>(
      `/api/merchants/${merchantId}/approvals?status=PENDING`
    );
  }

  async approveOffer(
    merchantId: string,
    approvalId: string,
    notes?: string
  ): Promise<{ success: boolean; approval: any }> {
    return this.request<{ success: boolean; approval: any }>(
      `/api/merchants/${merchantId}/approvals/${approvalId}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ notes: notes || 'Approved by merchant manager in dashboard' })
      }
    );
  }

  async rejectApproval(
    merchantId: string,
    approvalId: string,
    reason: string
  ): Promise<{ success: boolean; approval: any }> {
    return this.request<{ success: boolean; approval: any }>(
      `/api/merchants/${merchantId}/approvals/${approvalId}/reject`,
      {
        method: 'POST',
        body: JSON.stringify({ reason })
      }
    );
  }

  async getMerchantOrders(
    merchantId: string,
    status?: string
  ): Promise<{ success: boolean; orders: OrderResponse[] }> {
    const searchParams = new URLSearchParams();
    if (status) searchParams.append('status', status);

    return this.request<{ success: boolean; orders: OrderResponse[] }>(
      `/api/merchants/${merchantId}/orders?${searchParams.toString()}`
    );
  }

  async startFulfillment(
    merchantId: string,
    orderId: string,
    notes?: string
  ): Promise<{ success: boolean; order: OrderResponse }> {
    return this.request<{ success: boolean; order: OrderResponse }>(
      `/api/merchants/${merchantId}/orders/${orderId}/start-fulfillment`,
      {
        method: 'POST',
        body: JSON.stringify({ notes: notes || 'Warehouse packing started' })
      }
    );
  }

  async fulfillOrder(
    merchantId: string,
    orderId: string,
    carrier: string,
    trackingNumber: string
  ): Promise<{ success: boolean; order: OrderResponse }> {
    return this.request<{ success: boolean; order: OrderResponse }>(
      `/api/merchants/${merchantId}/orders/${orderId}/fulfill`,
      {
        method: 'POST',
        body: JSON.stringify({ carrier, trackingNumber })
      }
    );
  }

  async getAuditTrail(
    merchantId: string,
    params: { entityType?: string; action?: string; limit?: number } = {}
  ): Promise<{ success: boolean; events: AuditEventItem[] }> {
    const searchParams = new URLSearchParams();
    if (params.entityType) searchParams.append('entityType', params.entityType);
    if (params.action) searchParams.append('action', params.action);
    if (params.limit) searchParams.append('limit', params.limit.toString());

    return this.request<{ success: boolean; events: AuditEventItem[] }>(
      `/api/merchants/${merchantId}/audit?${searchParams.toString()}`
    );
  }
}

export const api = new ApiClient(API_BASE_URL);
