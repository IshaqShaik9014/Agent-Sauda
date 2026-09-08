import { prisma } from '@agent-sauda/database';
import type {
  InitiatePaymentInput,
  PaymentResponse,
  ListPaymentsQuery,
  PaymentStatus,
  RazorpayCheckoutPayload
} from '@agent-sauda/domain';
import { getPaymentDriver, type IPaymentDriver } from './payment.driver.js';

export class PaymentService {
  private driver: IPaymentDriver;

  constructor(driver?: IPaymentDriver) {
    this.driver = driver || getPaymentDriver();
  }

  /**
   * Initiates a payment attempt for an order in PAYMENT_PENDING status.
   */
  async initiatePayment(
    orderId: string,
    actorId: string | undefined,
    input: InitiatePaymentInput
  ): Promise<PaymentResponse> {
    // 1. Fetch Order with Merchant
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        merchant: true,
        items: true
      }
    });

    if (!order) {
      const error = new Error(`Order ${orderId} not found.`) as Error & { statusCode?: number; code?: string };
      error.statusCode = 404;
      error.code = 'ORDER_NOT_FOUND';
      throw error;
    }

    // 2. Validate Order State
    if (order.status === 'PAID' || order.status === 'COMPLETED') {
      const error = new Error('Order is already paid and cannot be paid again.') as Error & {
        statusCode?: number;
        code?: string;
      };
      error.statusCode = 400;
      error.code = 'ORDER_ALREADY_PAID';
      throw error;
    }

    if (order.status === 'CANCELLED') {
      const error = new Error('Order has been cancelled and cannot be paid.') as Error & {
        statusCode?: number;
        code?: string;
      };
      error.statusCode = 400;
      error.code = 'ORDER_CANCELLED';
      throw error;
    }

    if (order.status !== 'PAYMENT_PENDING' && order.status !== 'PAYMENT_PROCESSING') {
      const error = new Error(`Cannot initiate payment for order in "${order.status}" status.`) as Error & {
        statusCode?: number;
        code?: string;
      };
      error.statusCode = 400;
      error.code = 'INVALID_ORDER_STATE';
      throw error;
    }

    // 3. Calculate integer subunits (Paise)
    const amountInPaise = Math.round(order.totalAmount * 100);

    // 4. Create Gateway Order via Driver
    const gatewayOrder = await this.driver.createPaymentOrder(
      order.id,
      amountInPaise,
      order.currency,
      order.orderNumber,
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        merchantId: order.merchantId
      }
    );

    // 5. Persist Payment attempt in database
    const payment = await prisma.$transaction(async (tx) => {
      // Find existing attempt count
      const existingAttempts = await tx.payment.count({
        where: { orderId: order.id }
      });

      const createdPayment = await tx.payment.create({
        data: {
          merchantId: order.merchantId,
          orderId: order.id,
          razorpayOrderId: gatewayOrder.providerOrderId,
          amount: order.totalAmount,
          currency: order.currency,
          status: 'PENDING',
          attempts: existingAttempts + 1
        }
      });

      // Audit Event
      await tx.auditEvent.create({
        data: {
          merchantId: order.merchantId,
          entityType: 'PAYMENT',
          entityId: createdPayment.id,
          action: 'PAYMENT_INITIATED',
          actorType: actorId ? 'USER' : 'SYSTEM',
          actorId: actorId || 'checkout-buyer',
          reason: `Payment initiated for Order ${order.orderNumber} (₹${order.totalAmount.toLocaleString('en-IN')})`,
          metadata: {
            paymentId: createdPayment.id,
            razorpayOrderId: gatewayOrder.providerOrderId,
            amountInPaise,
            currency: order.currency
          }
        }
      });

      return createdPayment;
    });

    const checkoutPayload: RazorpayCheckoutPayload = {
      keyId: gatewayOrder.keyId,
      razorpayOrderId: gatewayOrder.providerOrderId,
      amountInPaise,
      amountInRupees: order.totalAmount,
      currency: order.currency,
      orderId: order.id,
      orderNumber: order.orderNumber,
      merchantName: order.merchant.name,
      prefill: {
        name: input.buyerName,
        email: input.buyerEmail,
        contact: input.buyerPhone
      }
    };

    return this.formatPaymentResponse(payment, checkoutPayload);
  }

  /**
   * Retrieves payment transaction by ID.
   */
  async getPaymentById(paymentId: string, merchantId?: string): Promise<PaymentResponse> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId }
    });

    if (!payment) {
      const error = new Error(`Payment ${paymentId} not found.`) as Error & { statusCode?: number; code?: string };
      error.statusCode = 404;
      error.code = 'PAYMENT_NOT_FOUND';
      throw error;
    }

    if (merchantId && payment.merchantId !== merchantId) {
      const error = new Error('Access denied to this merchant payment.') as Error & { statusCode?: number; code?: string };
      error.statusCode = 403;
      error.code = 'FORBIDDEN_MERCHANT_ACCESS';
      throw error;
    }

    return this.formatPaymentResponse(payment);
  }

  /**
   * Lists merchant payment transactions with status and pagination filters.
   */
  async listPayments(
    merchantId: string,
    query: ListPaymentsQuery
  ): Promise<{ paymentsCount: number; payments: PaymentResponse[] }> {
    const where: any = { merchantId };
    if (query.status) {
      where.status = query.status;
    }
    if (query.orderId) {
      where.orderId = query.orderId;
    }

    const [count, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset
      })
    ]);

    return {
      paymentsCount: count,
      payments: payments.map((p) => this.formatPaymentResponse(p))
    };
  }

  /**
   * Processes a full or partial refund for a paid order via Razorpay API.
   * Restocks inventory and transitions Order and Payment state machine.
   */
  async processRefund(
    merchantId: string,
    orderId: string,
    actorId: string | undefined,
    input: { amount?: number; reason: string }
  ): Promise<{ success: boolean; message: string; refund: any; order: any }> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: true,
        items: true
      }
    });

    if (!order || order.merchantId !== merchantId) {
      const error = new Error(`Order ${orderId} not found or access denied.`) as Error & { statusCode?: number; code?: string };
      error.statusCode = 404;
      error.code = 'ORDER_NOT_FOUND';
      throw error;
    }

    if (order.status !== 'PAID' && order.status !== 'COMPLETED') {
      const error = new Error(`Cannot refund order in "${order.status}" status. Only PAID or COMPLETED orders can be refunded.`) as Error & { statusCode?: number; code?: string };
      error.statusCode = 400;
      error.code = 'INVALID_REFUND_STATE';
      throw error;
    }

    // Find captured payment
    const payment = order.payments.find((p) => p.status === 'CAPTURED') || order.payments[0];
    const razorpayPaymentId = payment?.razorpayPaymentId || `pay_mock_${Date.now().toString(36)}`;

    const refundAmount = input.amount || order.totalAmount;
    const refundAmountInPaise = Math.round(refundAmount * 100);

    // Call Razorpay refund driver
    const refundResult = await this.driver.refundPayment(razorpayPaymentId, refundAmountInPaise, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      reason: input.reason
    });

    // Execute atomic state transition & stock restock
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 1. Update Payment status if payment record exists
      if (payment) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'REFUNDED' }
        });
      }

      // 2. Restock Inventory units
      for (const item of order.items) {
        await tx.inventory.updateMany({
          where: {
            merchantId,
            productId: item.productId,
            variantId: item.variantId || null
          },
          data: {
            availableUnits: { increment: item.quantity }
          }
        });
      }

      // 3. Update Order status
      const ord = await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          notes: `${order.notes ? order.notes + ' | ' : ''}Refunded ₹${refundAmount.toLocaleString('en-IN')}: ${input.reason} (Refund ID: ${refundResult.refundId})`
        },
        include: { items: true, payments: true }
      });

      // 4. Record Audit Event
      await tx.auditEvent.create({
        data: {
          merchantId,
          entityType: 'ORDER',
          entityId: order.id,
          action: 'ORDER_REFUNDED',
          actorType: actorId ? 'USER' : 'SYSTEM',
          actorId: actorId || 'manager',
          reason: `Processed Razorpay refund of ₹${refundAmount.toLocaleString('en-IN')}: ${input.reason}`,
          metadata: {
            refundId: refundResult.refundId,
            paymentId: payment?.id,
            razorpayPaymentId,
            amount: refundAmount
          }
        }
      });

      return ord;
    });

    return {
      success: true,
      message: `Successfully processed refund of ₹${refundAmount.toLocaleString('en-IN')} for Order #${order.orderNumber}. Inventory has been restocked.`,
      refund: refundResult,
      order: updatedOrder
    };
  }

  /**
   * Normalizes database record to domain PaymentResponse.
   */
  private formatPaymentResponse(
    payment: any,
    checkoutPayload?: RazorpayCheckoutPayload
  ): PaymentResponse {
    return {
      id: payment.id,
      merchantId: payment.merchantId,
      orderId: payment.orderId,
      razorpayOrderId: payment.razorpayOrderId,
      razorpayPaymentId: payment.razorpayPaymentId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status as PaymentStatus,
      attempts: payment.attempts,
      errorCode: payment.errorCode,
      errorDescription: payment.errorDescription,
      checkoutPayload,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt
    };
  }
}

export const paymentService = new PaymentService();

