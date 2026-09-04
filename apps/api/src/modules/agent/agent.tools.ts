import { prisma } from '@agent-sauda/database';
import { catalogService } from '../catalog/catalog.service.js';
import { policyService } from '../policy/policy.service.js';
import { knowledgeService } from '../knowledge/knowledge.service.js';
import type { AgentToolDeclaration, AgentContext } from './agent.types.js';
import type { OfferEvaluationResult } from '@agent-sauda/domain';

export const AGENT_TOOLS: AgentToolDeclaration[] = [
  {
    name: 'search_catalog',
    description: 'Searches the merchant product catalog for matching items by keyword, category, or title. Returns public prices and available stock.',
    parameters: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Keyword search terms (e.g. "ergonomic chair", "desk", "mesh")'
        },
        category: {
          type: 'string',
          description: 'Category filter (e.g. "Seating", "Office", "Desks")'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of items to return (default 10)'
        }
      }
    }
  },
  {
    name: 'check_inventory',
    description: 'Checks real-time warehouse inventory and available units for a specific product.',
    parameters: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'The unique UUID of the product'
        },
        quantity: {
          type: 'number',
          description: 'The quantity of units requested by the buyer'
        }
      },
      required: ['productId', 'quantity']
    }
  },
  {
    name: 'propose_offer',
    description: 'Submits a proposed deal (items, quantities, and proposed unit prices) to the Deterministic Policy Engine for authorization. Emits ALLOW, COUNTER, APPROVAL_REQUIRED, or REJECT.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'List of items to purchase with proposed prices',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string', description: 'Product UUID' },
              quantity: { type: 'number', description: 'Number of units' },
              proposedUnitPrice: { type: 'number', description: 'Proposed discounted unit price' }
            },
            required: ['productId', 'quantity', 'proposedUnitPrice']
          }
        },
        customerTier: {
          type: 'string',
          description: 'Optional buyer tier (e.g. "STANDARD", "ENTERPRISE")'
        }
      },
      required: ['items']
    }
  },
  {
    name: 'search_merchant_knowledge',
    description: 'Searches the merchant unstructured knowledge base and documents (return policy, warranty, shipping, FAQs, terms). Returns semantic document excerpts.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The customer policy or store question (e.g. "return policy after assembly", "warranty period")'
        },
        topK: {
          type: 'number',
          description: 'Maximum number of knowledge chunks to return (default 3)'
        }
      },
      required: ['query']
    }
  }
];

export class AgentToolExecutor {
  /**
   * Executes a specific tool call within the merchant's authenticated context.
   */
  async executeTool(
    name: string,
    args: Record<string, unknown>,
    ctx: AgentContext
  ): Promise<unknown> {
    switch (name) {
      case 'search_catalog': {
        const search = typeof args['search'] === 'string' ? args['search'] : undefined;
        const category = typeof args['category'] === 'string' ? args['category'] : undefined;
        const limit = typeof args['limit'] === 'number' ? args['limit'] : 10;

        const result = await catalogService.getAgentCatalog({
          merchantId: ctx.merchantId,
          search,
          category,
          limit
        });

        return {
          merchantName: ctx.merchantName,
          currency: ctx.currency,
          productsCount: result.productsCount,
          products: result.products
        };
      }

      case 'check_inventory': {
        const productId = args['productId'] as string;
        const quantity = Number(args['quantity'] || 1);

        const product = await prisma.product.findFirst({
          where: { id: productId, merchantId: ctx.merchantId },
          include: { inventory: true }
        });

        if (!product) {
          return {
            found: false,
            message: `Product ${productId} not found in merchant catalog.`
          };
        }

        const totalAvailable = product.inventory.reduce((sum, i) => sum + i.availableUnits, 0);
        const sufficientStock = totalAvailable >= quantity;

        return {
          found: true,
          productId: product.id,
          title: product.title,
          requestedQuantity: quantity,
          availableUnits: totalAvailable,
          sufficientStock,
          message: sufficientStock
            ? `Stock confirmed: ${totalAvailable} units available (Requested: ${quantity}).`
            : `Insufficient stock: Only ${totalAvailable} units available (Requested: ${quantity}).`
        };
      }

      case 'propose_offer': {
        const rawItems = (args['items'] as Array<{ productId: string; quantity: number; proposedUnitPrice: number }>) || [];
        const customerTier = typeof args['customerTier'] === 'string' ? args['customerTier'] : 'STANDARD';

        const items = rawItems.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          proposedUnitPrice: Number(item.proposedUnitPrice)
        }));

        const evaluation: OfferEvaluationResult = await policyService.evaluateOffer(
          ctx.merchantId,
          ctx.actorId,
          { items, customerTier }
        );

        return {
          decision: evaluation.decision,
          allowed: evaluation.allowed,
          requiresApproval: evaluation.requiresApproval,
          totalBaseAmount: evaluation.totalBaseAmount,
          totalProposedAmount: evaluation.totalProposedAmount,
          totalEffectiveDiscountPercent: evaluation.totalEffectiveDiscountPercent,
          averageGrossMarginPercent: evaluation.averageGrossMarginPercent,
          counterOffer: evaluation.counterOffer,
          reasons: evaluation.reasons
        };
      }

      case 'search_merchant_knowledge': {
        const query = typeof args['query'] === 'string' ? args['query'] : '';
        const topK = typeof args['topK'] === 'number' ? args['topK'] : 3;

        const chunks = await knowledgeService.searchKnowledge(ctx.merchantId, query, topK);
        return {
          query,
          merchantName: ctx.merchantName,
          chunksCount: chunks.length,
          chunks: chunks.map((c) => ({
            documentTitle: c.documentTitle,
            documentType: c.documentType,
            content: c.content,
            relevanceScore: c.similarityScore
          }))
        };
      }

      default:
        throw new Error(`Unrecognized agent tool: ${name}`);
    }
  }
}

export const agentToolExecutor = new AgentToolExecutor();
