/**
 * Agent Sauda B2B Commerce SDK.
 * Enables existing business AI assistants to integrate merchant-grounded knowledge,
 * product discovery, deterministic negotiation, policy guardrails, and Razorpay checkout
 * with minimal lines of code.
 *
 * "Your chatbot can talk. We make it capable of selling."
 */

export interface AgentSaudaConfig {
  merchantId: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface CommerceProcessOptions {
  message: string;
  conversationId?: string;
  customerId?: string;
  customerName?: string;
}

export interface CommerceProcessResult {
  success: boolean;
  actionType: 'KNOWLEDGE' | 'NEGOTIATION' | 'DISCOVERY' | 'GENERAL';
  merchant: {
    id: string;
    name: string;
    currency: string;
  };
  conversationId: string;
  reply: string;
  evaluationResult?: unknown;
  toolsExecuted: string[];
}

export class AgentSauda {
  private readonly merchantId: string;
  private readonly apiKey?: string;
  private readonly baseUrl: string;

  constructor(config: AgentSaudaConfig) {
    if (!config.merchantId) {
      throw new Error('AgentSauda SDK requires a valid merchantId.');
    }
    this.merchantId = config.merchantId;
    this.apiKey = config.apiKey;
    const rawUrl = config.baseUrl || (typeof process !== 'undefined' ? process.env['AGENT_SAUDA_API_URL'] : undefined) || 'http://localhost:4000';
    this.baseUrl = rawUrl.replace(/\/$/, '');
  }

  public readonly commerce = {
    /**
     * Primary integration method.
     * Takes a customer's message from an existing chatbot, evaluates merchant policies,
     * checks inventory, searches pgvector knowledge base, and returns a grounded response.
     */
    process: async (options: CommerceProcessOptions): Promise<CommerceProcessResult> => {
      const url = `${this.baseUrl}/api/v1/commerce/process`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {})
        },
        body: JSON.stringify({
          merchantId: this.merchantId,
          message: options.message,
          conversationId: options.conversationId,
          customerId: options.customerId,
          customerName: options.customerName
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`AgentSauda Commerce Error (${res.status}): ${errorText}`);
      }

      return (await res.json()) as CommerceProcessResult;
    },

    /**
     * Retrieves current order and payment status for an integrating chatbot.
     */
    getOrderStatus: async (orderId: string): Promise<any> => {
      const url = `${this.baseUrl}/api/v1/commerce/status/${orderId}`;
      const res = await fetch(url, {
        headers: {
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {})
        }
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch order status (${res.status}): ${res.statusText}`);
      }
      return res.json();
    }
  };

  public readonly knowledge = {
    /**
     * Direct vector similarity search over merchant documents using pgvector.
     */
    search: async (query: string, topK = 3): Promise<any> => {
      const url = `${this.baseUrl}/api/merchants/${this.merchantId}/knowledge/search`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, topK })
      });
      if (!res.ok) {
        throw new Error(`Knowledge search failed (${res.status}): ${res.statusText}`);
      }
      return res.json();
    }
  };
}
