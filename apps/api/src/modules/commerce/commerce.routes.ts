import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@agent-sauda/database';
import { agentService } from '../agent/agent.service.js';

export const commerceRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/v1/commerce/process
   * Unified B2B Commerce Ingestion Endpoint for Existing AI Assistants.
   * Enables third-party chatbots to delegate commerce, knowledge RAG,
   * negotiation, and policy enforcement to Agent Sauda with zero replatforming.
   */
  fastify.post(
    '/v1/commerce/process',
    {
      schema: {
        tags: ['B2B Commerce SDK & Gateway'],
        summary: 'Process Natural Language Commerce Request from Existing Assistant',
        description: 'Primary B2B integration point. Existing chatbots forward customer messages here to execute merchant-grounded RAG, product discovery, deterministic negotiation, or checkout preparation.',
        body: {
          type: 'object',
          required: ['merchantId', 'message'],
          properties: {
            merchantId: { type: 'string', format: 'uuid', description: 'The authenticated merchant identifier' },
            merchantSlug: { type: 'string', description: 'Optional merchant slug for lookup' },
            conversationId: { type: 'string', description: 'Existing chatbot conversation/session ID' },
            message: { type: 'string', description: 'Customer natural language message' },
            customerId: { type: 'string', description: 'Customer ID or unique session token' },
            customerName: { type: 'string', description: 'Customer name if known' }
          }
        }
      }
    },
    async (request, reply) => {
      const body = request.body as {
        merchantId: string;
        merchantSlug?: string;
        conversationId?: string;
        message: string;
        customerId?: string;
        customerName?: string;
      };

      // 1. Validate Merchant
      const merchant = await prisma.merchant.findUnique({
        where: { id: body.merchantId },
        select: { id: true, name: true, slug: true, currency: true }
      });

      if (!merchant) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'MERCHANT_NOT_FOUND',
            message: `Merchant with ID "${body.merchantId}" was not found.`
          }
        });
      }

      // 2. Delegate to Conversational Agent Service
      const chatResponse = await agentService.chat(
        merchant.id,
        {
          conversationId: body.conversationId,
          message: body.message,
          customerId: body.customerId,
          customerName: body.customerName
        },
        'b2b-assistant-gateway'
      );

      // 3. Classify response action for the integrating assistant
      let actionType: 'KNOWLEDGE' | 'NEGOTIATION' | 'DISCOVERY' | 'GENERAL' = 'GENERAL';
      const executedTools = chatResponse.toolCallsExecuted || [];

      if (executedTools.some((t) => t.name === 'search_merchant_knowledge')) {
        actionType = 'KNOWLEDGE';
      } else if (executedTools.some((t) => t.name === 'propose_offer')) {
        actionType = 'NEGOTIATION';
      } else if (executedTools.some((t) => t.name === 'search_catalog')) {
        actionType = 'DISCOVERY';
      }

      return reply.status(200).send({
        success: true,
        actionType,
        merchant: {
          id: merchant.id,
          name: merchant.name,
          currency: merchant.currency
        },
        conversationId: chatResponse.conversationId,
        reply: chatResponse.message,
        evaluationResult: chatResponse.evaluationResult,
        toolsExecuted: executedTools.map((t) => t.name)
      });
    }
  );

  /**
   * GET /api/v1/commerce/status/:orderId
   * Quick status lookup for integrating assistants.
   */
  fastify.get(
    '/v1/commerce/status/:orderId',
    {
      schema: {
        tags: ['B2B Commerce SDK & Gateway'],
        summary: 'Get Order & Payment Status for Existing Assistant',
        params: {
          type: 'object',
          required: ['orderId'],
          properties: {
            orderId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          payments: { orderBy: { createdAt: 'desc' }, take: 1 }
        }
      });

      if (!order) {
        return reply.status(404).send({
          success: false,
          error: { code: 'ORDER_NOT_FOUND', message: `Order ${orderId} not found.` }
        });
      }

      return reply.status(200).send({
        success: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: order.totalAmount,
        currency: order.currency,
        itemsCount: order.items.length,
        latestPayment: order.payments[0]
          ? {
              status: order.payments[0].status,
              amount: order.payments[0].amount,
              razorpayPaymentId: order.payments[0].razorpayPaymentId
            }
          : null
      });
    }
  );
};
