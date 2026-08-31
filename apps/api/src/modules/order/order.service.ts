import { randomBytes } from 'node:crypto';
import { prisma } from '@agent-sauda/database';
import type {
  CreateOrderFromOfferInput,
  CancelOrderInput,
  OrderResponse,
  OrderItemResponse,
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

    if (order.status === 'PAID' || order.status === 'COMPLETED') {
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
