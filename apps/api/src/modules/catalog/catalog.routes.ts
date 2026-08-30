import type { FastifyPluginAsync } from 'fastify';
import {
  CreateProductInputSchema,
  UpdateProductInputSchema,
  UpdateInventoryInputSchema,
  AgentCatalogQuerySchema
} from './catalog.schema.js';
import { catalogService } from './catalog.service.js';
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

export const catalogRoutes: FastifyPluginAsync = async (fastify) => {
  // ==========================================================================
  // 1. Agent & Buyer-Facing Public Catalog
  // ==========================================================================

  /**
   * GET /api/agent/catalog
   * Machine-readable catalog endpoint optimized for AI tool calling.
   * Strips costPrice and internal merchant margins.
   */
  fastify.get(
    '/agent/catalog',
    {
      schema: {
        tags: ['Agent Tools & Public Catalog'],
        summary: 'Agent-Readable Product Catalog (AI Tool Endpoint)',
        description:
          'Returns a clean, token-efficient product catalog for AI agents and buyers. ' +
          'Guarantees that internal cost prices and profit margins are never leaked.',
        querystring: {
          type: 'object',
          properties: {
            merchantId: { type: 'string', format: 'uuid', description: 'Target merchant UUID' },
            merchantSlug: { type: 'string', description: 'Target merchant slug (e.g. apex-furniture)' },
            search: { type: 'string', description: 'Keyword search for titles and descriptions' },
            category: { type: 'string', description: 'Filter by product category' },
            limit: { type: 'number', default: 50, description: 'Maximum products to return' }
          }
        },
        response: {
          200: {
            description: 'Agent-readable catalog items with real-time stock availability',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              merchant: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  currency: { type: 'string' }
                }
              },
              productsCount: { type: 'number' },
              products: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    slug: { type: 'string' },
                    category: { type: 'string' },
                    description: { type: 'string' },
                    basePrice: { type: 'number' },
                    currency: { type: 'string' },
                    inStock: { type: 'boolean' },
                    availableUnits: { type: 'number' }
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
      const queryParse = AgentCatalogQuerySchema.safeParse(request.query);
      if (!queryParse.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid catalog query parameters.',
            details: queryParse.error.format(),
            statusCode: 400,
            requestId: request.id
          }
        });
      }

      try {
        const result = await catalogService.getAgentCatalog(queryParse.data);
        return reply.status(200).send({
          success: true,
          ...result
        });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode === 404 ? 404 : 500) as 404 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'CATALOG_FETCH_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  // ==========================================================================
  // 2. Merchant Dashboard Catalog Management (Protected & Tenant-Scoped)
  // ==========================================================================

  /**
   * POST /api/merchants/:merchantId/catalog/products
   * Creates a new product with initial inventory allocation.
   */
  fastify.post(
    '/merchants/:merchantId/catalog/products',
    {
      preHandler: [authenticate, requireMerchantAccess('merchantId')],
      schema: {
        tags: ['Merchant Catalog Management'],
        summary: 'Create New Catalog Product',
        description: 'Creates a new product with cost price, base price, and initial warehouse inventory in a single ACID transaction.',
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
          required: ['title', 'slug', 'basePrice', 'costPrice'],
          properties: {
            title: { type: 'string', example: 'ErgoMax Highback Chair' },
            slug: { type: 'string', example: 'ergomax-highback-chair' },
            description: { type: 'string', example: 'Premium breathable mesh office chair with lumbar adjustment.' },
            category: { type: 'string', example: 'Office Seating' },
            basePrice: { type: 'number', example: 12000 },
            costPrice: { type: 'number', example: 7500 },
            initialStock: { type: 'number', example: 50 },
            location: { type: 'string', example: 'Bangalore Central Hub' }
          }
        },
        response: {
          201: {
            description: 'Product created successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              product: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  merchantId: { type: 'string' },
                  title: { type: 'string' },
                  slug: { type: 'string' },
                  description: { type: 'string' },
                  category: { type: 'string' },
                  basePrice: { type: 'number' },
                  costPrice: { type: 'number' },
                  grossMarginPercent: { type: 'number' },
                  totalAvailableStock: { type: 'number' },
                  isActive: { type: 'boolean' }
                }
              }
            }
          },
          400: ErrorResponseSchema,
          403: ErrorResponseSchema,
          409: ErrorResponseSchema,
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const { merchantId } = request.params as { merchantId: string };
      const parseResult = CreateProductInputSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid product input parameters.',
            details: parseResult.error.format(),
            statusCode: 400,
            requestId: request.id
          }
        });
      }

      try {
        const product = await catalogService.createProduct(merchantId, request.user.userId, parseResult.data);
        return reply.status(201).send({
          success: true,
          product
        });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode === 409 ? 409 : 500) as 409 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'PRODUCT_CREATION_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  /**
   * GET /api/merchants/:merchantId/catalog/products
   * Lists all products for a merchant with inventory and margin analytics.
   */
  fastify.get(
    '/merchants/:merchantId/catalog/products',
    {
      preHandler: [authenticate, requireMerchantAccess('merchantId')],
      schema: {
        tags: ['Merchant Catalog Management'],
        summary: 'List Merchant Catalog Products',
        description: 'Returns all catalog products for the merchant dashboard, enriched with cost prices, margins, and warehouse inventory.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['merchantId'],
          properties: {
            merchantId: { type: 'string', format: 'uuid' }
          }
        },
        querystring: {
          type: 'object',
          properties: {
            search: { type: 'string' },
            category: { type: 'string' },
            isActive: { type: 'boolean' }
          }
        },
        response: {
          200: {
            description: 'List of merchant catalog products',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              count: { type: 'number' },
              products: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    slug: { type: 'string' },
                    description: { type: 'string' },
                    category: { type: 'string' },
                    basePrice: { type: 'number' },
                    costPrice: { type: 'number' },
                    grossMarginPercent: { type: 'number' },
                    totalAvailableStock: { type: 'number' },
                    totalReservedStock: { type: 'number' },
                    isActive: { type: 'boolean' }
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
      const query = request.query as { search?: string; category?: string; isActive?: boolean };

      const products = await catalogService.listMerchantProducts(merchantId, query);
      return reply.status(200).send({
        success: true,
        count: products.length,
        products
      });
    }
  );

  /**
   * GET /api/merchants/:merchantId/catalog/products/:productId
   * Retrieves single product details.
   */
  fastify.get(
    '/merchants/:merchantId/catalog/products/:productId',
    {
      preHandler: [authenticate, requireMerchantAccess('merchantId')],
      schema: {
        tags: ['Merchant Catalog Management'],
        summary: 'Get Product Details',
        description: 'Returns single product information with full inventory and variant breakdown.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['merchantId', 'productId'],
          properties: {
            merchantId: { type: 'string', format: 'uuid' },
            productId: { type: 'string', format: 'uuid' }
          }
        },
        response: {
          200: {
            description: 'Product details',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              product: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  merchantId: { type: 'string' },
                  title: { type: 'string' },
                  slug: { type: 'string' },
                  description: { type: 'string' },
                  category: { type: 'string' },
                  basePrice: { type: 'number' },
                  costPrice: { type: 'number' },
                  grossMarginPercent: { type: 'number' },
                  totalAvailableStock: { type: 'number' },
                  totalReservedStock: { type: 'number' },
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
      const { merchantId, productId } = request.params as { merchantId: string; productId: string };

      try {
        const product = await catalogService.getProductDetails(merchantId, productId);
        return reply.status(200).send({
          success: true,
          product
        });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode === 404 ? 404 : 500) as 404 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'PRODUCT_NOT_FOUND',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  /**
   * PATCH /api/merchants/:merchantId/catalog/products/:productId
   * Updates product details or pricing.
   */
  fastify.patch(
    '/merchants/:merchantId/catalog/products/:productId',
    {
      preHandler: [authenticate, requireMerchantAccess('merchantId')],
      schema: {
        tags: ['Merchant Catalog Management'],
        summary: 'Update Product or Pricing',
        description: 'Updates product title, description, category, basePrice, costPrice, or active status. Audits price updates.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['merchantId', 'productId'],
          properties: {
            merchantId: { type: 'string', format: 'uuid' },
            productId: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            basePrice: { type: 'number' },
            costPrice: { type: 'number' },
            isActive: { type: 'boolean' }
          }
        },
        response: {
          200: {
            description: 'Product updated successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              product: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  basePrice: { type: 'number' },
                  costPrice: { type: 'number' },
                  grossMarginPercent: { type: 'number' },
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
      const { merchantId, productId } = request.params as { merchantId: string; productId: string };
      const parseResult = UpdateProductInputSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid product update parameters.',
            details: parseResult.error.format(),
            statusCode: 400,
            requestId: request.id
          }
        });
      }

      try {
        const product = await catalogService.updateProduct(
          merchantId,
          productId,
          request.user.userId,
          parseResult.data
        );
        return reply.status(200).send({
          success: true,
          product
        });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode === 404 ? 404 : 500) as 404 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'PRODUCT_UPDATE_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );

  /**
   * PATCH /api/merchants/:merchantId/catalog/inventory/:productId
   * Adjusts warehouse inventory stock levels.
   */
  fastify.patch(
    '/merchants/:merchantId/catalog/inventory/:productId',
    {
      preHandler: [authenticate, requireMerchantAccess('merchantId')],
      schema: {
        tags: ['Merchant Catalog Management'],
        summary: 'Update Warehouse Inventory',
        description: 'Adjusts available units and reserved units for a product. Automatically records an immutable audit log event.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['merchantId', 'productId'],
          properties: {
            merchantId: { type: 'string', format: 'uuid' },
            productId: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          required: ['availableUnits'],
          properties: {
            availableUnits: { type: 'number', example: 120 },
            reservedUnits: { type: 'number', example: 10 },
            location: { type: 'string', example: 'Bangalore Fulfillment Hub' }
          }
        },
        response: {
          200: {
            description: 'Inventory updated successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              inventory: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  productId: { type: 'string' },
                  availableUnits: { type: 'number' },
                  reservedUnits: { type: 'number' },
                  location: { type: 'string' }
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
      const { merchantId, productId } = request.params as { merchantId: string; productId: string };
      const parseResult = UpdateInventoryInputSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid inventory update parameters.',
            details: parseResult.error.format(),
            statusCode: 400,
            requestId: request.id
          }
        });
      }

      try {
        const inventory = await catalogService.updateInventory(
          merchantId,
          productId,
          request.user.userId,
          parseResult.data
        );
        return reply.status(200).send({
          success: true,
          inventory
        });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number; code?: string };
        const statusCode = (error.statusCode === 404 ? 404 : 500) as 404 | 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: error.code || 'INVENTORY_UPDATE_FAILED',
            message: error.message,
            statusCode,
            requestId: request.id
          }
        });
      }
    }
  );
};
