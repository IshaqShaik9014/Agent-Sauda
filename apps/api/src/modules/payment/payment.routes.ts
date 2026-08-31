import type { FastifyPluginAsync } from 'fastify';
import {
  InitiatePaymentInputSchema,
  ListPaymentsQuerySchema
} from './payment.schema.js';
import { paymentService } from './payment.service.js';
import { authenticate, requireMerchantAccess } from '../../middleware/auth.middleware.js';

const ErrorResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        statusCode: { type: 'number' },
        requestId: { type: 'string' }
      }
    }
  }
};

const PaymentResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    merchantId: { type: 'string' },
    orderId: { type: 'string' },
    razorpayOrderId: { type: 'string' },
    razorpayPaymentId: { type: 'string', nullable: true },
    amount: { type: 'number' },
    currency: { type: 'string' },
    status: { type: 'string' },
    attempts: { type: 'number' },
    errorCode: { type: 'string', nullable: true },
    errorDescription: { type: 'string', nullable: true },
    checkoutPayload: {
      type: 'object',
      properties: {
        keyId: { type: 'string' },
        razorpayOrderId: { type: 'string' },
        amountInPaise: { type: 'number' },
        amountInRupees: { type: 'number' },
        currency: { type: 'string' },
        orderId: { type: 'string' },
        orderNumber: { type: 'string' },
        merchantName: { type: 'string' },
        prefill: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
            contact: { type: 'string' }
          }
        }
      }
    },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' }
  }
};

export const paymentRoutes: FastifyPluginAsync = async (fastify) => {
  // ==========================================================================
  // Public Buyer Payment Initiation Endpoints
  // ==========================================================================

  /**
   * POST /api/orders/:orderId/pay
   * Initiate Razorpay payment attempt for order in PAYMENT_PENDING status
   */
  fastify.post(
    '/orders/:orderId/pay',
    {
      schema: {
        tags: ['Public Buyer Payments'],
        summary: 'Initiate Razorpay Payment',
        description: 'Creates a Razorpay order in Paise and returns client-side checkout credentials.',
        params: {
          type: 'object',
          required: ['orderId'],
          properties: {
            orderId: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          properties: {
            buyerName: { type: 'string' },
            buyerEmail: { type: 'string', format: 'email' },
            buyerPhone: { type: 'string' },
            notes: { type: 'string' }
          }
        },
        response: {
          201: {
            description: 'Payment initiated with Razorpay checkout payload',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              payment: PaymentResponseSchema
            }
          },
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      const parseResult = InitiatePaymentInputSchema.safeParse(request.body || {});

      try {
        const payment = await paymentService.initiatePayment(
          orderId,
          undefined,
          parseResult.success ? parseResult.data : {}
        );
        return reply.status(201).send({ success: true, payment });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 400 | 404 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'PAYMENT_INITIATION_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  /**
   * GET /api/payments/:paymentId
   * Public buyer view of payment transaction status
   */
  fastify.get(
    '/payments/:paymentId',
    {
      schema: {
        tags: ['Public Buyer Payments'],
        summary: 'Get Payment Status',
        params: {
          type: 'object',
          required: ['paymentId'],
          properties: {
            paymentId: { type: 'string', format: 'uuid' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              payment: PaymentResponseSchema
            }
          },
          404: ErrorResponseSchema,
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const { paymentId } = request.params as { paymentId: string };
      try {
        const payment = await paymentService.getPaymentById(paymentId);
        return reply.status(200).send({ success: true, payment });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 404 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'PAYMENT_FETCH_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  // ==========================================================================
  // Merchant Payment Management Endpoints
  // ==========================================================================

  /**
   * GET /api/merchants/:merchantId/payments
   * List merchant payment transactions with status and order filters
   */
  fastify.get(
    '/merchants/:merchantId/payments',
    {
      preHandler: [authenticate, requireMerchantAccess()],
      schema: {
        tags: ['Merchant Payments Ledger'],
        summary: 'List Merchant Payment Transactions',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['merchantId'],
          properties: {
            merchantId: { type: 'string', format: 'uuid' }
          }
        },
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['PENDING', 'PROCESSING', 'CAPTURED', 'FAILED', 'REFUNDED'] },
            orderId: { type: 'string', format: 'uuid' },
            limit: { type: 'number', default: 50 },
            offset: { type: 'number', default: 0 }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              paymentsCount: { type: 'number' },
              payments: {
                type: 'array',
                items: PaymentResponseSchema
              }
            }
          },
          400: ErrorResponseSchema,
          403: ErrorResponseSchema,
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const { merchantId } = request.params as { merchantId: string };
      const parseResult = ListPaymentsQuerySchema.safeParse(request.query);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters.',
            details: parseResult.error.format(),
            statusCode: 400,
            requestId: request.id
          }
        });
      }

      try {
        const result = await paymentService.listPayments(merchantId, parseResult.data);
        return reply.status(200).send({ success: true, ...result });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 403 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'PAYMENTS_LIST_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  /**
   * GET /api/merchants/:merchantId/payments/:paymentId
   * View single merchant payment transaction details
   */
  fastify.get(
    '/merchants/:merchantId/payments/:paymentId',
    {
      preHandler: [authenticate, requireMerchantAccess()],
      schema: {
        tags: ['Merchant Payments Ledger'],
        summary: 'Get Payment Transaction Details',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['merchantId', 'paymentId'],
          properties: {
            merchantId: { type: 'string', format: 'uuid' },
            paymentId: { type: 'string', format: 'uuid' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              payment: PaymentResponseSchema
            }
          },
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const { merchantId, paymentId } = request.params as { merchantId: string; paymentId: string };
      try {
        const payment = await paymentService.getPaymentById(paymentId, merchantId);
        return reply.status(200).send({ success: true, payment });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 403 | 404 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'PAYMENT_FETCH_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );
};
