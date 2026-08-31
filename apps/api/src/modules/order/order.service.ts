import { randomBytes } from 'node:crypto';
import { prisma } from '@agent-sauda/database';
import type {
  CreateOrderFromOfferInput,
  StartFulfillmentInput,
  FulfillOrderInput,
  CancelOrderInput,
  OrderResponse,
  OrderItemResponse,
  OrderTrackingResponse,
  OrderTimelineEvent,
  ListOrdersQuery,
  OrderStatus
} from '@agent-sauda/domain';

export class OrderService {
  /**
   * Atomically converts an accepted offer into a formal Order and reserves warehouse stock.
   */
  async createOrderFromOffer(
    offerId: string,
    actorId: string | undefined,
    input: CreateOrderFromOfferInput
  ): Promise<OrderResponse> {
    // 1. Fetch Offer with Items and Inventory
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        items: {
          include: {
            product: {
              include: { inventory: true }
            }
          }
        },
        merchant: true
      }
    });

    if (!offer) {
      const error = new Error(`Offer ${offerId} not found.`) as Error & { statusCode?: number; code?: string };
      error.statusCode = 404;
      error.code = 'OFFER_NOT_FOUND';
      throw error;
    }

    // 2. Validate Offer State & Expiration
    const now = new Date();
    if (offer.status === 'EXPIRED' || now > offer.expiresAt) {
      const error = new Error('Offer has expired and cannot be converted into an order.') as Error & {
        statusCode?: number;
        code?: string;
      };
      error.statusCode = 400;
      error.code = 'OFFER_EXPIRED';
      throw error;
    }

    if (offer.status !== 'ACCEPTED' && offer.status !== 'ACTIVE') {
      const error = new Error(`Offer in "${offer.status}" status cannot be converted into an order.`) as Error & {
        statusCode?: number;
        code?: string;
      };
      error.statusCode = 400;
      error.code = 'INVALID_OFFER_STATE';
      throw error;
    }

    // 3. Prevent duplicate order conversion
    const existingOrder = await prisma.order.findFirst({
      where: { offerId: offer.id }
    });

    if (existingOrder) {
      const error = new Error(`Order ${existingOrder.orderNumber} already exists for this offer.`) as Error & {
        statusCode?: number;
        code?: string;
      };
      error.statusCode = 400;
      error.code = 'OFFER_ALREADY_CONVERTED';
      throw error;
    }

    // 4. Validate Inventory Availability for all items
    for (const item of offer.items) {
      const inv = item.product.inventory[0];
      if (!inv || inv.availableUnits < item.quantity) {
        const error = new Error(
          `Insufficient inventory for "${item.product.title}". Requested: ${item.quantity}, Available: ${inv?.availableUnits ?? 0}.`
        ) as Error & { statusCode?: number; code?: string };
        error.statusCode = 400;
        error.code = 'INSUFFICIENT_INVENTORY';
        throw error;
      }
    }

    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;

    // 5. ACID Transaction: Reserve Stock + Create Order + OrderItems
    const order = await prisma.$transaction(async (tx) => {
      // A. Reserve Inventory for each item
      for (const item of offer.items) {
        const inv = item.product.inventory[0];
        if (inv) {
          await tx.inventory.update({
            where: { id: inv.id },
            data: {
              availableUnits: { decrement: item.quantity },
              reservedUnits: { increment: item.quantity }
            }
          });
        }
      }

      // B. Create Order record
      const createdOrder = await tx.order.create({
        data: {
          merchantId: offer.merchantId,
          buyerId: input.buyerId || null,
          offerId: offer.id,
          orderNumber,
          status: 'PAYMENT_PENDING',
          subtotal: offer.subtotal,
          discountAmount: offer.discountAmount,
          taxAmount: offer.taxAmount,
          totalAmount: offer.totalAmount,
          currency: offer.merchant.currency,
          notes: input.notes || 'Converted from accepted negotiation offer',
          items: {
            create: offer.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              title: item.product.title,
              sku: item.product.slug,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              agreedPrice: item.agreedPrice,
              costPrice: item.costPrice,
              total: item.subtotal
            }))
          }
        },
        include: {
          items: true,
          merchant: true
        }
      });

      // C. Update Offer to ACCEPTED if not already
      if (offer.status !== 'ACCEPTED') {
        await tx.offer.update({
          where: { id: offer.id },
          data: { status: 'ACCEPTED' }
        });
      }

      // D. Audit Events
      await tx.auditEvent.create({
        data: {
          merchantId: offer.merchantId,
          entityType: 'ORDER',
          entityId: createdOrder.id,
          action: 'ORDER_CREATED',
          actorType: actorId ? 'USER' : 'SYSTEM',
          actorId: actorId || input.buyerSessionId || 'checkout-session',
          reason: `Order ${orderNumber} created for ₹${createdOrder.totalAmount.toLocaleString('en-IN')}`,
          metadata: {
            orderNumber,
            offerId: offer.id,
            totalAmount: createdOrder.totalAmount
          }
        }
      });

      await tx.auditEvent.create({
        data: {
          merchantId: offer.merchantId,
          entityType: 'INVENTORY',
          entityId: createdOrder.id,
          action: 'INVENTORY_UPDATED',
          actorType: 'SYSTEM',
          actorId: 'order-reservation',
          reason: `Reserved stock for Order ${orderNumber}`
        }
      });

      return createdOrder;
    });

    return this.formatOrderResponse(order);
  }

  /**
   * Retrieves an order by ID.
   */
  async getOrderById(orderId: string, merchantId?: string): Promise<OrderResponse> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        merchant: true
      }
    });

    if (!order) {
      const error = new Error(`Order ${orderId} not found.`) as Error & { statusCode?: number; code?: string };
      error.statusCode = 404;
      error.code = 'ORDER_NOT_FOUND';
      throw error;
    }

    if (merchantId && order.merchantId !== merchantId) {
      const error = new Error('Access denied to this merchant order.') as Error & { statusCode?: number; code?: string };
      error.statusCode = 403;
      error.code = 'FORBIDDEN_MERCHANT_ACCESS';
      throw error;
    }

    return this.formatOrderResponse(order);
  }

  /**
   * Starts fulfillment workflow for a paid order (PAID -> FULFILLMENT_PENDING).
   */
  async startFulfillment(
    orderId: string,
    merchantId: string,
    actorId: string | undefined,
    input: StartFulfillmentInput
  ): Promise<OrderResponse> {
    const order = await this.getOrderById(orderId, merchantId);

    if (order.status !== 'PAID') {
      const error = new Error(
        `Cannot start fulfillment for order in "${order.status}" status. Only PAID orders can be processed.`
      ) as Error & { statusCode?: number; code?: string };
      error.statusCode = 400;
      error.code = 'INVALID_ORDER_STATE';
      throw error;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'FULFILLMENT_PENDING',
          notes: input.notes ? `${order.notes || ''} | Packaging: ${input.notes}`.trim() : order.notes
        },
        include: {
          items: true,
          merchant: true
        }
      });

      await tx.auditEvent.create({
        data: {
          merchantId,
          entityType: 'ORDER',
          entityId: orderId,
          action: 'ORDER_UPDATED',
          actorType: actorId ? 'USER' : 'SYSTEM',
          actorId: actorId || 'store-staff',
          reason: `Fulfillment started for Order ${order.orderNumber}`
        }
      });

      return updatedOrder;
    });

    return this.formatOrderResponse(updated);
  }

  /**
   * Completes order fulfillment and adds shipping tracking metadata (FULFILLMENT_PENDING -> COMPLETED).
   */
  async completeFulfillment(
    orderId: string,
    merchantId: string,
    actorId: string | undefined,
    input: FulfillOrderInput
  ): Promise<OrderResponse> {
    const order = await this.getOrderById(orderId, merchantId);

    if (order.status !== 'PAID' && order.status !== 'FULFILLMENT_PENDING') {
      const error = new Error(
        `Cannot complete fulfillment for order in "${order.status}" status.`
      ) as Error & { statusCode?: number; code?: string };
      error.statusCode = 400;
      error.code = 'INVALID_ORDER_STATE';
      throw error;
    }

    const shippingInfo = [
      input.carrier ? `Carrier: ${input.carrier}` : null,
      input.trackingNumber ? `Tracking: ${input.trackingNumber}` : null,
      input.notes ? `Notes: ${input.notes}` : null
    ]
      .filter(Boolean)
      .join(' | ');

    const updated = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'COMPLETED',
          notes: shippingInfo ? `${order.notes || ''} | Shipped: ${shippingInfo}`.trim() : order.notes
        },
        include: {
          items: true,
          merchant: true
        }
      });

      await tx.auditEvent.create({
        data: {
          merchantId,
          entityType: 'ORDER',
          entityId: orderId,
          action: 'ORDER_COMPLETED',
          actorType: actorId ? 'USER' : 'SYSTEM',
          actorId: actorId || 'store-staff',
          reason: `Order ${order.orderNumber} fulfilled and marked COMPLETED (${shippingInfo || 'Dispatched'})`
        }
      });

      return updatedOrder;
    });

    return this.formatOrderResponse(updated);
  }

  /**
   * Generates a public real-time order tracking timeline.
   */
  async getOrderTrackingTimeline(orderId: string): Promise<OrderTrackingResponse> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        merchant: true,
        payments: true
      }
    });

    if (!order) {
      const error = new Error(`Order ${orderId} not found.`) as Error & { statusCode?: number; code?: string };
      error.statusCode = 404;
      error.code = 'ORDER_NOT_FOUND';
      throw error;
    }

    const isPaid = order.status === 'PAID' || order.status === 'FULFILLMENT_PENDING' || order.status === 'COMPLETED';
    const isProcessing = order.status === 'FULFILLMENT_PENDING' || order.status === 'COMPLETED';
    const isCompleted = order.status === 'COMPLETED';
    const isCancelled = order.status === 'CANCELLED';

    const timeline: OrderTimelineEvent[] = [
      {
        step: 'OFFER_ACCEPTED',
        title: 'Commercial Agreement Finalized',
        description: 'Quotation confirmed with agreed negotiated pricing.',
        timestamp: order.createdAt,
        completed: true
      },
      {
        step: 'ORDER_CREATED',
        title: 'Order Placed & Stock Reserved',
        description: `Order ${order.orderNumber} created with reserved warehouse inventory.`,
        timestamp: order.createdAt,
        completed: true
      },
      {
        step: 'PAYMENT_CAPTURED',
        title: isPaid ? 'Payment Captured' : isCancelled ? 'Payment Cancelled' : 'Awaiting Payment',
        description: isPaid
          ? 'Payment successfully verified via Razorpay.'
          : isCancelled
          ? 'Order was cancelled before payment completion.'
          : 'Pending buyer payment completion.',
        timestamp: isPaid ? order.updatedAt : null,
        completed: isPaid
      },
      {
        step: 'FULFILLMENT_PROCESSING',
        title: 'Warehouse Processing & Packing',
        description: isProcessing
          ? 'Items verified and prepared for courier dispatch.'
          : 'Waiting for packaging initiation.',
        timestamp: isProcessing ? order.updatedAt : null,
        completed: isProcessing
      },
      {
        step: 'ORDER_COMPLETED',
        title: isCompleted ? 'Order Delivered / Completed' : 'Out for Delivery',
        description: isCompleted
          ? 'Order dispatched and delivered successfully.'
          : 'Awaiting shipping handover.',
        timestamp: isCompleted ? order.updatedAt : null,
        completed: isCompleted
      }
    ];

    const items: OrderItemResponse[] = (order.items || []).map((item: any) => ({
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      variantId: item.variantId,
      title: item.title,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      agreedPrice: item.agreedPrice,
      costPrice: item.costPrice,
      total: item.total
    }));

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status as OrderStatus,
      totalAmount: order.totalAmount,
      currency: order.currency,
      notes: order.notes,
      timeline,
      items,
      merchant: {
        id: order.merchant.id,
        name: order.merchant.name,
        currency: order.merchant.currency
      },
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    };
  }

  /**
   * Cancels an order and atomically releases reserved stock back to available warehouse inventory.
   */
  async cancelOrder(
    orderId: string,
    merchantId: string,
    actorId: string | undefined,
    input: CancelOrderInput
  ): Promise<OrderResponse> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: { include: { inventory: true } }
          }
        },
        merchant: true
      }
    });

    if (!order) {
      const error = new Error(`Order ${orderId} not found.`) as Error & { statusCode?: number; code?: string };
      error.statusCode = 404;
      error.code = 'ORDER_NOT_FOUND';
      throw error;
    }

    if (order.merchantId !== merchantId) {
      const error = new Error('Access denied to this merchant order.') as Error & { statusCode?: number; code?: string };
      error.statusCode = 403;
      error.code = 'FORBIDDEN_MERCHANT_ACCESS';
      throw error;
    }

    if (order.status === 'CANCELLED') {
      const error = new Error('Order is already cancelled.') as Error & { statusCode?: number; code?: string };
      error.statusCode = 400;
      error.code = 'ORDER_ALREADY_CANCELLED';
      throw error;
    }

    if (order.status === 'PAID' || order.status === 'COMPLETED' || order.status === 'FULFILLMENT_PENDING') {
      const error = new Error(`Cannot cancel order in "${order.status}" status without issuing a refund.`) as Error & {
        statusCode?: number;
        code?: string;
      };
      error.statusCode = 400;
      error.code = 'INVALID_ORDER_STATE';
      throw error;
    }

    // ACID Transaction: Release Reserved Stock + Update Order status to CANCELLED
    const cancelledOrder = await prisma.$transaction(async (tx) => {
      // A. Return reserved inventory to availableUnits
      for (const item of order.items) {
        const inv = item.product.inventory[0];
        if (inv) {
          await tx.inventory.update({
            where: { id: inv.id },
            data: {
              availableUnits: { increment: item.quantity },
              reservedUnits: { decrement: item.quantity }
            }
          });
        }
      }

      // B. Update Order Status
      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          notes: input.reason || 'Order cancelled by user/merchant'
        },
        include: {
          items: true,
          merchant: true
        }
      });

      // C. Audit Events
      await tx.auditEvent.create({
        data: {
          merchantId: order.merchantId,
          entityType: 'ORDER',
          entityId: order.id,
          action: 'ORDER_CANCELLED',
          actorType: actorId ? 'USER' : 'SYSTEM',
          actorId: actorId || 'system',
          reason: input.reason || 'Order cancelled and stock released',
          metadata: {
            orderNumber: order.orderNumber,
            totalAmount: order.totalAmount
          }
        }
      });

      await tx.auditEvent.create({
        data: {
          merchantId: order.merchantId,
          entityType: 'INVENTORY',
          entityId: order.id,
          action: 'INVENTORY_UPDATED',
          actorType: 'SYSTEM',
          actorId: 'order-cancellation-release',
          reason: `Released reserved stock for cancelled Order ${order.orderNumber}`
        }
      });

      return updated;
    });

    return this.formatOrderResponse(cancelledOrder);
  }

  /**
   * Lists merchant orders with status and pagination filters.
   */
  async listOrders(
    merchantId: string,
    query: ListOrdersQuery
  ): Promise<{ ordersCount: number; orders: OrderResponse[] }> {
    const where: any = { merchantId };
    if (query.status) {
      where.status = query.status;
    }

    const [count, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: {
          items: true,
          merchant: true
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset
      })
    ]);

    return {
      ordersCount: count,
      orders: orders.map((o) => this.formatOrderResponse(o))
    };
  }

  /**
   * Normalizes database record to domain OrderResponse.
   */
  private formatOrderResponse(order: any): OrderResponse {
    const items: OrderItemResponse[] = (order.items || []).map((item: any) => ({
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      variantId: item.variantId,
      title: item.title,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      agreedPrice: item.agreedPrice,
      costPrice: item.costPrice,
      total: item.total
    }));

    return {
      id: order.id,
      merchantId: order.merchantId,
      buyerId: order.buyerId,
      offerId: order.offerId,
      orderNumber: order.orderNumber,
      status: order.status as OrderStatus,
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      taxAmount: order.taxAmount,
      totalAmount: order.totalAmount,
      currency: order.currency,
      notes: order.notes,
      items,
      merchant: order.merchant
        ? {
            id: order.merchant.id,
            name: order.merchant.name,
            slug: order.merchant.slug,
            currency: order.merchant.currency
          }
        : undefined,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    };
  }
}

export const orderService = new OrderService();
