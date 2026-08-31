import type { FastifyPluginAsync } from 'fastify';
import {
  VerifyPaymentInputSchema,
  ListWebhooksQuerySchema
} from './webhook.schema.js';
import { webhookService } from './webhook.service.js';
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

const WebhookEventResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    eventId: { type: 'string' },
    eventType: { type: 'string' },
    status: { type: 'string' },
    processingError: { type: 'string', nullable: true },
    receivedAt: { type: 'string' },
    processedAt: { type: 'string', nullable: true }
  }
};

export const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  // ==========================================================================
  // Razorpay Gateway Webhook Ingestion Endpoint
  // ==========================================================================

  /**
   * POST /api/webhooks/razorpay
   * Asynchronous Razorpay webhook ingestion with HMAC SHA256 verification
   */
  fastify.post(
    '/webhooks/razorpay',
    {
      schema: {
        tags: ['Payment Webhooks'],
        summary: 'Ingest Razorpay Webhook Event',
        description:
          'Receives cryptographic webhook events from Razorpay (payment.captured, payment.failed) with idempotency.',
        headers: {
          type: 'object',
          properties: {
            'x-razorpay-signature': { type: 'string' }
          }
        },
        response: {
          200: {
            description: 'Webhook received and processed',
            type: 'object',
            properties: {
              received: { type: 'boolean' },
              alreadyProcessed: { type: 'boolean' },
              eventId: { type: 'string' },
              status: { type: 'string' }
            }
          },
          400: ErrorResponseSchema,
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const signature = request.headers['x-razorpay-signature'] as string | undefined;
      const rawBody = typeof request.body === 'string' ? request.body : JSON.stringify(request.body || {});

      try {
        const result = await webhookService.verifyAndProcessWebhook(
          rawBody,
          signature,
          request.body
        );
        return reply.status(200).send(result);
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 400 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'WEBHOOK_PROCESSING_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  // ==========================================================================
  // Client-Side Payment Signature Verification Endpoint
  // ==========================================================================

  /**
   * POST /api/payments/verify
   * Verify signature returned to buyer upon Razorpay modal completion
   */
  fastify.post(
    '/payments/verify',
    {
      schema: {
        tags: ['Public Buyer Payments'],
        summary: 'Verify Razorpay Client Payment Signature',
        description: 'Validates HMAC signature of orderId|paymentId and transitions order to PAID status.',
        body: {
          type: 'object',
          required: ['orderId', 'razorpayOrderId', 'razorpayPaymentId', 'razorpaySignature'],
          properties: {
            orderId: { type: 'string', format: 'uuid' },
            razorpayOrderId: { type: 'string' },
            razorpayPaymentId: { type: 'string' },
            razorpaySignature: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              orderId: { type: 'string' },
              paymentId: { type: 'string' }
            }
          },
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const parseResult = VerifyPaymentInputSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid payment verification payload.',
            details: parseResult.error.format(),
            statusCode: 400,
            requestId: request.id
          }
        });
      }

      try {
        const result = await webhookService.verifyClientPayment(parseResult.data);
        return reply.status(200).send(result);
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 400 | 404 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'PAYMENT_VERIFICATION_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  // ==========================================================================
  // Merchant Webhooks Audit Log
  // ==========================================================================

  /**
   * GET /api/merchants/:merchantId/webhooks
   * List received webhook events
   */
  fastify.get(
    '/merchants/:merchantId/webhooks',
    {
      preHandler: [authenticate, requireMerchantAccess()],
      schema: {
        tags: ['Payment Webhooks'],
        summary: 'List Ingested Webhook Events',
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
            status: { type: 'string', enum: ['PENDING', 'PROCESSED', 'FAILED', 'IGNORED'] },
            limit: { type: 'number', default: 50 },
            offset: { type: 'number', default: 0 }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              webhooksCount: { type: 'number' },
              webhooks: {
                type: 'array',
                items: WebhookEventResponseSchema
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
      const parseResult = ListWebhooksQuerySchema.safeParse(request.query);

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
        const result = await webhookService.listWebhooks(parseResult.data);
        return reply.status(200).send({ success: true, ...result });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 403 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'WEBHOOKS_LIST_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );
};
