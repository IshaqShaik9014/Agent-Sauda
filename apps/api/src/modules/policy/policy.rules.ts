import type { PolicyRuleBreakdown } from '@agent-sauda/domain';

/**
 * Evaluates whether a proposed unit price violates the merchant's maximum discount percentage cap.
 */
export function evaluateDiscountRule(
  basePrice: number,
  proposedPrice: number,
  maxDiscountPercent: number
): PolicyRuleBreakdown {
  if (basePrice <= 0) {
    return {
      ruleName: 'MAX_DISCOUNT_PERCENT',
      passed: true,
      value: 0,
      threshold: maxDiscountPercent,
      message: 'Base price is zero; discount rule bypassed.'
    };
  }

  const effectiveDiscountPercent = Number(
    (((basePrice - proposedPrice) / basePrice) * 100).toFixed(2)
  );

  // Allow 0.05% tolerance for integer rounding (e.g. ₹5,488.2 rounding to ₹5,488)
  const passed = effectiveDiscountPercent <= maxDiscountPercent + 0.05;

  return {
    ruleName: 'MAX_DISCOUNT_PERCENT',
    passed,
    value: effectiveDiscountPercent,
    threshold: maxDiscountPercent,
    message: passed
      ? `Discount of ${effectiveDiscountPercent}% is within the allowed limit of ${maxDiscountPercent}%.`
      : `Proposed discount of ${effectiveDiscountPercent}% exceeds the maximum policy limit of ${maxDiscountPercent}%.`
  };
}

/**
 * Evaluates whether a proposed unit price satisfies the merchant's minimum gross profit margin floor.
 */
export function evaluateMarginRule(
  costPrice: number,
  proposedPrice: number,
  minimumMarginPercent: number
): PolicyRuleBreakdown {
  if (proposedPrice <= 0) {
    return {
      ruleName: 'MIN_MARGIN_PERCENT',
      passed: false,
      value: -100,
      threshold: minimumMarginPercent,
      message: 'Proposed price cannot be zero or negative.'
    };
  }

  const grossMarginPercent = Number(
    (((proposedPrice - costPrice) / proposedPrice) * 100).toFixed(2)
  );

  // Allow 0.05% tolerance for integer rounding
  const passed = proposedPrice >= costPrice && grossMarginPercent >= minimumMarginPercent - 0.05;

  return {
    ruleName: 'MIN_MARGIN_PERCENT',
    passed,
    value: grossMarginPercent,
    threshold: minimumMarginPercent,
    message: passed
      ? `Gross margin of ${grossMarginPercent}% satisfies the minimum requirement of ${minimumMarginPercent}%.`
      : `Gross margin of ${grossMarginPercent}% falls below the minimum required margin of ${minimumMarginPercent}%.`
  };
}

/**
 * Evaluates whether the total transaction value exceeds the autonomous agent approval threshold.
 */
export function evaluateAutonomousLimitRule(
  orderTotal: number,
  autonomousOrderLimit: number
): PolicyRuleBreakdown {
  const passed = orderTotal <= autonomousOrderLimit;

  return {
    ruleName: 'AUTONOMOUS_ORDER_LIMIT',
    passed,
    value: orderTotal,
    threshold: autonomousOrderLimit,
    message: passed
      ? `Total order amount of ₹${orderTotal.toLocaleString('en-IN')} is within autonomous limit of ₹${autonomousOrderLimit.toLocaleString('en-IN')}.`
      : `Total order amount of ₹${orderTotal.toLocaleString('en-IN')} exceeds autonomous limit of ₹${autonomousOrderLimit.toLocaleString('en-IN')} and requires merchant approval.`
  };
}

/**
 * Evaluates whether a requested item quantity exceeds the merchant's maximum batch size.
 */
export function evaluateQuantityRule(
  quantity: number,
  maxQuantityPerOrder: number
): PolicyRuleBreakdown {
  const passed = quantity <= maxQuantityPerOrder;

  return {
    ruleName: 'MAX_QUANTITY_PER_ORDER',
    passed,
    value: quantity,
    threshold: maxQuantityPerOrder,
    message: passed
      ? `Quantity of ${quantity} units is within policy batch limit of ${maxQuantityPerOrder}.`
      : `Requested quantity of ${quantity} units exceeds maximum allowed batch limit of ${maxQuantityPerOrder}.`
  };
}

/**
 * Computes the optimal legal counter-offer price for an item based on discount caps and margin floors.
 */
export function computeOptimalCounterPrice(
  basePrice: number,
  costPrice: number,
  maxDiscountPercent: number,
  minimumMarginPercent: number
): { counterUnitPrice: number; discountPercent: number; isViable: boolean } {
  // 1. Price floor calculated from max discount limit
  const discountFloorPrice = basePrice * (1 - maxDiscountPercent / 100);

  // 2. Price floor calculated from minimum gross profit margin requirement
  // Margin = (Price - Cost) / Price >= minMargin / 100
  // Price * (1 - minMargin / 100) >= Cost
  // Price >= Cost / (1 - minMargin / 100)
  const marginMultiplier = 1 - minimumMarginPercent / 100;
  const marginFloorPrice = marginMultiplier > 0 ? costPrice / marginMultiplier : costPrice;

  // The counter price must satisfy BOTH discount limit AND margin floor
  const rawCounterPrice = Math.max(discountFloorPrice, marginFloorPrice);
  const counterUnitPrice = Number(Math.ceil(rawCounterPrice).toFixed(2));

  const isViable = counterUnitPrice <= basePrice && counterUnitPrice >= costPrice;
  const discountPercent = Number((((basePrice - counterUnitPrice) / basePrice) * 100).toFixed(2));

  return {
    counterUnitPrice,
    discountPercent: Math.max(0, discountPercent),
    isViable
  };
}
