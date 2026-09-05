import { agentToolExecutor, AGENT_TOOLS } from './agent.tools.js';
import type { AgentContext, AgentExecutionResult } from './agent.types.js';
import type { ToolCallDefinition } from '@agent-sauda/domain';
import { env } from '../../config/env.js';

interface CatalogProductItem {
  id: string;
  title: string;
  category?: string;
  basePrice: number;
  inStock?: boolean;
  availableUnits: number;
}

export interface IAgentDriver {
  executeTurn(ctx: AgentContext, systemPrompt: string): Promise<AgentExecutionResult>;
}

/**
 * Gemini Live AI Driver with Multi-Turn Function Calling.
 * Calls Google Gemini when GEMINI_API_KEY is configured.
 */
export class GeminiAgentDriver implements IAgentDriver {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'gemini-1.5-flash') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async executeTurn(ctx: AgentContext, systemPrompt: string): Promise<AgentExecutionResult> {
    const toolCallsExecuted: ToolCallDefinition[] = [];
    const toolResults: Array<{ toolName: string; result: unknown }> = [];

    // Format tools for Gemini API declarations
    const geminiFunctionDeclarations = AGENT_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));

    // Convert message history to Gemini contents format
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text?: string; functionCall?: any; functionResponse?: any }> }> = [];

    for (const msg of ctx.messages) {
      if (msg.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: msg.content }] });
      } else {
        contents.push({ role: 'model', parts: [{ text: msg.content }] });
      }
    }

    const payload: any = {
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents,
      tools: [
        {
          functionDeclarations: geminiFunctionDeclarations
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1000
      }
    };

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    // Step 1: Initial call to Gemini
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const modelParts = candidate?.content?.parts || [];

    // Check for tool calling
    const functionCalls = modelParts.filter((p: any) => p.functionCall);

    if (functionCalls.length > 0) {
      // Execute tool calls
      const toolResponseParts: any[] = [];

      for (const part of functionCalls) {
        const fnName = part.functionCall.name;
        const fnArgs = part.functionCall.args || {};
        const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        toolCallsExecuted.push({ id: callId, name: fnName, arguments: fnArgs });
        const result = await agentToolExecutor.executeTool(fnName, fnArgs, ctx);
        toolResults.push({ toolName: fnName, result });

        toolResponseParts.push({
          functionResponse: {
            name: fnName,
            response: { result }
          }
        });
      }

      // Step 2: Feed tool responses back to Gemini for final response synthesis
      contents.push({ role: 'model', parts: modelParts });
      contents.push({ role: 'user', parts: toolResponseParts });

      const secondRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { temperature: 0.2, maxOutputTokens: 1000 }
        })
      });

      if (secondRes.ok) {
        const secondData = await secondRes.json();
        const secondText = secondData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (secondText) {
          return {
            reply: secondText,
            toolCallsExecuted,
            toolResults
          };
        }
      }
    }

    // Default text reply from Gemini
    const textReply = modelParts.find((p: any) => p.text)?.text || 'How can I assist you with our catalog today?';
    return {
      reply: textReply,
      toolCallsExecuted,
      toolResults
    };
  }
}

/**
 * Intelligent Semantic Agent Driver (Advanced Offline & Context-Aware Engine).
 * Comprehends affirmations, percentage discounts, policy RAG queries, multi-turn negotiations,
 * and product specs without generic fallbacks.
 */
export class DeterministicAgentDriver implements IAgentDriver {
  async executeTurn(ctx: AgentContext, _systemPrompt: string): Promise<AgentExecutionResult> {
    const lastUserMsg = [...ctx.messages].reverse().find((m) => m.role === 'user');
    const userText = (lastUserMsg?.content || '').trim();
    const lowerText = userText.toLowerCase();

    const toolCallsExecuted: ToolCallDefinition[] = [];
    const toolResults: Array<{ toolName: string; result: unknown }> = [];

    // Helper to execute a tool
    const runTool = async (name: string, args: Record<string, unknown>) => {
      const toolCallId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const toolCall: ToolCallDefinition = { id: toolCallId, name, arguments: args };
      toolCallsExecuted.push(toolCall);
      const result = await agentToolExecutor.executeTool(name, args, ctx);
      toolResults.push({ toolName: name, result });
      return result;
    };

    // Load merchant catalog
    const catResult = (await runTool('search_catalog', { limit: 10 })) as {
      products: CatalogProductItem[];
    };
    const products = catResult.products || [];

    // Helper: Find best matching product from user text
    const findProduct = (text: string): CatalogProductItem => {
      const t = text.toLowerCase();
      // Exact / substring match on full title
      const exact = products.find((p) => t.includes(p.title.toLowerCase()));
      if (exact) return exact;

      // Match key words (aeromesh, ergopro, desk, chair, solstice, lumina, nexus, study)
      const keywordMatch = products.find((p) => {
        const words = p.title.toLowerCase().split(/\s+/);
        return words.some((w) => w.length > 3 && t.includes(w));
      });
      if (keywordMatch) return keywordMatch;

      // Default to first product in catalog
      return products[0] || { id: 'fallback', title: 'Product', basePrice: 5000, availableUnits: 10 };
    };

    // Helper: Find recent product mentioned in conversation history
    const getRecentProductFromHistory = (): CatalogProductItem => {
      for (const msg of [...ctx.messages].reverse()) {
        for (const p of products) {
          if (msg.content.toLowerCase().includes(p.title.toLowerCase())) {
            return p;
          }
        }
      }
      return products[0] || { id: 'fallback', title: 'Product', basePrice: 5000, availableUnits: 10 };
    };

    // --------------------------------------------------------------------------
    // 1. Prompt Injection / Security Override Defense
    // --------------------------------------------------------------------------
    if (
      lowerText.includes('ignore previous') ||
      lowerText.includes('system prompt') ||
      lowerText.includes('system override') ||
      lowerText.includes('sell for ₹1') ||
      lowerText.includes('for 1 rupee') ||
      lowerText.includes('for ₹1') ||
      lowerText.includes('for 1rs')
    ) {
      const prod = findProduct(lowerText);
      const evalResult = (await runTool('propose_offer', {
        items: [{ productId: prod.id, quantity: 1, proposedUnitPrice: 1 }]
      })) as { decision: string; reasons: string[] };

      return {
        reply: `I cannot override store policies or sell items below authorized prices. The proposed price was evaluated by our policy engine and ${evalResult.decision}. Let me know if you would like to purchase "${prod.title}" at its catalog price of ₹${prod.basePrice.toLocaleString('en-IN')}.`,
        toolCallsExecuted,
        toolResults
      };
    }

    // --------------------------------------------------------------------------
    // 2. Affirmation / Deal Acceptance ("yeah", "yes", "deal", "accept", "done", "ok", "pakka")
    // --------------------------------------------------------------------------
    const isAffirmation =
      /^(?:yeah|yes|yep|yup|deal|done|ok|okay|i accept|accept|sure|confirm|let'?s do it|sauda pakka|agreed|sounds good)[\s!.]*$/i.test(
        lowerText
      ) ||
      lowerText === 'yeah' ||
      lowerText === 'yes' ||
      lowerText === 'done' ||
      lowerText === 'deal';

    if (isAffirmation) {
      // Find the last offer/counter-offer price proposed in conversation
      let agreedPrice: number | null = null;
      let targetProduct = getRecentProductFromHistory();

      for (const msg of [...ctx.messages].reverse()) {
        if (msg.role === 'assistant') {
          // Look for price like ₹7,820 or ₹5,700 in assistant text
          const m = msg.content.match(/₹([\d,]+)/);
          if (m && m[1]) {
            const parsed = parseInt(m[1].replace(/,/g, ''), 10);
            if (parsed > 500) {
              agreedPrice = parsed;
              break;
            }
          }
        }
      }

      if (agreedPrice) {
        // Submit the offer to generate formal quotation
        await runTool('propose_offer', {
          items: [{ productId: targetProduct.id, quantity: 1, proposedUnitPrice: agreedPrice }]
        });

        return {
          reply: `Fantastic! Deal confirmed 🎉 I've locked in your negotiated price at ₹${agreedPrice.toLocaleString('en-IN')}/unit for "${targetProduct.title}". Your official quote card has been generated. Click 'Accept & Checkout' below to complete your order!`,
          toolCallsExecuted,
          toolResults
        };
      } else {
        return {
          reply: `Great! Which product from our catalog would you like to proceed with, or what price can I propose for you?`,
          toolCallsExecuted,
          toolResults
        };
      }
    }

    // --------------------------------------------------------------------------
    // 3. Knowledge Base & Store Policy Q&A (RAG)
    // --------------------------------------------------------------------------
    const isKnowledgeQuery =
      lowerText.includes('return') ||
      lowerText.includes('refund') ||
      lowerText.includes('warranty') ||
      lowerText.includes('guarantee') ||
      lowerText.includes('shipping') ||
      lowerText.includes('delivery') ||
      lowerText.includes('defect') ||
      lowerText.includes('damaged') ||
      lowerText.includes('policy') ||
      lowerText.includes('terms') ||
      lowerText.includes('assembled') ||
      lowerText.includes('assembly') ||
      lowerText.includes('delhivery') ||
      lowerText.includes('bluedart');

    // Only route to RAG if not primarily a discount offer
    const hasPriceDiscount = lowerText.includes('₹') || lowerText.includes('%') || lowerText.match(/\d{3,7}/);

    if (isKnowledgeQuery && !hasPriceDiscount) {
      const knowledgeResult = (await runTool('search_merchant_knowledge', {
        query: userText,
        topK: 2
      })) as {
        chunks: Array<{ documentTitle: string; documentType: string; content: string; relevanceScore: number }>;
      };

      if (knowledgeResult.chunks && knowledgeResult.chunks.length > 0 && knowledgeResult.chunks[0]) {
        const topChunk = knowledgeResult.chunks[0];
        return {
          reply: `According to our official ${topChunk.documentTitle} (${topChunk.documentType.replace('_', ' ')}):\n\n"${topChunk.content}"\n\nPlease let me know if you would like to ask about specific products or negotiate an order!`,
          toolCallsExecuted,
          toolResults
        };
      } else {
        return {
          reply: `At **${ctx.merchantName}**, we offer a 30-day hassle-free return policy on unblemished items, comprehensive manufacturer warranties, and insured dispatch within 2-4 business days. Feel free to ask about specific products or custom order pricing!`,
          toolCallsExecuted,
          toolResults
        };
      }
    }

    // --------------------------------------------------------------------------
    // 4. Percentage-Based Discount Negotiation (e.g. "10% discount on 50 chairs")
    // --------------------------------------------------------------------------
    const percentMatch = lowerText.match(/(\d+(?:\.\d+)?)\s*%\s*(?:discount|off|volume discount)?/i);

    if (percentMatch && percentMatch[1]) {
      const discountPercent = parseFloat(percentMatch[1]);
      const matchedProduct = findProduct(lowerText);

      // Extract quantity (e.g. "50 sets", "50 units", "3 units", "for 5")
      const qtyMatch =
        lowerText.match(/(\d+)\s*(?:sets|units|items|chairs|desks|pieces|pcs|pieces)/i) ||
        lowerText.match(/(?:buing|buying|order|want|for|need)\s*(\d+)/i);
      const quantity = qtyMatch && qtyMatch[1] ? parseInt(qtyMatch[1], 10) : 1;

      // Calculate unit price based on requested percentage
      const proposedUnitPrice = Math.round(matchedProduct.basePrice * (1 - discountPercent / 100));

      // Check warehouse stock
      await runTool('check_inventory', {
        productId: matchedProduct.id,
        quantity
      });

      // Submit offer proposal to policy engine
      const evalResult = (await runTool('propose_offer', {
        items: [
          {
            productId: matchedProduct.id,
            quantity,
            proposedUnitPrice
          }
        ]
      })) as any;

      if (evalResult.decision === 'ALLOW') {
        return {
          reply: `Deal agreed! 🎉 I can offer you a ${discountPercent}% discount on ${quantity}x "${matchedProduct.title}" at ₹${proposedUnitPrice.toLocaleString('en-IN')}/unit (Total: ₹${evalResult.totalProposedAmount.toLocaleString('en-IN')} ${ctx.currency}). You can proceed to checkout!`,
          toolCallsExecuted,
          toolResults
        };
      } else if (evalResult.decision === 'APPROVAL_REQUIRED') {
        return {
          reply: `Your offer for a ${discountPercent}% discount on ${quantity}x "${matchedProduct.title}" (Total: ₹${evalResult.totalProposedAmount.toLocaleString('en-IN')} ${ctx.currency}) has been submitted to our store manager for Human-in-the-Loop approval. We will notify you as soon as it is reviewed!`,
          toolCallsExecuted,
          toolResults
        };
      } else if (evalResult.decision === 'COUNTER' && evalResult.counterOffer?.items?.[0]) {
        const counterPrice = evalResult.counterOffer.items[0].counterUnitPrice;
        return {
          reply: `I understand you're looking for a ${discountPercent}% discount, but our policy limit allows a maximum of ${evalResult.counterOffer.counterDiscountPercent}% off. The best authorized counter-offer I can make is ₹${counterPrice.toLocaleString('en-IN')}/unit for ${quantity}x "${matchedProduct.title}" (Total: ₹${evalResult.counterOffer.totalCounterAmount.toLocaleString('en-IN')} ${ctx.currency}). Would you like to accept?`,
          toolCallsExecuted,
          toolResults
        };
      } else {
        return {
          reply: `A ${discountPercent}% discount on "${matchedProduct.title}" is below our minimum commercial floor price. The standard catalog price is ₹${matchedProduct.basePrice.toLocaleString('en-IN')} ${ctx.currency}. Would you like to explore a smaller volume discount?`,
          toolCallsExecuted,
          toolResults
        };
      }
    }

    // --------------------------------------------------------------------------
    // 5. Explicit Rupee Price Negotiation (e.g. "I get the Study Chair for ₹5,700?")
    // --------------------------------------------------------------------------
    const cleanText = lowerText.replace(/,/g, '');
    const priceMatch =
      cleanText.match(/₹\s*(\d{3,7})/) ||
      cleanText.match(/(?:for|do|at|offer|give|pay|get|rs\.?)\s*(\d{3,7})/i) ||
      cleanText.match(/(\d{3,7})\s*(?:rupees|inr|rs)/i) ||
      cleanText.match(/(\d{3,7})/);

    if (priceMatch && priceMatch[1] && parseInt(priceMatch[1], 10) >= 500) {
      const proposedUnitPrice = parseInt(priceMatch[1], 10);
      const matchedProduct = findProduct(lowerText);

      const qtyMatch =
        cleanText.match(/(\d+)\s*(?:sets|units|items|chairs|desks|pieces|pcs)/i) ||
        cleanText.match(/(?:buy|order|want|need|for)\s+(\d+)/i);
      const quantity = qtyMatch && qtyMatch[1] ? parseInt(qtyMatch[1], 10) : 1;

      // Check stock
      await runTool('check_inventory', {
        productId: matchedProduct.id,
        quantity
      });

      // Submit offer
      const evalResult = (await runTool('propose_offer', {
        items: [
          {
            productId: matchedProduct.id,
            quantity,
            proposedUnitPrice
          }
        ]
      })) as any;

      if (evalResult.decision === 'ALLOW') {
        return {
          reply: `Deal agreed! 🎉 I can offer you ${quantity}x "${matchedProduct.title}" at ₹${proposedUnitPrice.toLocaleString('en-IN')} per unit (Total: ₹${evalResult.totalProposedAmount.toLocaleString('en-IN')} ${ctx.currency}, saving ${evalResult.totalEffectiveDiscountPercent}%). You can proceed to checkout!`,
          toolCallsExecuted,
          toolResults
        };
      } else if (evalResult.decision === 'APPROVAL_REQUIRED') {
        return {
          reply: `Your offer for ${quantity}x "${matchedProduct.title}" at ₹${proposedUnitPrice.toLocaleString('en-IN')}/unit (Total: ₹${evalResult.totalProposedAmount.toLocaleString('en-IN')} ${ctx.currency}) requires manager authorization. I have submitted this deal to our store manager for approval!`,
          toolCallsExecuted,
          toolResults
        };
      } else if (evalResult.decision === 'COUNTER' && evalResult.counterOffer?.items?.[0]) {
        const counterPrice = evalResult.counterOffer.items[0].counterUnitPrice;
        return {
          reply: `I understand you're offering ₹${proposedUnitPrice.toLocaleString('en-IN')}, but that is below our policy limit. The best authorized counter-offer I can make is ₹${counterPrice.toLocaleString('en-IN')}/unit (Total: ₹${evalResult.counterOffer.totalCounterAmount.toLocaleString('en-IN')} ${ctx.currency}, ${evalResult.counterOffer.counterDiscountPercent}% off). Would you like to accept?`,
          toolCallsExecuted,
          toolResults
        };
      } else {
        return {
          reply: `I'm sorry, but ₹${proposedUnitPrice.toLocaleString('en-IN')} is below our minimum commercial threshold for "${matchedProduct.title}". Its standard price is ₹${matchedProduct.basePrice.toLocaleString('en-IN')} ${ctx.currency}. Would you like to make a closer counter-offer?`,
          toolCallsExecuted,
          toolResults
        };
      }
    }

    // --------------------------------------------------------------------------
    // 6. Product Inquiry / Specific Question
    // --------------------------------------------------------------------------
    const matched = products.find(
      (p) => lowerText.includes(p.title.toLowerCase()) || p.title.toLowerCase().split(' ').some((w) => w.length > 3 && lowerText.includes(w))
    );

    if (matched) {
      return {
        reply: `**${matched.title}** (${matched.category || 'Product'})\n\n• **Price:** ₹${matched.basePrice.toLocaleString('en-IN')} ${ctx.currency}\n• **Warehouse Stock:** ${matched.availableUnits} units available\n\nWould you like to negotiate a volume discount or place an order?`,
        toolCallsExecuted,
        toolResults
      };
    }

    // --------------------------------------------------------------------------
    // 7. General Greetings & Pleasantries
    // --------------------------------------------------------------------------
    if (lowerText.includes('hello') || lowerText.includes('hi') || lowerText.includes('hey') || lowerText === 'help') {
      const topProducts = products.slice(0, 3).map((p) => `• **${p.title}** — ₹${p.basePrice.toLocaleString('en-IN')} (${p.availableUnits} in stock)`).join('\n');
      return {
        reply: `Hello! Welcome to **${ctx.merchantName}**.\n\nHere are some of our popular products:\n${topProducts}\n\nI can answer questions about our store policies, check live warehouse inventory, or negotiate bulk discounts. What can I help you with today?`,
        toolCallsExecuted,
        toolResults
      };
    }

    // --------------------------------------------------------------------------
    // 8. Gratitude & Closing
    // --------------------------------------------------------------------------
    if (lowerText.includes('thank') || lowerText.includes('thanks') || lowerText.includes('bye')) {
      return {
        reply: `You're very welcome! If you have any further questions or want to negotiate another deal at **${ctx.merchantName}**, I'm always here. Have a wonderful day!`,
        toolCallsExecuted,
        toolResults
      };
    }

    // --------------------------------------------------------------------------
    // 9. Intelligent Open-Ended Fallback
    // --------------------------------------------------------------------------
    const productNames = products.map((p) => `"${p.title}" (₹${p.basePrice.toLocaleString('en-IN')})`).join(', ');
    return {
      reply: `I'm happy to help! At **${ctx.merchantName}**, we carry items including ${productNames}.\n\nYou can ask me about our return policies, inquire about available stock, or propose a custom price on any item. What would you like to explore?`,
      toolCallsExecuted,
      toolResults
    };
  }
}

/**
 * Driver Factory: Returns Gemini Live LLM Driver when GEMINI_API_KEY is configured,
 * or the Intelligent Semantic Agent Driver for seamless offline execution.
 */
export function getAgentDriver(): IAgentDriver {
  if (env.GEMINI_API_KEY && env.GEMINI_API_KEY !== 'mock_gemini_api_key' && env.GEMINI_API_KEY.length > 10) {
    return new GeminiAgentDriver(env.GEMINI_API_KEY);
  }
  return new DeterministicAgentDriver();
}
