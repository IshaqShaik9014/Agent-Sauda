import { prisma } from '@agent-sauda/database';
import type {
  CreateProductInput,
  UpdateProductInput,
  UpdateInventoryInput,
  AgentCatalogQuery
} from './catalog.schema.js';
import { cacheService, CacheService } from '../../lib/cache.js';

export class CatalogService {
  /**
   * Creates a new catalog product with initial inventory allocation inside an ACID transaction.
   */
  async createProduct(merchantId: string, actorId: string, input: CreateProductInput) {
    const existing = await prisma.product.findUnique({
      where: {
        merchantId_slug: {
          merchantId,
          slug: input.slug.toLowerCase()
        }
      }
    });

    if (existing) {
      const error = new Error(`A product with slug "${input.slug}" already exists in this catalog.`) as Error & { statusCode?: number; code?: string };
      error.statusCode = 409;
      error.code = 'PRODUCT_SLUG_EXISTS';
      throw error;
    }

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          merchantId,
          title: input.title,
          slug: input.slug.toLowerCase(),
          description: input.description || '',
          category: input.category || 'General',
          basePrice: input.basePrice,
          costPrice: input.costPrice,
          isActive: true
        }
      });

      const inventory = await tx.inventory.create({
        data: {
          merchantId,
          productId: product.id,
          availableUnits: input.initialStock,
          reservedUnits: 0,
          location: input.location || 'Primary Warehouse'
        }
      });

      await tx.auditEvent.create({
        data: {
          merchantId,
          entityType: 'PRODUCT',
          entityId: product.id,
          action: 'PRODUCT_CREATED',
          actorType: 'USER',
          actorId,
          reason: `Created product "${product.title}" with initial stock ${inventory.availableUnits}`,
          metadata: {
            basePrice: product.basePrice,
            costPrice: product.costPrice,
            initialStock: inventory.availableUnits
          }
        }
      });

      const grossMarginPercent =
        product.basePrice > 0
          ? Number((((product.basePrice - product.costPrice) / product.basePrice) * 100).toFixed(2))
          : 0;

      return {
        ...product,
        inventory: [inventory],
        totalAvailableStock: inventory.availableUnits,
        totalReservedStock: inventory.reservedUnits,
        grossMarginPercent
      };
    });

    await cacheService.invalidateMerchantCatalog();
    return result;
  }

  /**
   * Lists all products owned by the merchant, enriched with stock and margin metrics.
   */
  async listMerchantProducts(
    merchantId: string,
    filter?: { search?: string; category?: string; isActive?: boolean }
  ) {
    const whereClause: Record<string, unknown> = { merchantId };

    if (filter?.isActive !== undefined) {
      whereClause['isActive'] = filter.isActive;
    }
    if (filter?.category) {
      whereClause['category'] = { contains: filter.category, mode: 'insensitive' };
    }
    if (filter?.search) {
      whereClause['OR'] = [
        { title: { contains: filter.search, mode: 'insensitive' } },
        { description: { contains: filter.search, mode: 'insensitive' } },
        { slug: { contains: filter.search, mode: 'insensitive' } }
      ];
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        inventory: true,
        variants: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return products.map((product) => {
      const totalAvailableStock = product.inventory.reduce((sum, inv) => sum + inv.availableUnits, 0);
      const totalReservedStock = product.inventory.reduce((sum, inv) => sum + inv.reservedUnits, 0);
      const grossMarginPercent =
        product.basePrice > 0
          ? Number((((product.basePrice - product.costPrice) / product.basePrice) * 100).toFixed(2))
          : 0;

      return {
        ...product,
        totalAvailableStock,
        totalReservedStock,
        grossMarginPercent
      };
    });
  }

  /**
   * Retrieves full product detail by ID with tenant isolation verification.
   */
  async getProductDetails(merchantId: string, productId: string) {
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        merchantId
      },
      include: {
        inventory: true,
        variants: true
      }
    });

    if (!product) {
      const error = new Error('Product not found in this merchant catalog.') as Error & { statusCode?: number; code?: string };
      error.statusCode = 404;
      error.code = 'PRODUCT_NOT_FOUND';
      throw error;
    }

    const totalAvailableStock = product.inventory.reduce((sum, inv) => sum + inv.availableUnits, 0);
    const totalReservedStock = product.inventory.reduce((sum, inv) => sum + inv.reservedUnits, 0);
    const grossMarginPercent =
      product.basePrice > 0
        ? Number((((product.basePrice - product.costPrice) / product.basePrice) * 100).toFixed(2))
        : 0;

    return {
      ...product,
      totalAvailableStock,
      totalReservedStock,
      grossMarginPercent
    };
  }

  /**
   * Updates product metadata, pricing, or active status. Emits audit logs if pricing changes.
   */
  async updateProduct(
    merchantId: string,
    productId: string,
    actorId: string,
    input: UpdateProductInput
  ) {
    const current = await this.getProductDetails(merchantId, productId);

    const priceChanged =
      (input.basePrice !== undefined && input.basePrice !== current.basePrice) ||
      (input.costPrice !== undefined && input.costPrice !== current.costPrice);

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: productId },
        data: {
          title: input.title !== undefined ? input.title : current.title,
          description: input.description !== undefined ? input.description : current.description,
          category: input.category !== undefined ? input.category : current.category,
          basePrice: input.basePrice !== undefined ? input.basePrice : current.basePrice,
          costPrice: input.costPrice !== undefined ? input.costPrice : current.costPrice,
          isActive: input.isActive !== undefined ? input.isActive : current.isActive
        },
        include: {
          inventory: true,
          variants: true
        }
      });

      if (priceChanged) {
        await tx.auditEvent.create({
          data: {
            merchantId,
            entityType: 'PRODUCT',
            entityId: productId,
            action: 'PRICE_UPDATED',
            actorType: 'USER',
            actorId,
            reason: `Price modified for "${updated.title}"`,
            metadata: {
              oldBasePrice: current.basePrice,
              newBasePrice: updated.basePrice,
              oldCostPrice: current.costPrice,
              newCostPrice: updated.costPrice
            }
          }
        });
      }

      const totalAvailableStock = updated.inventory.reduce((sum, inv) => sum + inv.availableUnits, 0);
      const totalReservedStock = updated.inventory.reduce((sum, inv) => sum + inv.reservedUnits, 0);
      const grossMarginPercent =
        updated.basePrice > 0
          ? Number((((updated.basePrice - updated.costPrice) / updated.basePrice) * 100).toFixed(2))
          : 0;

      return {
        ...updated,
        totalAvailableStock,
        totalReservedStock,
        grossMarginPercent
      };
    });

    await cacheService.invalidateMerchantCatalog();
    return result;
  }

  /**
   * Adjusts warehouse inventory stock levels and audits the change.
   */
  async updateInventory(
    merchantId: string,
    productId: string,
    actorId: string,
    input: UpdateInventoryInput
  ) {
    const product = await this.getProductDetails(merchantId, productId);

    let inventory = await prisma.inventory.findFirst({
      where: {
        productId,
        merchantId,
        variantId: null
      }
    });

    const result = await prisma.$transaction(async (tx) => {
      if (!inventory) {
        inventory = await tx.inventory.create({
          data: {
            merchantId,
            productId,
            availableUnits: input.availableUnits,
            reservedUnits: input.reservedUnits || 0,
            location: input.location || 'Primary Warehouse'
          }
        });
      } else {
        inventory = await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            availableUnits: input.availableUnits,
            reservedUnits: input.reservedUnits !== undefined ? input.reservedUnits : inventory.reservedUnits,
            location: input.location !== undefined ? input.location : inventory.location
          }
        });
      }

      await tx.auditEvent.create({
        data: {
          merchantId,
          entityType: 'INVENTORY',
          entityId: inventory.id,
          action: 'INVENTORY_UPDATED',
          actorType: 'USER',
          actorId,
          reason: `Stock updated for "${product.title}" to ${inventory.availableUnits} units`,
          metadata: {
            productId,
            availableUnits: inventory.availableUnits,
            reservedUnits: inventory.reservedUnits,
            location: inventory.location
          }
        }
      });

      return inventory;
    });

    await cacheService.invalidateMerchantCatalog();
    return result;
  }

  /**
   * Specialized, agent-readable catalog search endpoint.
   * STRICT SECURITY GUARANTEE: Never exposes costPrice or internal profit margins.
   */
  async getAgentCatalog(query: AgentCatalogQuery) {
    let merchantId = query.merchantId;

    if (!merchantId && query.merchantSlug) {
      const merchant = await prisma.merchant.findUnique({
        where: { slug: query.merchantSlug.toLowerCase() },
        select: { id: true, name: true, currency: true }
      });
      if (!merchant) {
        const error = new Error(`Merchant with slug "${query.merchantSlug}" not found.`) as Error & { statusCode?: number; code?: string };
        error.statusCode = 404;
        error.code = 'MERCHANT_NOT_FOUND';
        throw error;
      }
      merchantId = merchant.id;
    }

    if (!merchantId) {
      const defaultMerchant = await prisma.merchant.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, currency: true }
      });
      if (!defaultMerchant) {
        return { merchant: null, productsCount: 0, products: [] };
      }
      merchantId = defaultMerchant.id;
    }

    const merchantInfo = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { id: true, name: true, slug: true, currency: true }
    });

    const cacheKey = CacheService.catalogSlugKey(query.merchantSlug || merchantId);
    if (!query.search && !query.category) {
      const cached = await cacheService.get<{ merchant: any; productsCount: number; products: any[] }>(cacheKey);
      if (cached) return cached;
    }

    const whereClause: Record<string, unknown> = {
      merchantId,
      isActive: true
    };

    if (query.category) {
      whereClause['category'] = { contains: query.category, mode: 'insensitive' };
    }
    if (query.search) {
      whereClause['OR'] = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } }
      ];
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        inventory: {
          select: {
            availableUnits: true,
            location: true
          }
        }
      },
      take: query.limit || 50,
      orderBy: { title: 'asc' }
    });

    const agentItems = products.map((p) => {
      const availableUnits = p.inventory.reduce((sum, inv) => sum + inv.availableUnits, 0);
      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        category: p.category,
        description: p.description,
        basePrice: p.basePrice,
        currency: merchantInfo?.currency || 'INR',
        inStock: availableUnits > 0,
        availableUnits
      };
    });

    const result = {
      merchant: merchantInfo,
      productsCount: agentItems.length,
      products: agentItems
    };

    if (!query.search && !query.category) {
      await cacheService.set(cacheKey, result, 120);
    }

    return result;
  }
}

export const catalogService = new CatalogService();
