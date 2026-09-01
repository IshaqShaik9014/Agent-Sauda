import type { FastifyPluginAsync } from 'fastify';
import {
  UpdatePolicyInputSchema,
  OfferEvaluationInputSchema
} from './policy.schema.js';
import { policyService } from './policy.service.js';
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

export const policyRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/merchants/:merchantId/policy
   * Retrieves the active policy configuration for a merchant.
   */
  fastify.get(
    '/merchants/:merchantId/policy',
    {
      preHandler: [authenticate, requireMerchantAccess('merchantId')],
      schema: {
        tags: ['Merchant Policy Engine'],
        summary: 'Get Merchant Policy Configuration',
        description: 'Retrieves active discount limits, margin floors, and autonomous order thresholds for the merchant.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['merchantId'],
          properties: {
            merchantId: { type: 'string', format: 'uuid' }
          }
        },
        response: {
          200: {
            description: 'Active merchant policy',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              policy: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  merchantId: { type: 'string' },
                  maxDiscountPercent: { type: 'number' },
                  minimumMarginPercent: { type: 'number' },
                  autonomousOrderLimit: { type: 'number' },
                  approvalThreshold: { type: 'number', nullable: true },
                  maxQuantityPerOrder: { type: 'number' },
                  isActive: { type: 'boolean' }
                }
              }
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
      try {
        const policy = await policyService.getMerchantPolicy(merchantId);
        return reply.status(200).send({
          success: true,
          policy
        });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode === 404 ? 404 : 500) as 404 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'POLICY_FETCH_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  /**
   * PUT /api/merchants/:merchantId/policy
   * Updates merchant policy parameters and snapshots previous version in policy_versions.
   */
  fastify.put(
    '/merchants/:merchantId/policy',
    {
      preHandler: [authenticate, requireMerchantAccess('merchantId')],
      schema: {
        tags: ['Merchant Policy Engine'],
        summary: 'Update Merchant Policy Parameters',
        description:
          'Updates discount caps, minimum gross margin floors, or spending caps. ' +
          'Automatically archives previous version to policy_versions and writes an immutable audit event.',
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
          properties: {
            maxDiscountPercent: { type: 'number', minimum: 0, maximum: 100, example: 10.0 },
            minimumMarginPercent: { type: 'number', minimum: 0, maximum: 100, example: 20.0 },
            autonomousOrderLimit: { type: 'number', minimum: 0, example: 150000.0 },
            maxQuantityPerOrder: { type: 'number', minimum: 1, example: 75 },
            isActive: { type: 'boolean', example: true }
          }
        },
        response: {
          200: {
            description: 'Policy updated successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              policy: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  merchantId: { type: 'string' },
                  maxDiscountPercent: { type: 'number' },
                  minimumMarginPercent: { type: 'number' },
                  autonomousOrderLimit: { type: 'number' },
                  approvalThreshold: { type: 'number', nullable: true },
                  maxQuantityPerOrder: { type: 'number' },
                  rules: { type: 'object', additionalProperties: true },
                  isActive: { type: 'boolean' }
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
      const parseResult = UpdatePolicyInputSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid policy parameters.',
            details: parseResult.error.format(),
            statusCode: 400,
            requestId: request.id
          }
        });
      }

      try {
        const policy = await policyService.updatePolicy(
          merchantId,
          request.user.userId,
          parseResult.data
        );
        return reply.status(200).send({
          success: true,
          policy
        });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode || 500) as 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'POLICY_UPDATE_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  /**
   * POST /api/merchants/:merchantId/policy/evaluate
   * Evaluates a proposed deal against active merchant policy.
   * Outputs deterministic decision: ALLOW | COUNTER | APPROVAL_REQUIRED | REJECT.
   */
  fastify.post(
    '/merchants/:merchantId/policy/evaluate',
    {
      schema: {
        tags: ['Merchant Policy Engine'],
        summary: 'Evaluate Proposed Deal Against Policy (Deterministic Engine)',
        description:
          'Evaluates proposed prices and quantities against merchant rules. ' +
          'Returns a deterministic decision (ALLOW / COUNTER / APPROVAL_REQUIRED / REJECT) with full mathematical proof.',
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
            items: {
              type: 'array',
              items: {
                type: 'object',
                required: ['productId', 'quantity', 'proposedUnitPrice'],
                properties: {
                  productId: { type: 'string', format: 'uuid' },
                  quantity: { type: 'number', minimum: 1, example: 5 },
                  proposedUnitPrice: { type: 'number', minimum: 1, example: 13000 }
                }
              }
            },
            customerTier: { type: 'string', example: 'STANDARD' }
          }
        },
        response: {
          200: {
            description: 'Deterministic policy decision with mathematical breakdown',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              evaluation: {
                type: 'object',
                properties: {
                  decision: { type: 'string', enum: ['ALLOW', 'COUNTER', 'APPROVAL_REQUIRED', 'REJECT'] },
                  allowed: { type: 'boolean' },
                  requiresApproval: { type: 'boolean' },
                  totalBaseAmount: { type: 'number' },
                  totalProposedAmount: { type: 'number' },
                  totalEffectiveDiscountPercent: { type: 'number' },
                  averageGrossMarginPercent: { type: 'number' },
                  reasons: { type: 'array', items: { type: 'string' } },
                  counterOffer: {
                    type: 'object',
                    properties: {
                      totalCounterAmount: { type: 'number' },
                      counterDiscountPercent: { type: 'number' },
                      items: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            productId: { type: 'string' },
                            quantity: { type: 'number' },
                            counterUnitPrice: { type: 'number' },
                            originalBasePrice: { type: 'number' },
                            discountPercent: { type: 'number' }
                          }
                        }
                      }
                    }
                  },
                  breakdowns: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        ruleName: { type: 'string' },
                        passed: { type: 'boolean' },
                        value: { type: 'number' },
                        threshold: { type: 'number' },
                        message: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          },
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const { merchantId } = request.params as { merchantId: string };
      const parseResult = OfferEvaluationInputSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid offer evaluation input.',
            details: parseResult.error.format(),
            statusCode: 400,
            requestId: request.id
          }
        });
      }

      try {
        const evaluation = await policyService.evaluateOffer(
          merchantId,
          request.user?.userId,
          parseResult.data
        );

        return reply.status(200).send({
          success: true,
          evaluation
        });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode === 404 ? 404 : 500) as 404 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'POLICY_EVALUATION_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );
};
