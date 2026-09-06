import type { FastifyPluginAsync } from 'fastify';
import { ChatInputSchema } from './agent.schema.js';
import { agentService } from './agent.service.js';
import { agentStreamManager } from './agent.stream.js';
import { buildSystemPrompt } from './agent.prompts.js';
import { offerService } from '../offer/offer.service.js';
import { notificationService } from '../notification/notification.service.js';
import { prisma } from '@agent-sauda/database';
import { sanitizeString } from '../../lib/sanitize.js';
import type { AgentContext } from './agent.types.js';
import type { ChatMessage } from '@agent-sauda/domain';

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
    },
    activeOffer: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string' },
        totalAmount: { type: 'number' },
        currency: { type: 'string' },
        itemsCount: { type: 'number' }
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
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute'
        }
      },
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

      // XSS Input Sanitization
      parseResult.data.message = sanitizeString(parseResult.data.message);
      if (parseResult.data.customerName) {
        parseResult.data.customerName = sanitizeString(parseResult.data.customerName);
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
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute'
        }
      },
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

      // XSS Input Sanitization
      parseResult.data.message = sanitizeString(parseResult.data.message);
      if (parseResult.data.customerName) {
        parseResult.data.customerName = sanitizeString(parseResult.data.customerName);
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

  /**
   * POST /api/agent/chat/stream
   * Real-time Server-Sent Events (SSE) streaming chat endpoint.
   * Progressively streams token chunks, tool execution events, and dynamic quote cards.
   */
  fastify.post(
    '/agent/chat/stream',
    {
      config: {
        rateLimit: {
          max: 40,
          timeWindow: '1 minute'
        }
      }
    },
    async (request, reply) => {
      const body = request.body as any;
      const merchantSlug = body?.merchantSlug || 'abc-furniture';

      const merchant = await prisma.merchant.findFirst({
        where: body?.merchantId ? { id: body.merchantId } : { slug: merchantSlug }
      });

      if (!merchant) {
        return reply.status(404).send({ success: false, error: 'Merchant not found' });
      }

      // Set Server-Sent Events (SSE) Response Headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      const writeEvent = (event: string, data: Record<string, unknown> | string) => {
        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        reply.raw.write(`event: ${event}\ndata: ${payload}\n\n`);
      };

      try {
        const userText = sanitizeString(body?.message || '');

        // 1. Resolve or create Conversation
        let conversation = body?.conversationId
          ? await prisma.conversation.findFirst({
              where: { id: body.conversationId, merchantId: merchant.id },
              include: { messages: { orderBy: { createdAt: 'asc' }, take: 30 } }
            })
          : null;

        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: {
              merchantId: merchant.id,
              buyerId: body?.customerId || null,
              buyerSessionId: body?.customerId || `session_${Date.now()}`,
              channel: 'WEB',
              status: 'ACTIVE'
            },
            include: { messages: true }
          });
        }

        // 2. Persist User Message
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            sender: 'BUYER',
            content: userText
          }
        });

        // 3. Build Context
        const history: ChatMessage[] = conversation.messages.map((m) => ({
          id: m.id,
          role: m.sender === 'BUYER' ? 'user' : 'assistant',
          content: m.content,
          createdAt: m.createdAt
        }));
        history.push({ role: 'user', content: userText });

        const ctx: AgentContext = {
          merchantId: merchant.id,
          merchantName: merchant.name,
          merchantSlug: merchant.slug,
          currency: merchant.currency,
          conversationId: conversation.id,
          messages: history
        };

        const systemPrompt = buildSystemPrompt(ctx);

        // 4. Stream Turn
        const streamResult = await agentStreamManager.streamTurn(ctx, systemPrompt, {
          writeEvent,
          close: () => reply.raw.end()
        });

        // 5. Check if offer created
        let createdOffer: any = null;
        if (streamResult.evaluation && (streamResult.evaluation.decision === 'ALLOW' || streamResult.evaluation.decision === 'APPROVAL_REQUIRED')) {
          const proposeCall = streamResult.toolCallsExecuted.find((c) => c.name === 'propose_offer');
          const items = (proposeCall?.arguments as any)?.items;
          if (items && Array.isArray(items) && items.length > 0) {
            try {
              const isApprovalRequired = streamResult.evaluation.decision === 'APPROVAL_REQUIRED';
              const offer = await offerService.createOffer(merchant.id, undefined, {
                conversationId: conversation.id,
                expirationHours: 24,
                forceDraft: isApprovalRequired,
                items: items.map((i: any) => ({
                  productId: i.productId,
                  variantId: i.variantId,
                  quantity: Number(i.quantity),
                  agreedPrice: Number(i.proposedUnitPrice ?? i.agreedPrice)
                }))
              });

              createdOffer = {
                id: offer.id,
                status: offer.status,
                totalAmount: offer.totalAmount,
                currency: merchant.currency,
                itemsCount: offer.items.length
              };

              // Notify frontend about offer
              writeEvent('offer_ready', { offer: createdOffer });

              // If approval required, dispatch real-time manager notification alert
              if (isApprovalRequired) {
                await notificationService.dispatchApprovalAlert({
                  merchantId: merchant.id,
                  merchantName: merchant.name,
                  offerId: offer.id,
                  offerNumber: offer.offerNumber,
                  productTitle: offer.items[0]?.productTitle || 'Product',
                  quantity: offer.items[0]?.quantity || 1,
                  originalPrice: offer.items[0]?.unitPrice || offer.subtotal,
                  proposedPrice: offer.items[0]?.agreedPrice || offer.totalAmount,
                  costPrice: 0,
                  discountPercent: offer.discountPercent ?? 0,
                  marginPercent: offer.marginPercent ?? 0,
                  customerName: body?.customerName || 'Buyer'
                });
              }
            } catch (offerErr) {
              console.warn('[StreamChat] Could not create offer:', offerErr);
            }
          }
        }

        // 6. Persist Assistant Reply
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            sender: 'AGENT',
            content: streamResult.reply,
            toolCalls: (streamResult.toolCallsExecuted as any) ?? null
          }
        });

        writeEvent('done', {
          conversationId: conversation.id,
          activeOffer: createdOffer
        });

        reply.raw.end();
      } catch (streamErr) {
        writeEvent('error', { message: (streamErr as Error).message });
        reply.raw.end();
      }
    }
  );
};
