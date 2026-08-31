import type { FastifyPluginAsync } from 'fastify';
import {
  CreateApprovalInputSchema,
  ReviewApprovalInputSchema,
  ListApprovalsQuerySchema
} from './approval.schema.js';
import { approvalService } from './approval.service.js';
import { authenticate, requireMerchantAccess, requireRole } from '../../middleware/auth.middleware.js';

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

const ApprovalResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    merchantId: { type: 'string' },
    offerId: { type: 'string' },
    requestedById: { type: 'string', nullable: true },
    approvedById: { type: 'string', nullable: true },
    status: { type: 'string' },
    requestReason: { type: 'string' },
    resolutionNotes: { type: 'string', nullable: true },
    requestedAt: { type: 'string' },
    resolvedAt: { type: 'string', nullable: true },
    offer: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        offerNumber: { type: 'string' },
        totalAmount: { type: 'number' },
        discountPercent: { type: 'number' },
        status: { type: 'string' },
        expiresAt: { type: 'string' },
        isExpired: { type: 'boolean' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              productTitle: { type: 'string' },
              quantity: { type: 'number' },
              unitPrice: { type: 'number' },
              agreedPrice: { type: 'number' },
              subtotal: { type: 'number' }
            }
          }
        }
      }
    },
    approvedBy: {
      type: 'object',
      nullable: true,
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' }
      }
    }
  }
};

export const approvalRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/merchants/:merchantId/approvals
   * Create an explicit approval request for an offer
   */
  fastify.post(
    '/merchants/:merchantId/approvals',
    {
      preHandler: [authenticate, requireMerchantAccess()],
      schema: {
        tags: ['Merchant Approvals (HITL)'],
        summary: 'Create Approval Request for High-Value Offer',
        description: 'Submits an offer into the merchant approval queue for human manager review.',
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
          required: ['offerId', 'requestReason'],
          properties: {
            offerId: { type: 'string', format: 'uuid' },
            requestReason: { type: 'string', example: 'Order total of ₹152,000 exceeds ₹100,000 limit' }
          }
        },
        response: {
          201: {
            description: 'Approval request created',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              approval: ApprovalResponseSchema
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
      const parseResult = CreateApprovalInputSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid approval request parameters.',
            details: parseResult.error.format(),
            statusCode: 400,
            requestId: request.id
          }
        });
      }

      try {
        const approval = await approvalService.createApprovalRequest(
          merchantId,
          request.user.userId,
          parseResult.data
        );
        return reply.status(201).send({ success: true, approval });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 400 | 403 | 404 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'APPROVAL_CREATION_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  /**
   * GET /api/merchants/:merchantId/approvals
   * List merchant approval queue
   */
  fastify.get(
    '/merchants/:merchantId/approvals',
    {
      preHandler: [authenticate, requireMerchantAccess()],
      schema: {
        tags: ['Merchant Approvals (HITL)'],
        summary: 'List Merchant Approval Queue',
        description: 'Retrieves all approval requests with optional status filter (PENDING, APPROVED, REJECTED).',
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
            status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'TIMED_OUT'] },
            limit: { type: 'number', default: 50 },
            offset: { type: 'number', default: 0 }
          }
        },
        response: {
          200: {
            description: 'List of approval requests',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              approvalsCount: { type: 'number' },
              approvals: {
                type: 'array',
                items: ApprovalResponseSchema
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
      const parseResult = ListApprovalsQuerySchema.safeParse(request.query);

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
        const result = await approvalService.listApprovals(merchantId, parseResult.data);
        return reply.status(200).send({ success: true, ...result });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 403 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'APPROVAL_LIST_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  /**
   * GET /api/merchants/:merchantId/approvals/:approvalId
   * View single approval request
   */
  fastify.get(
    '/merchants/:merchantId/approvals/:approvalId',
    {
      preHandler: [authenticate, requireMerchantAccess()],
      schema: {
        tags: ['Merchant Approvals (HITL)'],
        summary: 'Get Approval Request Details',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['merchantId', 'approvalId'],
          properties: {
            merchantId: { type: 'string', format: 'uuid' },
            approvalId: { type: 'string', format: 'uuid' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              approval: ApprovalResponseSchema
            }
          },
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const { merchantId, approvalId } = request.params as { merchantId: string; approvalId: string };
      try {
        const approval = await approvalService.getApprovalById(approvalId, merchantId);
        return reply.status(200).send({ success: true, approval });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 403 | 404 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'APPROVAL_FETCH_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  /**
   * POST /api/merchants/:merchantId/approvals/:approvalId/approve
   * Manager approves high-value deal (Restricted to OWNER / ADMIN)
   */
  fastify.post(
    '/merchants/:merchantId/approvals/:approvalId/approve',
    {
      preHandler: [authenticate, requireMerchantAccess(), requireRole(['OWNER', 'ADMIN'])],
      schema: {
        tags: ['Merchant Approvals (HITL)'],
        summary: 'Approve High-Value Offer (Owner / Admin Only)',
        description: 'Approves the quotation, transitioning the Offer to ACTIVE with a fresh 24h checkout window.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['merchantId', 'approvalId'],
          properties: {
            merchantId: { type: 'string', format: 'uuid' },
            approvalId: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          properties: {
            resolutionNotes: { type: 'string', example: 'Approved bulk discount for enterprise client' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              approval: ApprovalResponseSchema
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
      const { merchantId, approvalId } = request.params as { merchantId: string; approvalId: string };
      const parseResult = ReviewApprovalInputSchema.safeParse(request.body || {});

      try {
        const approval = await approvalService.approveRequest(
          approvalId,
          merchantId,
          request.user.userId,
          parseResult.success ? parseResult.data : {}
        );
        return reply.status(200).send({ success: true, approval });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 400 | 403 | 404 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'APPROVAL_ACTION_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  /**
   * POST /api/merchants/:merchantId/approvals/:approvalId/reject
   * Manager rejects high-value deal (Restricted to OWNER / ADMIN)
   */
  fastify.post(
    '/merchants/:merchantId/approvals/:approvalId/reject',
    {
      preHandler: [authenticate, requireMerchantAccess(), requireRole(['OWNER', 'ADMIN'])],
      schema: {
        tags: ['Merchant Approvals (HITL)'],
        summary: 'Reject High-Value Offer (Owner / Admin Only)',
        description: 'Declines the quotation, transitioning the Offer to REJECTED.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['merchantId', 'approvalId'],
          properties: {
            merchantId: { type: 'string', format: 'uuid' },
            approvalId: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          properties: {
            resolutionNotes: { type: 'string', example: 'Discount margin too low for current inventory' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              approval: ApprovalResponseSchema
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
      const { merchantId, approvalId } = request.params as { merchantId: string; approvalId: string };
      const parseResult = ReviewApprovalInputSchema.safeParse(request.body || {});

      try {
        const approval = await approvalService.rejectRequest(
          approvalId,
          merchantId,
          request.user.userId,
          parseResult.success ? parseResult.data : {}
        );
        return reply.status(200).send({ success: true, approval });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 400 | 403 | 404 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'APPROVAL_ACTION_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );
};
