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
  availableStock?: number;
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

  // 0. Evaluate Low Stock Scarcity Guard
  let isScarcityTightened = false;
  let scarcityTighteningPercent = 0;
  const lowStockItems = itemFacts.filter(i => i.availableStock !== undefined && i.availableStock > 0 && i.availableStock <= 3);
  if (lowStockItems.length > 0) {
    const minStock = Math.min(...lowStockItems.map(i => i.availableStock!));
    isScarcityTightened = true;
    scarcityTighteningPercent = 2.5;

    breakdowns.push({
      ruleName: 'POLICY_RULE_SCARCITY_GUARD',
      passed: true,
      value: minStock,
      threshold: 3,
      message: `⚡ Low Stock Urgency Guard: Only ${minStock} unit(s) remaining in warehouse. Discount ceiling tightened by -${scarcityTighteningPercent}% to protect scarce inventory margin.`
    });
  }

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
    const effectiveMarginFloor = policy.minimumMarginPercent + (isScarcityTightened ? 1.5 : 0);
    const marginBreakdown = evaluateMarginRule(item.costPrice, item.proposedUnitPrice, effectiveMarginFloor);
    breakdowns.push(marginBreakdown);
    if (!marginBreakdown.passed) {
      hasMarginViolation = true;
      reasons.push(marginBreakdown.message);
    }

    // 3. Evaluate Discount Cap Rule
    const itemMaxDiscount = Math.max(0, policy.maxDiscountPercent - (isScarcityTightened ? scarcityTighteningPercent : 0));
    const discountBreakdown = evaluateDiscountRule(item.basePrice, item.proposedUnitPrice, itemMaxDiscount);
    breakdowns.push(discountBreakdown);
    if (!discountBreakdown.passed) {
      hasDiscountViolation = true;
      reasons.push(discountBreakdown.message);
    }

    // Calculate counter offer for this item
    const counterCalc = computeOptimalCounterPrice(
      item.basePrice,
      item.costPrice,
      itemMaxDiscount,
      effectiveMarginFloor
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

  // 3.5 Evaluate Multi-Product Bundle & Cross-Basket Margin Optimization
  const totalItemCount = itemFacts.reduce((sum, i) => sum + i.quantity, 0);
  const isMultiItemBundle = itemFacts.length >= 2 || totalItemCount >= 3;
  let isBundleBonusApplied = false;
  let bundleBonusPercent = 0;

  // If customer is bundling multiple items and combined gross margin is healthy (≥ minimumMargin + 4%), grant +2.5% bonus discount elasticity
  const bundleMarginThreshold = policy.minimumMarginPercent + 4;
  if (isMultiItemBundle && averageGrossMarginPercent >= bundleMarginThreshold && !isScarcityTightened) {
    isBundleBonusApplied = true;
    bundleBonusPercent = 2.5;

    breakdowns.push({
      ruleName: 'POLICY_RULE_BUNDLE_OPTIMIZATION',
      passed: true,
      value: averageGrossMarginPercent,
      threshold: bundleMarginThreshold,
      message: `🎉 Multi-Product Bundle Optimization: Unlocked +${bundleBonusPercent}% bundle discount bonus! Combined basket gross margin (${averageGrossMarginPercent}%) exceeds ${bundleMarginThreshold}% floor.`
    });
  }

  const effectiveMaxDiscount = Math.max(
    0,
    policy.maxDiscountPercent +
      (isBundleBonusApplied ? bundleBonusPercent : 0) -
      (isScarcityTightened ? scarcityTighteningPercent : 0)
  );

  // Re-evaluate discount cap against effective bundle threshold if bonus applied
  if (isBundleBonusApplied && hasDiscountViolation && totalEffectiveDiscountPercent <= effectiveMaxDiscount) {
    hasDiscountViolation = false;
  }

  // 4.5 Evaluate Discount Approval Tiers (e.g. ≤5% Auto-Allow, 5-10% Manager Approval)
  const rules = (policy.rules as Record<string, unknown>) || {};
  const autoApproveDiscountPercent =
    typeof rules['autoApproveDiscountPercent'] === 'number'
      ? Math.max(
          0,
          (rules['autoApproveDiscountPercent'] as number) +
            (isBundleBonusApplied ? bundleBonusPercent : 0) -
            (isScarcityTightened ? scarcityTighteningPercent : 0)
        )
      : effectiveMaxDiscount;

  const requiresDiscountApproval =
    totalEffectiveDiscountPercent > autoApproveDiscountPercent &&
    totalEffectiveDiscountPercent <= effectiveMaxDiscount;

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
    reasons.push(
      isBundleBonusApplied
        ? `Offer complies with merchant policy and includes a +${bundleBonusPercent}% multi-product bundle discount bonus.`
        : isScarcityTightened
        ? `Offer complies with tightened inventory scarcity threshold (${scarcityTighteningPercent}% guard applied).`
        : 'Offer complies with all active discount, margin, and order threshold policies.'
    );
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
    isBundleBonusApplied,
    bundleBonusPercent: isBundleBonusApplied ? bundleBonusPercent : 0,
    isScarcityTightened,
    scarcityTighteningPercent: isScarcityTightened ? scarcityTighteningPercent : 0,
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
