import { prisma } from '@agent-sauda/database';
import { policyService } from '../policy/policy.service.js';
import type {
  CreateOfferInput,
  OfferResponse,
  OfferItemResponse,
  AcceptOfferInput,
  RejectOfferInput,
  ListOffersQuery,
  OfferStatus
} from '@agent-sauda/domain';
import { randomBytes } from 'node:crypto';

export class OfferService {
  /**
   * Creates a formal commercial Offer from an agreed negotiation or direct input.
   */
  async createOffer(
    merchantId: string,
    actorId: string | undefined,
    input: CreateOfferInput
  ): Promise<OfferResponse> {
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId }
    });

    if (!merchant) {
      const error = new Error(`Merchant ${merchantId} not found.`) as Error & { statusCode?: number; code?: string };
      error.statusCode = 404;
      error.code = 'MERCHANT_NOT_FOUND';
      throw error;
    }

    // 1. Resolve or create Conversation
    let conversationId = input.conversationId;
    if (conversationId) {
      const existingConv = await prisma.conversation.findFirst({
        where: { id: conversationId, merchantId }
      });
      if (!existingConv) {
        conversationId = undefined;
      }
    }

    if (!conversationId) {
      const newConv = await prisma.conversation.create({
        data: {
          merchantId,
          channel: 'WEB',
          status: 'ACTIVE'
        }
      });
      conversationId = newConv.id;
    }

    // 2. Fetch authoritative product facts from database
    const productIds = input.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        merchantId,
        isActive: true
      }
    });

    if (products.length !== productIds.length) {
      const foundIds = new Set(products.map((p) => p.id));
      const missingIds = productIds.filter((id) => !foundIds.has(id));
      const error = new Error(`One or more products were not found or inactive: ${missingIds.join(', ')}`) as Error & {
        statusCode?: number;
        code?: string;
      };
      error.statusCode = 400;
      error.code = 'INVALID_OFFER_ITEMS';
      throw error;
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    // 3. Evaluate deal with Deterministic Policy Engine
    const evalInput = {
      items: input.items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        quantity: i.quantity,
        proposedUnitPrice: i.agreedPrice
      })),
      customerTier: input.customerTier
    };

    const evaluation = await policyService.evaluateOffer(merchantId, actorId, evalInput);

    if (evaluation.decision === 'REJECT') {
      const error = new Error(`Offer rejected by merchant policy: ${evaluation.reasons.join(', ')}`) as Error & {
        statusCode?: number;
        code?: string;
      };
      error.statusCode = 400;
      error.code = 'POLICY_REJECTED';
      throw error;
    }

    // 4. Calculate Financial Metrics
    let subtotal = 0;
    let totalAmount = 0;
    let totalCost = 0;

    const offerItemsData = input.items.map((i) => {
      const product = productMap.get(i.productId)!;
      const itemSubtotal = i.quantity * i.agreedPrice;
      const baseSubtotal = i.quantity * product.basePrice;
      const costSubtotal = i.quantity * product.costPrice;

      subtotal += baseSubtotal;
      totalAmount += itemSubtotal;
      totalCost += costSubtotal;

      return {
        productId: i.productId,
        variantId: i.variantId || null,
        quantity: i.quantity,
        unitPrice: product.basePrice,
        agreedPrice: i.agreedPrice,
        costPrice: product.costPrice,
        subtotal: itemSubtotal
      };
    });

    const discountAmount = Math.max(0, subtotal - totalAmount);
    const discountPercent = subtotal > 0 ? Number(((discountAmount / subtotal) * 100).toFixed(2)) : 0;
    const marginPercent = totalAmount > 0 ? Number((((totalAmount - totalCost) / totalAmount) * 100).toFixed(2)) : 0;

    const expirationHours = input.expirationHours || 24;
    const expiresAt = new Date(Date.now() + expirationHours * 3600 * 1000);
    const offerNumber = `OFF-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;

    const initialStatus = (evaluation.decision === 'APPROVAL_REQUIRED' || input.forceDraft) ? 'DRAFT' : 'ACTIVE';

    // 5. Persist Offer and Items in Transaction
    const offer = await prisma.$transaction(
      async (tx) => {
      const createdOffer = await tx.offer.create({
        data: {
          merchantId,
          conversationId: conversationId!,
          offerNumber,
          subtotal,
          discountAmount,
          discountPercent,
          taxAmount: 0,
          totalAmount,
          marginPercent,
          policyDecision: evaluation.decision,
          policyReason: evaluation.reasons.join('; ') || 'Approved by merchant policy engine',
          status: initialStatus,
          expiresAt,
          items: {
            create: offerItemsData
          }
        },
        include: {
          items: {
            include: { product: true }
          },
          merchant: true
        }
      });

      // If approval required, create pending Approval record
      if (evaluation.decision === 'APPROVAL_REQUIRED') {
        await tx.approval.create({
          data: {
            merchantId,
            offerId: createdOffer.id,
            requestedById: actorId || null,
            status: 'PENDING',
            requestReason: evaluation.reasons.join('; ') || 'Order exceeds merchant autonomous spending limit'
          }
        });

        await tx.auditEvent.create({
          data: {
            merchantId,
            entityType: 'APPROVAL',
            entityId: createdOffer.id,
            action: 'APPROVAL_REQUESTED',
            actorType: actorId ? 'USER' : 'SYSTEM',
            actorId: actorId || 'system',
            reason: `Approval requested for high-value Offer ${offerNumber} (₹${totalAmount.toLocaleString('en-IN')})`
          }
        });
      }

      // Audit Event
      await tx.auditEvent.create({
        data: {
          merchantId,
          entityType: 'OFFER',
          entityId: createdOffer.id,
          action: 'OFFER_CREATED',
          actorType: actorId ? 'USER' : 'AGENT',
          actorId: actorId || 'sales-agent',
          reason: `Offer ${offerNumber} created for ₹${totalAmount.toLocaleString('en-IN')} (Status: ${initialStatus})`,
          metadata: {
            offerNumber,
            totalAmount,
            discountPercent,
            decision: evaluation.decision,
            status: initialStatus,
            expiresAt: expiresAt.toISOString()
          }
        }
      });

      return createdOffer;
    },
    { maxWait: 15000, timeout: 30000 }
  );

    return this.formatOfferResponse(offer);
  }

  /**
   * Retrieves an offer by ID with lazy expiration evaluation.
   */
  async getOfferById(offerId: string, merchantId?: string): Promise<OfferResponse> {
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        items: {
          include: { product: true }
        },
        merchant: true
      }
    });

    if (!offer) {
      const error = new Error(`Offer ${offerId} not found.`) as Error & { statusCode?: number; code?: string };
      error.statusCode = 404;
      error.code = 'OFFER_NOT_FOUND';
      throw error;
    }

    if (merchantId && offer.merchantId !== merchantId) {
      const error = new Error('Access denied to this merchant offer.') as Error & { statusCode?: number; code?: string };
      error.statusCode = 403;
      error.code = 'FORBIDDEN_MERCHANT_ACCESS';
      throw error;
    }

    // Lazy Expiration Check
    const now = new Date();
    if (offer.status === 'ACTIVE' && now > offer.expiresAt) {
      const updated = await prisma.offer.update({
        where: { id: offer.id },
        data: { status: 'EXPIRED' },
        include: {
          items: {
            include: { product: true }
          },
          merchant: true
        }
      });

      await prisma.auditEvent.create({
        data: {
          merchantId: offer.merchantId,
          entityType: 'OFFER',
          entityId: offer.id,
          action: 'OFFER_EXPIRED',
          actorType: 'SYSTEM',
          actorId: 'system-timer',
          reason: `Offer ${offer.offerNumber} expired automatically on ${offer.expiresAt.toISOString()}`
        }
      });

      return this.formatOfferResponse(updated);
    }

    return this.formatOfferResponse(offer);
  }

  /**
   * Transitions an ACTIVE offer to ACCEPTED by the buyer.
   */
  async acceptOffer(
    offerId: string,
    _input: AcceptOfferInput,
    actorId?: string
  ): Promise<OfferResponse> {
    const offer = await this.getOfferById(offerId);

    if (offer.isExpired || offer.status === 'EXPIRED') {
      const error = new Error(`Cannot accept offer ${offer.offerNumber}. This offer expired on ${new Date(offer.expiresAt).toLocaleString()}.`) as Error & {
        statusCode?: number;
        code?: string;
      };
      error.statusCode = 400;
      error.code = 'OFFER_EXPIRED';
      throw error;
    }

    if (offer.status !== 'ACTIVE') {
      const error = new Error(`Cannot accept offer in "${offer.status}" status.`) as Error & {
        statusCode?: number;
        code?: string;
      };
      error.statusCode = 400;
      error.code = 'INVALID_OFFER_STATE';
      throw error;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const accepted = await tx.offer.update({
        where: { id: offerId },
        data: { status: 'ACCEPTED' },
        include: {
          items: { include: { product: true } },
          merchant: true
        }
      });

      await tx.auditEvent.create({
        data: {
          merchantId: accepted.merchantId,
          entityType: 'OFFER',
          entityId: accepted.id,
          action: 'OFFER_ACCEPTED',
          actorType: 'USER',
          actorId: actorId || 'buyer-customer',
          reason: `Offer ${accepted.offerNumber} accepted by buyer for ₹${accepted.totalAmount.toLocaleString('en-IN')}`
        }
      });

      return accepted;
    });

    return this.formatOfferResponse(updated);
  }

  /**
   * Transitions an offer to REJECTED.
   */
  async rejectOffer(
    offerId: string,
    input: RejectOfferInput,
    actorId?: string
  ): Promise<OfferResponse> {
    const offer = await this.getOfferById(offerId);

    if (offer.status === 'ACCEPTED') {
      const error = new Error(`Cannot reject offer ${offer.offerNumber} as it has already been accepted.`) as Error & {
        statusCode?: number;
        code?: string;
      };
      error.statusCode = 400;
      error.code = 'OFFER_ALREADY_ACCEPTED';
      throw error;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const rejected = await tx.offer.update({
        where: { id: offerId },
        data: { status: 'REJECTED' },
        include: {
          items: { include: { product: true } },
          merchant: true
        }
      });

      await tx.auditEvent.create({
        data: {
          merchantId: rejected.merchantId,
          entityType: 'OFFER',
          entityId: rejected.id,
          action: 'OFFER_REJECTED',
          actorType: 'USER',
          actorId: actorId || 'buyer-customer',
          reason: input.reason || 'Offer rejected'
        }
      });

      return rejected;
    });

    return this.formatOfferResponse(updated);
  }

  /**
   * Lists merchant offers with status and pagination filters.
   */
  async listOffers(
    merchantId: string,
    query: ListOffersQuery
  ): Promise<{ offersCount: number; offers: OfferResponse[] }> {
    const where: any = { merchantId };
    if (query.status) {
      where.status = query.status;
    }
    if (query.conversationId) {
      where.conversationId = query.conversationId;
    }

    const [count, offers] = await Promise.all([
      prisma.offer.count({ where }),
      prisma.offer.findMany({
        where,
        include: {
          items: { include: { product: true } },
          merchant: true
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset
      })
    ]);

    return {
      offersCount: count,
      offers: offers.map((o) => this.formatOfferResponse(o))
    };
  }

  /**
   * Normalizes Offer database record to domain OfferResponse.
   */
  private formatOfferResponse(offer: any): OfferResponse {
    const now = new Date();
    const isExpired = offer.status === 'EXPIRED' || (offer.status === 'ACTIVE' && now > new Date(offer.expiresAt));

    const items: OfferItemResponse[] = (offer.items || []).map((item: any) => ({
      id: item.id,
      offerId: item.offerId,
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      agreedPrice: item.agreedPrice,
      subtotal: item.subtotal,
      productTitle: item.product?.title || 'Unknown Product',
      productSlug: item.product?.slug || 'unknown-product'
    }));

    return {
      id: offer.id,
      merchantId: offer.merchantId,
      conversationId: offer.conversationId,
      offerNumber: offer.offerNumber,
      subtotal: offer.subtotal,
      discountAmount: offer.discountAmount,
      discountPercent: offer.discountPercent,
      taxAmount: offer.taxAmount,
      totalAmount: offer.totalAmount,
      marginPercent: offer.marginPercent,
      policyDecision: offer.policyDecision,
      policyReason: offer.policyReason,
      status: (isExpired && offer.status === 'ACTIVE' ? 'EXPIRED' : offer.status) as OfferStatus,
      expiresAt: offer.expiresAt,
      isExpired,
      checkoutUrl: `/checkout/${offer.id}`,
      items,
      merchant: offer.merchant
        ? {
            id: offer.merchant.id,
            name: offer.merchant.name,
            slug: offer.merchant.slug,
            currency: offer.merchant.currency
          }
        : undefined,
      createdAt: offer.createdAt,
      updatedAt: offer.updatedAt
    };
  }
}

export const offerService = new OfferService();
