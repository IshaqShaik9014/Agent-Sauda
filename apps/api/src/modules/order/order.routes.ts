import type { FastifyPluginAsync } from 'fastify';
import {
  CreateOrderFromOfferInputSchema,
  CancelOrderInputSchema,
  ListOrdersQuerySchema
} from './order.schema.js';
import { orderService } from './order.service.js';
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

const OrderItemResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    productId: { type: 'string' },
    variantId: { type: 'string', nullable: true },
    title: { type: 'string' },
    sku: { type: 'string', nullable: true },
    quantity: { type: 'number' },
    unitPrice: { type: 'number' },
    agreedPrice: { type: 'number' },
    total: { type: 'number' }
  }
};

const OrderResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    merchantId: { type: 'string' },
    buyerId: { type: 'string', nullable: true },
    offerId: { type: 'string', nullable: true },
    orderNumber: { type: 'string' },
    status: { type: 'string' },
    subtotal: { type: 'number' },
    discountAmount: { type: 'number' },
    taxAmount: { type: 'number' },
    totalAmount: { type: 'number' },
    currency: { type: 'string' },
    notes: { type: 'string', nullable: true },
    items: {
      type: 'array',
      items: OrderItemResponseSchema
    },
    merchant: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        slug: { type: 'string' },
        currency: { type: 'string' }
      }
    },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' }
  }
};

export const orderRoutes: FastifyPluginAsync = async (fastify) => {
  // ==========================================================================
  // Public Buyer Checkout Order Endpoints
  // ==========================================================================

  /**
   * POST /api/orders/create-from-offer
   * Convert an accepted offer into an official Order and reserve inventory
   */
  fastify.post(
    '/orders/create-from-offer',
    {
      schema: {
        tags: ['Public Buyer Checkout'],
        summary: 'Create Order from Accepted Offer',
        description: 'Converts an accepted offer into an Order and atomically reserves warehouse inventory.',
        body: {
          type: 'object',
          required: ['offerId'],
          properties: {
            offerId: { type: 'string', format: 'uuid' },
            buyerId: { type: 'string', format: 'uuid' },
            buyerSessionId: { type: 'string' },
            notes: { type: 'string' }
          }
        },
        response: {
          201: {
            description: 'Order successfully created with reserved inventory',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              order: OrderResponseSchema
            }
          },
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const parseResult = CreateOrderFromOfferInputSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid order creation parameters.',
            details: parseResult.error.format(),
            statusCode: 400,
            requestId: request.id
          }
        });
      }

      try {
        const order = await orderService.createOrderFromOffer(
          parseResult.data.offerId,
          undefined,
          parseResult.data
        );
        return reply.status(201).send({ success: true, order });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 400 | 404 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'ORDER_CREATION_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  /**
   * GET /api/orders/:orderId
   * Public buyer view of order summary
   */
  fastify.get(
    '/orders/:orderId',
    {
      schema: {
        tags: ['Public Buyer Checkout'],
        summary: 'Get Order Summary for Checkout',
        params: {
          type: 'object',
          required: ['orderId'],
          properties: {
            orderId: { type: 'string', format: 'uuid' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              order: OrderResponseSchema
            }
          },
          404: ErrorResponseSchema,
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      try {
        const order = await orderService.getOrderById(orderId);
        return reply.status(200).send({ success: true, order });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 404 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'ORDER_FETCH_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  // ==========================================================================
  // Merchant Order Management Endpoints
  // ==========================================================================

  /**
   * GET /api/merchants/:merchantId/orders
   * List merchant orders with status and pagination filters
   */
  fastify.get(
    '/merchants/:merchantId/orders',
    {
      preHandler: [authenticate, requireMerchantAccess()],
      schema: {
        tags: ['Merchant Order Management'],
        summary: 'List Merchant Orders',
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
            status: { type: 'string' },
            limit: { type: 'number', default: 50 },
            offset: { type: 'number', default: 0 }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              ordersCount: { type: 'number' },
              orders: {
                type: 'array',
                items: OrderResponseSchema
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
      const parseResult = ListOrdersQuerySchema.safeParse(request.query);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query filters.',
            details: parseResult.error.format(),
            statusCode: 400,
            requestId: request.id
          }
        });
      }

      try {
        const result = await orderService.listOrders(merchantId, parseResult.data);
        return reply.status(200).send({ success: true, ...result });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 403 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'ORDER_LIST_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  /**
   * GET /api/merchants/:merchantId/orders/:orderId
   * View single merchant order details
   */
  fastify.get(
    '/merchants/:merchantId/orders/:orderId',
    {
      preHandler: [authenticate, requireMerchantAccess()],
      schema: {
        tags: ['Merchant Order Management'],
        summary: 'Get Merchant Order Details',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['merchantId'],
          properties: {
            merchantId: { type: 'string', format: 'uuid' },
            orderId: { type: 'string', format: 'uuid' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              order: OrderResponseSchema
            }
          },
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const { merchantId, orderId } = request.params as { merchantId: string; orderId: string };
      try {
        const order = await orderService.getOrderById(orderId, merchantId);
        return reply.status(200).send({ success: true, order });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 403 | 404 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'ORDER_FETCH_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  /**
   * POST /api/merchants/:merchantId/orders/:orderId/cancel
   * Cancel order and release reserved warehouse inventory
   */
  fastify.post(
    '/merchants/:merchantId/orders/:orderId/cancel',
    {
      preHandler: [authenticate, requireMerchantAccess()],
      schema: {
        tags: ['Merchant Order Management'],
        summary: 'Cancel Order and Release Inventory',
        description: 'Cancels order and atomically returns reserved units to available stock.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['merchantId', 'orderId'],
          properties: {
            merchantId: { type: 'string', format: 'uuid' },
            orderId: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          properties: {
            reason: { type: 'string', example: 'Customer requested order cancellation' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              order: OrderResponseSchema
            }
          },
          400: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const { merchantId, orderId } = request.params as { merchantId: string; orderId: string };
      const parseResult = CancelOrderInputSchema.safeParse(request.body || {});

      try {
        const order = await orderService.cancelOrder(
          orderId,
          merchantId,
          request.user.userId,
          parseResult.success ? parseResult.data : { reason: 'Order cancelled' }
        );
        return reply.status(200).send({ success: true, order });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 400 | 403 | 404 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'ORDER_CANCELLATION_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );
};
