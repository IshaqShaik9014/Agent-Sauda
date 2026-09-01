import type { FastifyPluginAsync } from 'fastify';
import { AnalyticsDateRangeQuerySchema } from './analytics.schema.js';
import { analyticsService } from './analytics.service.js';
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

const DateRangeQuerystringSchema = {
  type: 'object',
  properties: {
    startDate: { type: 'string', format: 'date-time' },
    endDate: { type: 'string', format: 'date-time' }
  }
};

export const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  // ==========================================================================
  // Merchant Commercial & Negotiation Analytics Endpoints
  // ==========================================================================

  /**
   * GET /api/merchants/:merchantId/analytics/overview
   * Retrieve core commercial revenue, profit, and margin KPIs
   */
  fastify.get(
    '/merchants/:merchantId/analytics/overview',
    {
      preHandler: [authenticate, requireMerchantAccess()],
      schema: {
        tags: ['Merchant Analytics Dashboard'],
        summary: 'Get Commercial Revenue & Margin KPIs',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['merchantId'],
          properties: {
            merchantId: { type: 'string', format: 'uuid' }
          }
        },
        querystring: DateRangeQuerystringSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              kpis: {
                type: 'object',
                properties: {
                  grossRevenue: { type: 'number' },
                  netGrossProfit: { type: 'number' },
                  averageMarginPercent: { type: 'number' },
                  totalOrdersCount: { type: 'number' },
                  paidOrdersCount: { type: 'number' },
                  completedOrdersCount: { type: 'number' },
                  averageOrderValue: { type: 'number' },
                  currency: { type: 'string' }
                }
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
      const parseResult = AnalyticsDateRangeQuerySchema.safeParse(request.query);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid date range parameters.',
            details: parseResult.error.format(),
            statusCode: 400,
            requestId: request.id
          }
        });
      }

      try {
        const kpis = await analyticsService.getCommercialKPIs(merchantId, parseResult.data);
        return reply.status(200).send({ success: true, kpis });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 403 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'ANALYTICS_QUERY_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  /**
   * GET /api/merchants/:merchantId/analytics/negotiations
   * Retrieve AI sales agent negotiation win rate and discount depth
   */
  fastify.get(
    '/merchants/:merchantId/analytics/negotiations',
    {
      preHandler: [authenticate, requireMerchantAccess()],
      schema: {
        tags: ['Merchant Analytics Dashboard'],
        summary: 'Get AI Negotiation Win Rate & Discount Analytics',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['merchantId'],
          properties: {
            merchantId: { type: 'string', format: 'uuid' }
          }
        },
        querystring: DateRangeQuerystringSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              negotiations: {
                type: 'object',
                properties: {
                  totalOffersProposed: { type: 'number' },
                  acceptedOffersCount: { type: 'number' },
                  rejectedOffersCount: { type: 'number' },
                  expiredOffersCount: { type: 'number' },
                  draftApprovalsCount: { type: 'number' },
                  negotiationWinRatePercent: { type: 'number' },
                  averageDiscountPercent: { type: 'number' },
                  totalDiscountsGiven: { type: 'number' }
                }
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
      const parseResult = AnalyticsDateRangeQuerySchema.safeParse(request.query);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid date range parameters.',
            details: parseResult.error.format(),
            statusCode: 400,
            requestId: request.id
          }
        });
      }

      try {
        const negotiations = await analyticsService.getNegotiationAnalytics(merchantId, parseResult.data);
        return reply.status(200).send({ success: true, negotiations });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 403 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'NEGOTIATION_ANALYTICS_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  /**
   * GET /api/merchants/:merchantId/analytics/approvals
   * Retrieve manager HITL approval turnaround times and approval rates
   */
  fastify.get(
    '/merchants/:merchantId/analytics/approvals',
    {
      preHandler: [authenticate, requireMerchantAccess()],
      schema: {
        tags: ['Merchant Analytics Dashboard'],
        summary: 'Get HITL Approval Turnaround Metrics',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['merchantId'],
          properties: {
            merchantId: { type: 'string', format: 'uuid' }
          }
        },
        querystring: DateRangeQuerystringSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              approvals: {
                type: 'object',
                properties: {
                  totalApprovalsRequested: { type: 'number' },
                  approvedCount: { type: 'number' },
                  rejectedCount: { type: 'number' },
                  pendingCount: { type: 'number' },
                  timedOutCount: { type: 'number' },
                  approvalRatePercent: { type: 'number' },
                  averageResolutionTimeMinutes: { type: 'number' }
                }
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
      const parseResult = AnalyticsDateRangeQuerySchema.safeParse(request.query);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid date range parameters.',
            details: parseResult.error.format(),
            statusCode: 400,
            requestId: request.id
          }
        });
      }

      try {
        const approvals = await analyticsService.getApprovalPerformance(merchantId, parseResult.data);
        return reply.status(200).send({ success: true, approvals });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 403 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'APPROVAL_ANALYTICS_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  /**
   * GET /api/merchants/:merchantId/analytics/top-products
   * Retrieve top performing negotiated products
   */
  fastify.get(
    '/merchants/:merchantId/analytics/top-products',
    {
      preHandler: [authenticate, requireMerchantAccess()],
      schema: {
        tags: ['Merchant Analytics Dashboard'],
        summary: 'Get Top Bestselling Negotiated Products',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['merchantId'],
          properties: {
            merchantId: { type: 'string', format: 'uuid' }
          }
        },
        querystring: DateRangeQuerystringSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              products: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    productId: { type: 'string' },
                    title: { type: 'string' },
                    sku: { type: 'string', nullable: true },
                    unitsSold: { type: 'number' },
                    totalRevenue: { type: 'number' },
                    averageAgreedPrice: { type: 'number' }
                  }
                }
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
      const parseResult = AnalyticsDateRangeQuerySchema.safeParse(request.query);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid date range parameters.',
            details: parseResult.error.format(),
            statusCode: 400,
            requestId: request.id
          }
        });
      }

      try {
        const products = await analyticsService.getTopProducts(merchantId, parseResult.data);
        return reply.status(200).send({ success: true, products });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 403 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'TOP_PRODUCTS_ANALYTICS_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  /**
   * GET /api/merchants/:merchantId/analytics/dashboard
   * Retrieve full executive commercial dashboard payload
   */
  fastify.get(
    '/merchants/:merchantId/analytics/dashboard',
    {
      preHandler: [authenticate, requireMerchantAccess()],
      schema: {
        tags: ['Merchant Analytics Dashboard'],
        summary: 'Get Executive Analytics Dashboard',
        description: 'Combines commercial revenue KPIs, AI negotiation win rates, HITL turnaround, and top products.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['merchantId'],
          properties: {
            merchantId: { type: 'string', format: 'uuid' }
          }
        },
        querystring: DateRangeQuerystringSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              dashboard: {
                type: 'object',
                properties: {
                  merchantId: { type: 'string' },
                  currency: { type: 'string' },
                  period: {
                    type: 'object',
                    properties: {
                      startDate: { type: 'string', nullable: true },
                      endDate: { type: 'string', nullable: true }
                    }
                  },
                  commercialKPIs: {
                    type: 'object',
                    properties: {
                      grossRevenue: { type: 'number' },
                      netGrossProfit: { type: 'number' },
                      averageMarginPercent: { type: 'number' },
                      totalOrdersCount: { type: 'number' },
                      paidOrdersCount: { type: 'number' },
                      completedOrdersCount: { type: 'number' },
                      averageOrderValue: { type: 'number' },
                      currency: { type: 'string' }
                    }
                  },
                  negotiationAnalytics: {
                    type: 'object',
                    properties: {
                      totalOffersProposed: { type: 'number' },
                      acceptedOffersCount: { type: 'number' },
                      rejectedOffersCount: { type: 'number' },
                      expiredOffersCount: { type: 'number' },
                      draftApprovalsCount: { type: 'number' },
                      negotiationWinRatePercent: { type: 'number' },
                      averageDiscountPercent: { type: 'number' },
                      totalDiscountsGiven: { type: 'number' }
                    }
                  },
                  approvalPerformance: {
                    type: 'object',
                    properties: {
                      totalApprovalsRequested: { type: 'number' },
                      approvedCount: { type: 'number' },
                      rejectedCount: { type: 'number' },
                      pendingCount: { type: 'number' },
                      timedOutCount: { type: 'number' },
                      approvalRatePercent: { type: 'number' },
                      averageResolutionTimeMinutes: { type: 'number' }
                    }
                  },
                  topProducts: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        productId: { type: 'string' },
                        title: { type: 'string' },
                        sku: { type: 'string', nullable: true },
                        unitsSold: { type: 'number' },
                        totalRevenue: { type: 'number' },
                        averageAgreedPrice: { type: 'number' }
                      }
                    }
                  }
                }
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
      const parseResult = AnalyticsDateRangeQuerySchema.safeParse(request.query);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid date range parameters.',
            details: parseResult.error.format(),
            statusCode: 400,
            requestId: request.id
          }
        });
      }

      try {
        const dashboard = await analyticsService.getFullDashboard(merchantId, parseResult.data);
        return reply.status(200).send({ success: true, dashboard });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 403 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'DASHBOARD_ANALYTICS_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );
};
