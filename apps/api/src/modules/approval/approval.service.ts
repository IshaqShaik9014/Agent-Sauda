import { prisma } from '@agent-sauda/database';
import type {
  CreateApprovalInput,
  ReviewApprovalInput,
  ApprovalResponse,
  ListApprovalsQuery,
  ApprovalStatus,
  OfferResponse,
  OfferItemResponse,
  OfferStatus
} from '@agent-sauda/domain';

export class ApprovalService {
  /**
   * Creates an explicit approval request for an offer requiring merchant human review.
   */
  async createApprovalRequest(
    merchantId: string,
    actorId: string | undefined,
    input: CreateApprovalInput
  ): Promise<ApprovalResponse> {
    const offer = await prisma.offer.findFirst({
      where: { id: input.offerId, merchantId }
    });

    if (!offer) {
      const error = new Error(`Offer ${input.offerId} not found for merchant.`) as Error & { statusCode?: number; code?: string };
      error.statusCode = 404;
      error.code = 'OFFER_NOT_FOUND';
      throw error;
    }

    // Check for existing pending approval
    const existing = await prisma.approval.findFirst({
      where: { offerId: offer.id, status: 'PENDING' }
    });

    if (existing) {
      return this.getApprovalById(existing.id, merchantId);
    }

    const approval = await prisma.$transaction(async (tx) => {
      // 1. Ensure Offer is locked in DRAFT status
      await tx.offer.update({
        where: { id: offer.id },
        data: { status: 'DRAFT' }
      });

      // 2. Create Approval record
      const created = await tx.approval.create({
        data: {
          merchantId,
          offerId: offer.id,
          requestedById: actorId || null,
          status: 'PENDING',
          requestReason: input.requestReason
        },
        include: {
          offer: {
            include: {
              items: { include: { product: true } },
              merchant: true
            }
          },
          approvedBy: true
        }
      });

      // 3. Emit Audit Event
      await tx.auditEvent.create({
        data: {
          merchantId,
          entityType: 'APPROVAL',
          entityId: created.id,
          action: 'APPROVAL_REQUESTED',
          actorType: actorId ? 'USER' : 'SYSTEM',
          actorId: actorId || 'system-policy-engine',
          reason: input.requestReason,
          metadata: {
            offerId: offer.id,
            offerNumber: offer.offerNumber,
            totalAmount: offer.totalAmount
          }
        }
      });

      return created;
    });

    return this.formatApprovalResponse(approval);
  }

  /**
   * Retrieves an approval record with lazy timeout evaluation.
   */
  async getApprovalById(approvalId: string, merchantId: string): Promise<ApprovalResponse> {
    const approval = await prisma.approval.findUnique({
      where: { id: approvalId },
      include: {
        offer: {
          include: {
            items: { include: { product: true } },
            merchant: true
          }
        },
        approvedBy: true
      }
    });

    if (!approval) {
      const error = new Error(`Approval request ${approvalId} not found.`) as Error & { statusCode?: number; code?: string };
      error.statusCode = 404;
      error.code = 'APPROVAL_NOT_FOUND';
      throw error;
    }

    if (approval.merchantId !== merchantId) {
      const error = new Error('Access denied to this merchant approval queue.') as Error & { statusCode?: number; code?: string };
      error.statusCode = 403;
      error.code = 'FORBIDDEN_MERCHANT_ACCESS';
      throw error;
    }

    // Lazy Timeout Check: If still PENDING and offer past expiration
    const now = new Date();
    if (approval.status === 'PENDING' && now > approval.offer.expiresAt) {
      const updated = await prisma.$transaction(async (tx) => {
        const timedOut = await tx.approval.update({
          where: { id: approval.id },
          data: {
            status: 'REJECTED',
            resolutionNotes: 'Auto-cancelled due to review timeout expiration.',
            resolvedAt: now
          },
          include: {
            offer: {
              include: {
                items: { include: { product: true } },
                merchant: true
              }
            },
            approvedBy: true
          }
        });

        await tx.offer.update({
          where: { id: approval.offerId },
          data: { status: 'EXPIRED' }
        });

        await tx.auditEvent.create({
          data: {
            merchantId,
            entityType: 'APPROVAL',
            entityId: approval.id,
            action: 'APPROVAL_REJECTED',
            actorType: 'SYSTEM',
            actorId: 'system-timer',
            reason: `Approval request auto-rejected due to expiration timeout.`
          }
        });

        return timedOut;
      });

      return this.formatApprovalResponse(updated);
    }

    return this.formatApprovalResponse(approval);
  }

  /**
   * Approves a pending deal request, unlocking the Offer to ACTIVE with a fresh 24h checkout window.
   */
  async approveRequest(
    approvalId: string,
    merchantId: string,
    actorId: string,
    input: ReviewApprovalInput
  ): Promise<ApprovalResponse> {
    const approval = await this.getApprovalById(approvalId, merchantId);

    if (approval.status !== 'PENDING') {
      const error = new Error(`Cannot approve request in "${approval.status}" status.`) as Error & {
        statusCode?: number;
        code?: string;
      };
      error.statusCode = 400;
      error.code = 'INVALID_APPROVAL_STATE';
      throw error;
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update Approval record
      const approved = await tx.approval.update({
        where: { id: approvalId },
        data: {
          status: 'APPROVED',
          approvedById: actorId,
          resolvedAt: new Date(),
          resolutionNotes: input.resolutionNotes || 'Approved by store manager'
        },
        include: {
          offer: {
            include: {
              items: { include: { product: true } },
              merchant: true
            }
          },
          approvedBy: true
        }
      });

      // 2. Unlock Offer to ACTIVE with fresh 24-hour checkout window
      const freshExpiresAt = new Date(Date.now() + 24 * 3600 * 1000);
      await tx.offer.update({
        where: { id: approval.offerId },
        data: {
          status: 'ACTIVE',
          expiresAt: freshExpiresAt
        }
      });

      // 3. Emit Audit Event
      await tx.auditEvent.create({
        data: {
          merchantId,
          entityType: 'APPROVAL',
          entityId: approved.id,
          action: 'APPROVAL_APPROVED',
          actorType: 'USER',
          actorId,
          reason: input.resolutionNotes || `Manager approved Offer ${approved.offer?.offerNumber}`
        }
      });

      return approved;
    });

    return this.formatApprovalResponse(updated);
  }

  /**
   * Rejects a pending approval request and transitions the Offer to REJECTED.
   */
  async rejectRequest(
    approvalId: string,
    merchantId: string,
    actorId: string,
    input: ReviewApprovalInput
  ): Promise<ApprovalResponse> {
    const approval = await this.getApprovalById(approvalId, merchantId);

    if (approval.status !== 'PENDING') {
      const error = new Error(`Cannot reject request in "${approval.status}" status.`) as Error & {
        statusCode?: number;
        code?: string;
      };
      error.statusCode = 400;
      error.code = 'INVALID_APPROVAL_STATE';
      throw error;
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update Approval record
      const rejected = await tx.approval.update({
        where: { id: approvalId },
        data: {
          status: 'REJECTED',
          approvedById: actorId,
          resolvedAt: new Date(),
          resolutionNotes: input.resolutionNotes || 'Rejected by store manager'
        },
        include: {
          offer: {
            include: {
              items: { include: { product: true } },
              merchant: true
            }
          },
          approvedBy: true
        }
      });

      // 2. Transition Offer to REJECTED
      await tx.offer.update({
        where: { id: approval.offerId },
        data: { status: 'REJECTED' }
      });

      // 3. Emit Audit Event
      await tx.auditEvent.create({
        data: {
          merchantId,
          entityType: 'APPROVAL',
          entityId: rejected.id,
          action: 'APPROVAL_REJECTED',
          actorType: 'USER',
          actorId,
          reason: input.resolutionNotes || `Manager rejected Offer ${rejected.offer?.offerNumber}`
        }
      });

      return rejected;
    });

    return this.formatApprovalResponse(updated);
  }

  /**
   * Lists merchant approval queue with status and pagination filters.
   */
  async listApprovals(
    merchantId: string,
    query: ListApprovalsQuery
  ): Promise<{ approvalsCount: number; approvals: ApprovalResponse[] }> {
    const where: any = { merchantId };
    if (query.status) {
      where.status = query.status === 'TIMED_OUT' ? 'REJECTED' : query.status;
    }

    const [count, approvals] = await Promise.all([
      prisma.approval.count({ where }),
      prisma.approval.findMany({
        where,
        include: {
          offer: {
            include: {
              items: { include: { product: true } },
              merchant: true
            }
          },
          approvedBy: true
        },
        orderBy: { requestedAt: 'desc' },
        take: query.limit,
        skip: query.offset
      })
    ]);

    return {
      approvalsCount: count,
      approvals: approvals.map((a) => this.formatApprovalResponse(a))
    };
  }

  /**
   * Normalizes database record to domain ApprovalResponse.
   */
  private formatApprovalResponse(approval: any): ApprovalResponse {
    let formattedOffer: OfferResponse | undefined = undefined;

    if (approval.offer) {
      const offer = approval.offer;
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

      formattedOffer = {
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

    return {
      id: approval.id,
      merchantId: approval.merchantId,
      offerId: approval.offerId,
      requestedById: approval.requestedById,
      approvedById: approval.approvedById,
      status: approval.status as ApprovalStatus,
      requestReason: approval.requestReason,
      resolutionNotes: approval.resolutionNotes,
      requestedAt: approval.requestedAt,
      resolvedAt: approval.resolvedAt,
      offer: formattedOffer,
      approvedBy: approval.approvedBy
        ? {
            id: approval.approvedBy.id,
            name: approval.approvedBy.name,
            email: approval.approvedBy.email
          }
        : undefined
    };
  }
}

export const approvalService = new ApprovalService();
