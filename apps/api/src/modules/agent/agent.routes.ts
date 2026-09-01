import type { FastifyPluginAsync } from 'fastify';
import { ChatInputSchema } from './agent.schema.js';
import { agentService } from './agent.service.js';
import { prisma } from '@agent-sauda/database';

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

const ChatResponseObjectSchema = {
  description: 'AI sales agent response with executed tool calls and policy decision',
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    conversationId: { type: 'string' },
    message: { type: 'string' },
    toolCallsExecuted: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          arguments: { type: 'object' }
        }
      }
    },
    evaluationResult: {
      type: 'object',
      properties: {
        decision: { type: 'string' },
        allowed: { type: 'boolean' },
        requiresApproval: { type: 'boolean' },
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
        }
      }
    }
  }
};

export const agentRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/merchants/:merchantId/agent/chat
   * Interactive sales negotiation chat with tool calling loop (merchant scoped).
   */
  fastify.post(
    '/merchants/:merchantId/agent/chat',
    {
      schema: {
        tags: ['Agent Tools & Public Catalog'],
        summary: 'Chat with AI Sales Agent (Tool Calling Negotiation Loop)',
        description:
          'Interacts with the merchant AI sales agent. ' +
          'The agent autonomously executes tools (search_catalog, check_inventory, propose_offer) to negotiate and answer buyer questions safely.',
        params: {
          type: 'object',
          required: ['merchantId'],
          properties: {
            merchantId: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          required: ['message'],
          properties: {
            conversationId: { type: 'string', format: 'uuid', description: 'Existing conversation UUID to continue a thread' },
            message: { type: 'string', example: 'I want to buy 3 Nexus chairs, can you do ₹19,000 each?' },
            customerId: { type: 'string', example: 'buyer_123' },
            customerName: { type: 'string', example: 'David Warner' }
          }
        },
        response: {
          200: ChatResponseObjectSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const { merchantId } = request.params as { merchantId: string };
      const parseResult = ChatInputSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid chat message parameters.',
            details: parseResult.error.format(),
            statusCode: 400,
            requestId: request.id
          }
        });
      }

      try {
        const result = await agentService.chat(
          merchantId,
          parseResult.data,
          (request as any).user?.userId
        );

        return reply.status(200).send(result);
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode === 404 ? 404 : 500) as 404 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'AGENT_CHAT_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  /**
   * POST /api/agent/chat
   * Public chat endpoint supporting merchantId or merchantSlug in body/query.
   */
  fastify.post(
    '/agent/chat',
    {
      schema: {
        tags: ['Agent Tools & Public Catalog'],
        summary: 'Public Chat with AI Sales Agent',
        description: 'Public endpoint for buyer chat negotiation.',
        querystring: {
          type: 'object',
          properties: {
            merchantId: { type: 'string', format: 'uuid' },
            merchantSlug: { type: 'string' }
          }
        },
        body: {
          type: 'object',
          required: ['message'],
          properties: {
            merchantId: { type: 'string', format: 'uuid' },
            merchantSlug: { type: 'string' },
            conversationId: { type: 'string', format: 'uuid' },
            message: { type: 'string' },
            customerId: { type: 'string' },
            customerName: { type: 'string' }
          }
        },
        response: {
          200: ChatResponseObjectSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const query = request.query as { merchantId?: string; merchantSlug?: string };
      const body = request.body as any;

      const merchantId = body?.merchantId || query?.merchantId;
      const merchantSlug = body?.merchantSlug || query?.merchantSlug;

      let targetMerchantId = merchantId;

      if (!targetMerchantId && merchantSlug) {
        const merchant = await prisma.merchant.findUnique({
          where: { slug: merchantSlug }
        });
        if (merchant) {
          targetMerchantId = merchant.id;
        }
      }

      if (!targetMerchantId) {
        // Fall back to first available merchant if not specified
        const firstMerchant = await prisma.merchant.findFirst();
        if (firstMerchant) {
          targetMerchantId = firstMerchant.id;
        } else {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'MERCHANT_NOT_FOUND',
              message: 'No merchant found to handle negotiation.',
              statusCode: 404,
              requestId: request.id
            }
          });
        }
      }

      const parseResult = ChatInputSchema.safeParse(body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid chat message parameters.',
            details: parseResult.error.format(),
            statusCode: 400,
            requestId: request.id
          }
        });
      }

      try {
        const result = await agentService.chat(targetMerchantId, parseResult.data);
        return reply.status(200).send(result);
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode === 404 ? 404 : 500) as 404 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'AGENT_CHAT_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );
};
