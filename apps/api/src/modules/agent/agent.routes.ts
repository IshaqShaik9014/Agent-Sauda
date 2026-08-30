import type { FastifyPluginAsync } from 'fastify';
import { ChatInputSchema } from './agent.schema.js';
import { agentService } from './agent.service.js';

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

export const agentRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/merchants/:merchantId/agent/chat
   * Interactive sales negotiation chat with tool calling loop.
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
          200: {
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
          },
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
};
