import type { FastifyPluginAsync } from 'fastify';
import {
  ListAuditEventsQuerySchema,
  AuditExportQuerySchema
} from './audit.schema.js';
import { auditService } from './audit.service.js';
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

const AuditEventResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    merchantId: { type: 'string' },
    entityType: { type: 'string' },
    entityId: { type: 'string' },
    action: { type: 'string' },
    actorType: { type: 'string' },
    actorId: { type: 'string', nullable: true },
    reason: { type: 'string', nullable: true },
    metadata: { type: 'object', additionalProperties: true, nullable: true },
    createdAt: { type: 'string' }
  }
};

export const auditRoutes: FastifyPluginAsync = async (fastify) => {
  // ==========================================================================
  // Merchant Audit Trail & Forensic Endpoints
  // ==========================================================================

  /**
   * GET /api/merchants/:merchantId/audit
   * Query merchant audit events with filtering and pagination
   */
  fastify.get(
    '/merchants/:merchantId/audit',
    {
      preHandler: [authenticate, requireMerchantAccess()],
      schema: {
        tags: ['Audit & Compliance Engine'],
        summary: 'Query Merchant Audit Logs',
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
            entityType: { type: 'string' },
            entityId: { type: 'string' },
            action: { type: 'string' },
            actorType: { type: 'string', enum: ['USER', 'SYSTEM', 'AI_AGENT', 'WEBHOOK'] },
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
            limit: { type: 'number', default: 50 },
            offset: { type: 'number', default: 0 }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              eventsCount: { type: 'number' },
              events: {
                type: 'array',
                items: AuditEventResponseSchema
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
      const parseResult = ListAuditEventsQuerySchema.safeParse(request.query);

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
        const result = await auditService.listAuditEvents(merchantId, parseResult.data);
        return reply.status(200).send({ success: true, ...result });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 403 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'AUDIT_QUERY_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  /**
   * GET /api/merchants/:merchantId/audit/forensic/:entityType/:entityId
   * Reconstruct full multi-entity forensic timeline
   */
  fastify.get(
    '/merchants/:merchantId/audit/forensic/:entityType/:entityId',
    {
      preHandler: [authenticate, requireMerchantAccess()],
      schema: {
        tags: ['Audit & Compliance Engine'],
        summary: 'Reconstruct Deal Forensic Timeline',
        description: 'Aggregates connected events across Conversation, Offer, Order, Payment, and Inventory.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['merchantId', 'entityType', 'entityId'],
          properties: {
            merchantId: { type: 'string', format: 'uuid' },
            entityType: { type: 'string' },
            entityId: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              entityType: { type: 'string' },
              entityId: { type: 'string' },
              merchantId: { type: 'string' },
              totalEvents: { type: 'number' },
              timeline: {
                type: 'array',
                items: AuditEventResponseSchema
              }
            }
          },
          403: ErrorResponseSchema,
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const { merchantId, entityType, entityId } = request.params as {
        merchantId: string;
        entityType: string;
        entityId: string;
      };

      try {
        const result = await auditService.getForensicTimeline(merchantId, entityType, entityId);
        return reply.status(200).send({ success: true, ...result });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 403 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'FORENSIC_FETCH_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  /**
   * GET /api/merchants/:merchantId/audit/export
   * Export compliance report in JSON or CSV format
   */
  fastify.get(
    '/merchants/:merchantId/audit/export',
    {
      preHandler: [authenticate, requireMerchantAccess()],
      schema: {
        tags: ['Audit & Compliance Engine'],
        summary: 'Export Regulatory Compliance Audit Report',
        description: 'Downloads RFC 4180 CSV or structured JSON compliance export.',
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
            format: { type: 'string', enum: ['json', 'csv'], default: 'json' },
            entityType: { type: 'string' },
            action: { type: 'string' },
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' }
          }
        },
        response: {
          400: ErrorResponseSchema,
          403: ErrorResponseSchema,
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const { merchantId } = request.params as { merchantId: string };
      const parseResult = AuditExportQuerySchema.safeParse(request.query);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid export query filters.',
            details: parseResult.error.format(),
            statusCode: 400,
            requestId: request.id
          }
        });
      }

      try {
        const { contentType, filename, data } = await auditService.exportAuditReport(
          merchantId,
          parseResult.data
        );

        reply.header('Content-Type', contentType);
        reply.header('Content-Disposition', `attachment; filename="${filename}"`);
        return reply.send(data);
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 403 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'AUDIT_EXPORT_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );
};
