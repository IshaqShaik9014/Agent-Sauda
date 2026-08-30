import type { FastifyPluginAsync } from 'fastify';
import {
  CreateOfferInputSchema,
  AcceptOfferInputSchema,
  RejectOfferInputSchema,
  ListOffersQuerySchema
} from './offer.schema.js';
import { offerService } from './offer.service.js';
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

const OfferItemResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    offerId: { type: 'string' },
    productId: { type: 'string' },
    variantId: { type: 'string', nullable: true },
    quantity: { type: 'number' },
    unitPrice: { type: 'number' },
    agreedPrice: { type: 'number' },
    subtotal: { type: 'number' },
    productTitle: { type: 'string' },
    productSlug: { type: 'string' }
  }
};

const OfferResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    merchantId: { type: 'string' },
    conversationId: { type: 'string' },
    offerNumber: { type: 'string' },
    subtotal: { type: 'number' },
    discountAmount: { type: 'number' },
    discountPercent: { type: 'number' },
    taxAmount: { type: 'number' },
    totalAmount: { type: 'number' },
    marginPercent: { type: 'number' },
    policyDecision: { type: 'string' },
    policyReason: { type: 'string' },
    status: { type: 'string' },
    expiresAt: { type: 'string' },
    isExpired: { type: 'boolean' },
    checkoutUrl: { type: 'string' },
    items: {
      type: 'array',
      items: OfferItemResponseSchema
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

export const offerRoutes: FastifyPluginAsync = async (fastify) => {
  // ==========================================================================
  // Merchant Scoped Routes (Authenticated)
  // ==========================================================================

  /**
   * POST /api/merchants/:merchantId/offers
   * Create a formal commercial offer
   */
  fastify.post(
    '/merchants/:merchantId/offers',
    {
      preHandler: [authenticate, requireMerchantAccess()],
      schema: {
        tags: ['Merchant Offer Management'],
        summary: 'Create a formal commercial Offer',
        description: 'Creates an immutable, time-bound commercial Offer with item breakdown and checkout URL.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['merchantId'],
          properties: {
            merchantId: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          required: ['items'],
          properties: {
            conversationId: { type: 'string', format: 'uuid' },
            expirationHours: { type: 'number', default: 24 },
            customerTier: { type: 'string', example: 'STANDARD' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                required: ['productId', 'quantity', 'agreedPrice'],
                properties: {
                  productId: { type: 'string', format: 'uuid' },
                  variantId: { type: 'string', format: 'uuid' },
                  quantity: { type: 'number', minimum: 1 },
                  agreedPrice: { type: 'number', positive: true }
                }
              }
            }
          }
        },
        response: {
          201: {
            description: 'Offer created successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              offer: OfferResponseSchema
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
      const { merchantId } = request.params as { merchantId: string };
      const parseResult = CreateOfferInputSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid offer parameters.',
            details: parseResult.error.format(),
            statusCode: 400,
            requestId: request.id
          }
        });
      }

      try {
        const offer = await offerService.createOffer(
          merchantId,
          request.user.userId,
          parseResult.data
        );
        return reply.status(201).send({ success: true, offer });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 400 | 403 | 404 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'OFFER_CREATION_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  /**
   * GET /api/merchants/:merchantId/offers
   * List merchant offers
   */
  fastify.get(
    '/merchants/:merchantId/offers',
    {
      preHandler: [authenticate, requireMerchantAccess()],
      schema: {
        tags: ['Merchant Offer Management'],
        summary: 'List Merchant Offers',
        description: 'Retrieves all formal offers issued by the merchant with status and pagination filters.',
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
            status: { type: 'string', enum: ['DRAFT', 'ACTIVE', 'ACCEPTED', 'SUPERSEDED', 'EXPIRED', 'REJECTED'] },
            conversationId: { type: 'string', format: 'uuid' },
            limit: { type: 'number', default: 50 },
            offset: { type: 'number', default: 0 }
          }
        },
        response: {
          200: {
            description: 'List of offers',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              offersCount: { type: 'number' },
              offers: {
                type: 'array',
                items: OfferResponseSchema
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
      const parseResult = ListOffersQuerySchema.safeParse(request.query);

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
        const result = await offerService.listOffers(merchantId, parseResult.data);
        return reply.status(200).send({ success: true, ...result });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 403 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'OFFER_LIST_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  /**
   * GET /api/merchants/:merchantId/offers/:offerId
   * View single merchant offer details
   */
  fastify.get(
    '/merchants/:merchantId/offers/:offerId',
    {
      preHandler: [authenticate, requireMerchantAccess()],
      schema: {
        tags: ['Merchant Offer Management'],
        summary: 'Get Merchant Offer Details',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['merchantId', 'offerId'],
          properties: {
            merchantId: { type: 'string', format: 'uuid' },
            offerId: { type: 'string', format: 'uuid' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              offer: OfferResponseSchema
            }
          },
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const { merchantId, offerId } = request.params as { merchantId: string; offerId: string };
      try {
        const offer = await offerService.getOfferById(offerId, merchantId);
        return reply.status(200).send({ success: true, offer });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 403 | 404 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'OFFER_FETCH_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  // ==========================================================================
  // Public Buyer Checkout Routes
  // ==========================================================================

  /**
   * GET /api/offers/:offerId
   * Public checkout view for buyers
   */
  fastify.get(
    '/offers/:offerId',
    {
      schema: {
        tags: ['Public Buyer Checkout'],
        summary: 'View Offer for Buyer Checkout',
        description: 'Public endpoint for buyer checkout flow to view agreed terms and expiration timestamp.',
        params: {
          type: 'object',
          required: ['offerId'],
          properties: {
            offerId: { type: 'string', format: 'uuid' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              offer: OfferResponseSchema
            }
          },
          404: ErrorResponseSchema,
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const { offerId } = request.params as { offerId: string };
      try {
        const offer = await offerService.getOfferById(offerId);
        return reply.status(200).send({ success: true, offer });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode === 404 ? 404 : 500) as 404 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'OFFER_NOT_FOUND',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  /**
   * POST /api/offers/:offerId/accept
   * Buyer accepts the formal offer
   */
  fastify.post(
    '/offers/:offerId/accept',
    {
      schema: {
        tags: ['Public Buyer Checkout'],
        summary: 'Accept Formal Offer',
        description: 'Buyer confirms acceptance of the negotiated terms, advancing status to ACCEPTED.',
        params: {
          type: 'object',
          required: ['offerId'],
          properties: {
            offerId: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          properties: {
            buyerSessionId: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              offer: OfferResponseSchema
            }
          },
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const { offerId } = request.params as { offerId: string };
      const parseResult = AcceptOfferInputSchema.safeParse(request.body || {});

      try {
        const offer = await offerService.acceptOffer(
          offerId,
          parseResult.success ? parseResult.data : {},
          (request as any).user?.userId
        );
        return reply.status(200).send({ success: true, offer });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 400 | 404 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'OFFER_ACCEPTANCE_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  /**
   * POST /api/offers/:offerId/reject
   * Reject formal offer
   */
  fastify.post(
    '/offers/:offerId/reject',
    {
      schema: {
        tags: ['Public Buyer Checkout'],
        summary: 'Reject Formal Offer',
        description: 'Buyer or merchant rejects the offer, advancing status to REJECTED.',
        params: {
          type: 'object',
          required: ['offerId'],
          properties: {
            offerId: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          properties: {
            reason: { type: 'string', default: 'Customer rejected the offer' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              offer: OfferResponseSchema
            }
          },
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const { offerId } = request.params as { offerId: string };
      const parseResult = RejectOfferInputSchema.safeParse(request.body || {});

      try {
        const offer = await offerService.rejectOffer(
          offerId,
          parseResult.success ? parseResult.data : { reason: 'Customer rejected the offer' },
          (request as any).user?.userId
        );
        return reply.status(200).send({ success: true, offer });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 400 | 404 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'OFFER_REJECTION_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );
};
