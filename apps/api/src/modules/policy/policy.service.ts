import { prisma } from '@agent-sauda/database';
import type {
  PolicyConfig,
  UpdatePolicyInput,
  OfferEvaluationInput,
  OfferEvaluationResult
} from './policy.schema.js';
import { evaluateOfferAgainstPolicy, type EvaluatedItemFact } from './policy.engine.js';
import { cacheService, CacheService } from '../../lib/cache.js';

export class PolicyService {
  /**
   * Retrieves active policy for a merchant with 60s cache. If none exists, creates the default safe policy.
   */
  async getMerchantPolicy(merchantId: string): Promise<PolicyConfig> {
    return await cacheService.getOrSet(
      CacheService.policyKey(merchantId),
      60,
      async () => {
        let policy = await prisma.policy.findFirst({
          where: {
            merchantId,
            isActive: true
          }
        });

        if (!policy) {
          policy = await prisma.policy.create({
            data: {
              merchantId,
              maxDiscountPercent: 8.0,
              minimumMarginPercent: 18.0,
              autonomousOrderLimit: 100000.0,
              approvalThreshold: 100000.0,
              maxQuantityPerOrder: 50,
              rules: {},
              isActive: true
            }
          });
        }

        return policy as unknown as PolicyConfig;
      }
    );
  }

  /**
   * Updates merchant policy parameters, preserving an immutable version snapshot in policy_versions.
   */
  async updatePolicy(
    merchantId: string,
    actorId: string,
    input: UpdatePolicyInput
  ): Promise<PolicyConfig> {
    const current = await this.getMerchantPolicy(merchantId);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Snapshot previous policy version
      const versionCount = await tx.policyVersion.count({
        where: { policyId: current.id }
      });

      await tx.policyVersion.create({
        data: {
          merchantId,
          policyId: current.id,
          versionNumber: versionCount + 1,
          maxDiscountPercent: current.maxDiscountPercent,
          minimumMarginPercent: current.minimumMarginPercent,
          autonomousOrderLimit: current.autonomousOrderLimit,
          approvalThreshold: current.approvalThreshold ?? current.autonomousOrderLimit,
          maxQuantityPerOrder: current.maxQuantityPerOrder,
          rules: current.rules as object,
          changedById: actorId,
          changeReason: `Policy updated by user ${actorId}`
        }
      });

      // 2. Update active policy
      const updated = await tx.policy.update({
        where: { id: current.id },
        data: {
          maxDiscountPercent: input.maxDiscountPercent ?? current.maxDiscountPercent,
          minimumMarginPercent: input.minimumMarginPercent ?? current.minimumMarginPercent,
          autonomousOrderLimit: input.autonomousOrderLimit ?? current.autonomousOrderLimit,
          approvalThreshold: typeof input.approvalThreshold === 'number' ? input.approvalThreshold : (current.approvalThreshold ?? 100000.0),
          maxQuantityPerOrder: input.maxQuantityPerOrder ?? current.maxQuantityPerOrder,
          rules: (input.rules as any) ?? (current.rules as any),
          isActive: input.isActive ?? current.isActive
        }
      });

      // 3. Emit audit event
      await tx.auditEvent.create({
        data: {
          merchantId,
          entityType: 'POLICY',
          entityId: updated.id,
          action: 'POLICY_UPDATED',
          actorType: 'USER',
          actorId,
          reason: 'Merchant policy parameters updated',
          metadata: {
            oldRules: {
              maxDiscountPercent: current.maxDiscountPercent,
              minimumMarginPercent: current.minimumMarginPercent,
              autonomousOrderLimit: current.autonomousOrderLimit
            },
            newRules: {
              maxDiscountPercent: updated.maxDiscountPercent,
              minimumMarginPercent: updated.minimumMarginPercent,
              autonomousOrderLimit: updated.autonomousOrderLimit
            }
          }
        }
      });

      return updated as unknown as PolicyConfig;
    });

    await cacheService.invalidateMerchantPolicy(merchantId);
    return result;
  }

  /**
   * Evaluates an offer against the merchant's active policy using authentic database product prices.
   */
  async evaluateOffer(
    merchantId: string,
    actorId: string | undefined,
    input: OfferEvaluationInput
  ): Promise<OfferEvaluationResult> {
    const policy = await this.getMerchantPolicy(merchantId);

    // Fetch authoritative basePrice and costPrice from database
    const productIds = input.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        merchantId
      }
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    const itemFacts: EvaluatedItemFact[] = input.items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new Error(`Product ${item.productId} not found in merchant catalog.`);
      }

      return {
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        proposedUnitPrice: item.proposedUnitPrice,
        basePrice: product.basePrice,
        costPrice: product.costPrice
      };
    });

    const result = evaluateOfferAgainstPolicy(policy, input, itemFacts);

    // Emit audit log
    const auditAction =
      result.decision === 'ALLOW'
        ? 'POLICY_ALLOWED'
        : result.decision === 'COUNTER'
        ? 'POLICY_COUNTERED'
        : result.decision === 'APPROVAL_REQUIRED'
        ? 'APPROVAL_REQUESTED'
        : 'POLICY_REJECTED';

    await prisma.auditEvent.create({
      data: {
        merchantId,
        entityType: 'OFFER',
        entityId: input.items[0]?.productId || policy.id,
        action: auditAction,
        actorType: actorId ? 'USER' : 'SYSTEM',
        actorId: actorId || 'sales-agent',
        reason: `Evaluated offer with decision ${result.decision}`,
        metadata: {
          decision: result.decision,
          totalProposedAmount: result.totalProposedAmount,
          effectiveDiscount: result.totalEffectiveDiscountPercent,
          margin: result.averageGrossMarginPercent,
          reasons: result.reasons
        }
      }
    });

    return result;
  }
}

export const policyService = new PolicyService();
