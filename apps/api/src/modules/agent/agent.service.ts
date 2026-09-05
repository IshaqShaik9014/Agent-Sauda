import { prisma } from '@agent-sauda/database';
import type { ChatInput, ChatResponse, ChatMessage, OfferEvaluationResult } from '@agent-sauda/domain';
import type { AgentContext } from './agent.types.js';
import { buildSystemPrompt } from './agent.prompts.js';
import { getAgentDriver } from './agent.driver.js';
import { offerService } from '../offer/offer.service.js';

export class AgentService {
  /**
   * Processes a buyer conversational turn, executes tool calls, and returns agent response.
   */
  async chat(
    merchantId: string,
    input: ChatInput,
    actorId?: string
  ): Promise<ChatResponse> {
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { id: true, name: true, slug: true, currency: true }
    });

    if (!merchant) {
      const error = new Error(`Merchant ${merchantId} not found.`) as Error & { statusCode?: number; code?: string };
      error.statusCode = 404;
      error.code = 'MERCHANT_NOT_FOUND';
      throw error;
    }

    // 1. Retrieve or create Conversation record in database
    let conversation = input.conversationId
      ? await prisma.conversation.findFirst({
          where: { id: input.conversationId, merchantId },
          include: { messages: { orderBy: { createdAt: 'asc' }, take: 30 } }
        })
      : null;

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          merchantId,
          buyerId: input.customerId || null,
          buyerSessionId: input.customerId || `session_${Date.now()}`,
          channel: 'WEB',
          status: 'ACTIVE'
        },
        include: { messages: true }
      });
    }

    // 2. Persist incoming user message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        sender: 'BUYER',
        content: input.message,
        metadata: {
          customerId: input.customerId,
          customerName: input.customerName,
          actorId
        }
      }
    });

    // 3. Build message history for agent context
    const history: ChatMessage[] = conversation.messages.map((m) => ({
      id: m.id,
      role: m.sender === 'BUYER' ? 'user' : 'assistant',
      content: m.content,
      createdAt: m.createdAt
    }));
    history.push({ role: 'user', content: input.message });

    const ctx: AgentContext = {
      merchantId: merchant.id,
      merchantName: merchant.name,
      merchantSlug: merchant.slug,
      currency: merchant.currency,
      conversationId: conversation.id,
      actorId,
      messages: history
    };

    const systemPrompt = buildSystemPrompt(ctx);
    const driver = getAgentDriver();

    // 4. Execute conversational turn with tool loop
    const execution = await driver.executeTurn(ctx, systemPrompt);

    // 5. Persist assistant reply to database
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        sender: 'AGENT',
        content: execution.reply,
        toolCalls: (execution.toolCallsExecuted as any) ?? null,
        toolResults: (execution.toolResults as any) ?? null,
        metadata: {}
      }
    });

    // Extract policy evaluation result if propose_offer was called
    const proposeOfferResult = execution.toolResults.find((r) => r.toolName === 'propose_offer');
    const evaluation = proposeOfferResult ? (proposeOfferResult.result as OfferEvaluationResult) : undefined;

    let activeOfferData:
      | { id?: string; status: string; totalAmount: number; currency: string; itemsCount: number }
      | undefined = undefined;

    if (evaluation && evaluation.decision !== 'REJECT') {
      const proposeCall = execution.toolCallsExecuted.find((c) => c.name === 'propose_offer');
      const items = (proposeCall?.arguments as any)?.items;
      if (items && Array.isArray(items) && items.length > 0) {
        try {
          const offer = await offerService.createOffer(merchant.id, actorId, {
            conversationId: conversation.id,
            expirationHours: 24,
            forceDraft: false,
            items: items.map((i: any) => ({
              productId: i.productId,
              variantId: i.variantId,
              quantity: Number(i.quantity),
              agreedPrice: Number(i.proposedUnitPrice ?? i.agreedPrice)
            }))
          });

          activeOfferData = {
            id: offer.id,
            status: offer.status,
            totalAmount: offer.totalAmount,
            currency: offer.merchant?.currency || merchant.currency,
            itemsCount: offer.items.length
          };
        } catch (offerErr) {
          console.warn('[AgentService] Could not auto-create offer record:', offerErr);
        }
      }
    }

    return {
      success: true,
      conversationId: conversation.id,
      message: execution.reply,
      toolCallsExecuted: execution.toolCallsExecuted,
      evaluationResult: evaluation,
      activeOffer: activeOfferData
    };
  }
}

export const agentService = new AgentService();
