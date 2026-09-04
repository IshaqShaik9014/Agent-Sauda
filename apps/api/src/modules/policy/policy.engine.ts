import type {
  PolicyConfig,
  OfferEvaluationInput,
  OfferEvaluationResult,
  PolicyRuleBreakdown,
  CounterOfferItem,
  PolicyDecision
} from '@agent-sauda/domain';
import {
  evaluateDiscountRule,
  evaluateMarginRule,
  evaluateAutonomousLimitRule,
  evaluateQuantityRule,
  computeOptimalCounterPrice
} from './policy.rules.js';

export interface EvaluatedItemFact {
  productId: string;
  variantId?: string;
  quantity: number;
  proposedUnitPrice: number;
  basePrice: number;
  costPrice: number;
}

/**
 * Pure evaluation engine for Agent Sauda.
 * Zero database, network, or LLM dependencies.
 */
export function evaluateOfferAgainstPolicy(
  policy: PolicyConfig,
  _input: OfferEvaluationInput,
  itemFacts: EvaluatedItemFact[]
): OfferEvaluationResult {
  const breakdowns: PolicyRuleBreakdown[] = [];
  const reasons: string[] = [];

  let totalBaseAmount = 0;
  let totalProposedAmount = 0;
  let totalCostAmount = 0;

  let hasMarginViolation = false;
  let hasDiscountViolation = false;
  let hasQuantityViolation = false;
  const counterItems: CounterOfferItem[] = [];

  for (const item of itemFacts) {
    const itemSubtotal = item.proposedUnitPrice * item.quantity;
    const baseSubtotal = item.basePrice * item.quantity;
    const costSubtotal = item.costPrice * item.quantity;

    totalBaseAmount += baseSubtotal;
    totalProposedAmount += itemSubtotal;
    totalCostAmount += costSubtotal;

    // 1. Evaluate Quantity Rule
    const quantityBreakdown = evaluateQuantityRule(item.quantity, policy.maxQuantityPerOrder);
    breakdowns.push(quantityBreakdown);
    if (!quantityBreakdown.passed) {
      hasQuantityViolation = true;
      reasons.push(quantityBreakdown.message);
    }

    // 2. Evaluate Margin Floor Rule
    const marginBreakdown = evaluateMarginRule(item.costPrice, item.proposedUnitPrice, policy.minimumMarginPercent);
    breakdowns.push(marginBreakdown);
    if (!marginBreakdown.passed) {
      hasMarginViolation = true;
      reasons.push(marginBreakdown.message);
    }

    // 3. Evaluate Discount Cap Rule
    const discountBreakdown = evaluateDiscountRule(item.basePrice, item.proposedUnitPrice, policy.maxDiscountPercent);
    breakdowns.push(discountBreakdown);
    if (!discountBreakdown.passed) {
      hasDiscountViolation = true;
      reasons.push(discountBreakdown.message);
    }

    // Calculate counter offer for this item
    const counterCalc = computeOptimalCounterPrice(
      item.basePrice,
      item.costPrice,
      policy.maxDiscountPercent,
      policy.minimumMarginPercent
    );

    counterItems.push({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      counterUnitPrice: counterCalc.counterUnitPrice,
      originalBasePrice: item.basePrice,
      discountPercent: counterCalc.discountPercent
    });
  }

  // 4. Evaluate Autonomous Order Value Limit
  const limitBreakdown = evaluateAutonomousLimitRule(totalProposedAmount, policy.autonomousOrderLimit);
  breakdowns.push(limitBreakdown);
  const exceedsAutonomousLimit = !limitBreakdown.passed;
  if (exceedsAutonomousLimit) {
    reasons.push(limitBreakdown.message);
  }

  const totalEffectiveDiscountPercent =
    totalBaseAmount > 0
      ? Number((((totalBaseAmount - totalProposedAmount) / totalBaseAmount) * 100).toFixed(2))
      : 0;

  const averageGrossMarginPercent =
    totalProposedAmount > 0
      ? Number((((totalProposedAmount - totalCostAmount) / totalProposedAmount) * 100).toFixed(2))
      : 0;

  // 4.5 Evaluate Discount Approval Tiers (e.g. ≤5% Auto-Allow, 5-10% Manager Approval)
  const rules = (policy.rules as Record<string, unknown>) || {};
  const autoApproveDiscountPercent =
    typeof rules['autoApproveDiscountPercent'] === 'number'
      ? (rules['autoApproveDiscountPercent'] as number)
      : policy.maxDiscountPercent;

  const requiresDiscountApproval =
    totalEffectiveDiscountPercent > autoApproveDiscountPercent &&
    totalEffectiveDiscountPercent <= policy.maxDiscountPercent;

  if (requiresDiscountApproval) {
    reasons.push(
      `Proposed discount of ${totalEffectiveDiscountPercent}% exceeds automatic threshold of ${autoApproveDiscountPercent}%. Requires human manager authorization.`
    );
  }

  // Decide the final policy outcome
  let decision: PolicyDecision = 'ALLOW';
  let allowed = false;
  let requiresApproval = false;

  if (hasQuantityViolation || (hasMarginViolation && averageGrossMarginPercent < 0)) {
    // Hard rejection: severe inventory breach or negative profit loss
    decision = 'REJECT';
    allowed = false;
  } else if (hasDiscountViolation || hasMarginViolation) {
    // Discount or margin breach, but counter-offer is mathematically viable
    decision = 'COUNTER';
    allowed = false;
  } else if (exceedsAutonomousLimit || requiresDiscountApproval) {
    // Unit price is within allowed limits, but discount tier or order volume requires human manager sign-off
    decision = 'APPROVAL_REQUIRED';
    allowed = false;
    requiresApproval = true;
  } else {
    // Fully compliant with all merchant policy parameters
    decision = 'ALLOW';
    allowed = true;
    reasons.push('Offer complies with all active discount, margin, and order threshold policies.');
  }

  const totalCounterAmount = counterItems.reduce(
    (sum, item) => sum + item.counterUnitPrice * item.quantity,
    0
  );
  const counterDiscountPercent =
    totalBaseAmount > 0
      ? Number((((totalBaseAmount - totalCounterAmount) / totalBaseAmount) * 100).toFixed(2))
      : 0;

  return {
    decision,
    allowed,
    requiresApproval,
    totalBaseAmount: Number(totalBaseAmount.toFixed(2)),
    totalProposedAmount: Number(totalProposedAmount.toFixed(2)),
    totalEffectiveDiscountPercent,
    averageGrossMarginPercent,
    counterOffer:
      decision === 'COUNTER'
        ? {
            items: counterItems,
            totalCounterAmount: Number(totalCounterAmount.toFixed(2)),
            counterDiscountPercent
          }
        : undefined,
    reasons,
    breakdowns
  };
}
