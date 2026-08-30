import { z } from 'zod';

// ============================================================================
// Roles & Authorization
// ============================================================================
export const MerchantRoleEnum = z.enum(['OWNER', 'ADMIN', 'STAFF']);
export type MerchantRole = z.infer<typeof MerchantRoleEnum>;

// ============================================================================
// Authentication & User Schemas
// ============================================================================
export const RegisterInputSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  name: z.string().min(2, 'Name must be at least 2 characters long'),
  merchantName: z.string().min(2, 'Merchant business name is required'),
  merchantSlug: z
    .string()
    .min(2, 'Merchant slug is required')
    .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase alphanumeric characters and hyphens'),
  currency: z.string().default('INR')
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const AuthTokenPayloadSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  merchantId: z.string().uuid(),
  merchantSlug: z.string(),
  role: MerchantRoleEnum
});
export type AuthTokenPayload = z.infer<typeof AuthTokenPayloadSchema>;

export const AuthResponseSchema = z.object({
  success: z.boolean(),
  token: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string()
  }),
  merchant: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    currency: z.string(),
    role: MerchantRoleEnum
  })
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// ============================================================================
// Catalog & Inventory Schemas
// ============================================================================
export const CreateProductInputSchema = z.object({
  title: z.string().min(2, 'Product title must be at least 2 characters long'),
  slug: z
    .string()
    .min(2, 'Product slug is required')
    .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase alphanumeric characters and hyphens'),
  description: z.string().default(''),
  category: z.string().default('General'),
  basePrice: z.number().positive('Base price must be a positive number'),
  costPrice: z.number().nonnegative('Cost price must be zero or positive'),
  initialStock: z.number().int().nonnegative('Initial stock must be zero or positive').default(0),
  location: z.string().default('Primary Warehouse')
});
export type CreateProductInput = z.infer<typeof CreateProductInputSchema>;

export const UpdateProductInputSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  basePrice: z.number().positive().optional(),
  costPrice: z.number().nonnegative().optional(),
  isActive: z.boolean().optional()
});
export type UpdateProductInput = z.infer<typeof UpdateProductInputSchema>;

export const UpdateInventoryInputSchema = z.object({
  availableUnits: z.number().int().nonnegative('Available units must be zero or positive'),
  reservedUnits: z.number().int().nonnegative('Reserved units must be zero or positive').optional(),
  location: z.string().optional()
});
export type UpdateInventoryInput = z.infer<typeof UpdateInventoryInputSchema>;

export const AgentCatalogQuerySchema = z.object({
  merchantId: z.string().uuid().optional(),
  merchantSlug: z.string().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().positive().default(50)
});
export type AgentCatalogQuery = z.infer<typeof AgentCatalogQuerySchema>;

// ============================================================================
// Policy Decision Enums & Schemas
// ============================================================================
export const PolicyDecisionEnum = z.enum([
  'ALLOW',
  'COUNTER',
  'APPROVAL_REQUIRED',
  'REJECT'
]);
export type PolicyDecision = z.infer<typeof PolicyDecisionEnum>;

export const PolicyConfigSchema = z.object({
  id: z.string().uuid(),
  merchantId: z.string().uuid(),
  maxDiscountPercent: z.number().min(0).max(100),
  minimumMarginPercent: z.number().min(0).max(100),
  autonomousOrderLimit: z.number().nonnegative(),
  approvalThreshold: z.number().nonnegative().nullable().optional(),
  maxQuantityPerOrder: z.number().int().positive().default(100),
  rules: z.record(z.unknown()).default({}),
  isActive: z.boolean().default(true),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string())
});
export type PolicyConfig = z.infer<typeof PolicyConfigSchema>;

export const UpdatePolicyInputSchema = z.object({
  maxDiscountPercent: z.number().min(0).max(100).optional(),
  minimumMarginPercent: z.number().min(0).max(100).optional(),
  autonomousOrderLimit: z.number().nonnegative().optional(),
  approvalThreshold: z.number().nonnegative().nullable().optional(),
  maxQuantityPerOrder: z.number().int().positive().optional(),
  rules: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional()
});
export type UpdatePolicyInput = z.infer<typeof UpdatePolicyInputSchema>;

export const OfferEvaluationItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  proposedUnitPrice: z.number().positive('Proposed unit price must be positive'),
  basePrice: z.number().positive().optional(),
  costPrice: z.number().nonnegative().optional()
});
export type OfferEvaluationItem = z.infer<typeof OfferEvaluationItemSchema>;

export const OfferEvaluationInputSchema = z.object({
  items: z.array(OfferEvaluationItemSchema).min(1, 'At least one item is required for evaluation'),
  customerTier: z.string().optional()
});
export type OfferEvaluationInput = z.infer<typeof OfferEvaluationInputSchema>;

export const PolicyRuleBreakdownSchema = z.object({
  ruleName: z.string(),
  passed: z.boolean(),
  value: z.number(),
  threshold: z.number(),
  message: z.string()
});
export type PolicyRuleBreakdown = z.infer<typeof PolicyRuleBreakdownSchema>;

export const CounterOfferItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().int().positive(),
  counterUnitPrice: z.number().positive(),
  originalBasePrice: z.number().positive(),
  discountPercent: z.number().nonnegative()
});
export type CounterOfferItem = z.infer<typeof CounterOfferItemSchema>;

export const OfferEvaluationResultSchema = z.object({
  decision: PolicyDecisionEnum,
  allowed: z.boolean(),
  requiresApproval: z.boolean(),
  totalBaseAmount: z.number(),
  totalProposedAmount: z.number(),
  totalEffectiveDiscountPercent: z.number(),
  averageGrossMarginPercent: z.number(),
  counterOffer: z
    .object({
      items: z.array(CounterOfferItemSchema),
      totalCounterAmount: z.number(),
      counterDiscountPercent: z.number()
    })
    .optional(),
  reasons: z.array(z.string()),
  breakdowns: z.array(PolicyRuleBreakdownSchema)
});
export type OfferEvaluationResult = z.infer<typeof OfferEvaluationResultSchema>;

// ============================================================================
// Order State Machine
// ============================================================================
export const OrderStatusEnum = z.enum([
  'NEGOTIATING',
  'OFFER_CREATED',
  'APPROVAL_PENDING',
  'APPROVED',
  'PAYMENT_PENDING',
  'PAYMENT_PROCESSING',
  'PAID',
  'FULFILLMENT_PENDING',
  'COMPLETED',
  'PAYMENT_FAILED',
  'PRICE_CHANGED',
  'INVENTORY_CHANGED',
  'APPROVAL_REJECTED',
  'CANCELLED'
]);
export type OrderStatus = z.infer<typeof OrderStatusEnum>;

// ============================================================================
// Payment State Machine
// ============================================================================
export const PaymentStatusEnum = z.enum([
  'PENDING',
  'PROCESSING',
  'CAPTURED',
  'FAILED',
  'REFUNDED'
]);
export type PaymentStatus = z.infer<typeof PaymentStatusEnum>;

// ============================================================================
// Audit Event Types
// ============================================================================
export const AuditActionEnum = z.enum([
  'NEGOTIATION_STARTED',
  'CATALOG_SEARCHED',
  'PRODUCT_SELECTED',
  'PRODUCT_CREATED',
  'PRODUCT_UPDATED',
  'INVENTORY_UPDATED',
  'PRICE_UPDATED',
  'POLICY_UPDATED',
  'OFFER_PROPOSED',
  'OFFER_CALCULATED',
  'POLICY_EVALUATED',
  'POLICY_ALLOWED',
  'POLICY_COUNTERED',
  'POLICY_REJECTED',
  'APPROVAL_REQUESTED',
  'APPROVAL_APPROVED',
  'APPROVAL_REJECTED',
  'ORDER_CREATED',
  'ORDER_UPDATED',
  'RAZORPAY_ORDER_CREATED',
  'PAYMENT_INITIATED',
  'PAYMENT_FAILED',
  'PAYMENT_RETRIED',
  'PAYMENT_CAPTURED',
  'WEBHOOK_RECEIVED',
  'WEBHOOK_PROCESSED',
  'ORDER_COMPLETED'
]);
export type AuditAction = z.infer<typeof AuditActionEnum>;

// ============================================================================
// Health Status Schema
// ============================================================================
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  version: z.string(),
  timestamp: z.string(),
  environment: z.string()
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
