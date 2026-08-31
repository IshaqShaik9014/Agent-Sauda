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
// Agent & Conversational Chat Schemas
// ============================================================================
export const ChatMessageRoleEnum = z.enum(['system', 'user', 'assistant', 'tool']);
export type ChatMessageRole = z.infer<typeof ChatMessageRoleEnum>;

export const ToolCallDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.record(z.unknown())
});
export type ToolCallDefinition = z.infer<typeof ToolCallDefinitionSchema>;

export const ChatMessageSchema = z.object({
  id: z.string().optional(),
  role: ChatMessageRoleEnum,
  content: z.string(),
  toolCalls: z.array(ToolCallDefinitionSchema).optional(),
  toolCallId: z.string().optional(),
  createdAt: z.date().or(z.string()).optional()
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatInputSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1, 'Message content cannot be empty'),
  customerId: z.string().optional(),
  customerName: z.string().optional()
});
export type ChatInput = z.infer<typeof ChatInputSchema>;

export const ChatResponseSchema = z.object({
  success: z.boolean(),
  conversationId: z.string().uuid(),
  message: z.string(),
  toolCallsExecuted: z.array(ToolCallDefinitionSchema).default([]),
  evaluationResult: OfferEvaluationResultSchema.optional(),
  activeOffer: z
    .object({
      id: z.string().uuid().optional(),
      status: z.string(),
      totalAmount: z.number(),
      currency: z.string(),
      itemsCount: z.number()
    })
    .optional()
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

// ============================================================================
// Offer Management & State Machine Schemas
// ============================================================================
export const OfferStatusEnum = z.enum([
  'DRAFT',
  'ACTIVE',
  'ACCEPTED',
  'SUPERSEDED',
  'EXPIRED',
  'REJECTED'
]);
export type OfferStatus = z.infer<typeof OfferStatusEnum>;

export const CreateOfferItemInputSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  agreedPrice: z.number().positive('Agreed unit price must be positive')
});
export type CreateOfferItemInput = z.infer<typeof CreateOfferItemInputSchema>;

export const CreateOfferInputSchema = z.object({
  conversationId: z.string().uuid().optional(),
  items: z.array(CreateOfferItemInputSchema).min(1, 'At least one item is required in the offer'),
  expirationHours: z.number().int().positive().default(24),
  customerTier: z.string().optional(),
  forceDraft: z.boolean().default(false)
});
export type CreateOfferInput = z.infer<typeof CreateOfferInputSchema>;

export const OfferItemResponseSchema = z.object({
  id: z.string().uuid(),
  offerId: z.string().uuid(),
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  quantity: z.number(),
  unitPrice: z.number(),
  agreedPrice: z.number(),
  subtotal: z.number(),
  productTitle: z.string(),
  productSlug: z.string()
});
export type OfferItemResponse = z.infer<typeof OfferItemResponseSchema>;

export const OfferResponseSchema = z.object({
  id: z.string().uuid(),
  merchantId: z.string().uuid(),
  conversationId: z.string().uuid(),
  offerNumber: z.string(),
  subtotal: z.number(),
  discountAmount: z.number(),
  discountPercent: z.number(),
  taxAmount: z.number(),
  totalAmount: z.number(),
  marginPercent: z.number().optional(),
  policyDecision: PolicyDecisionEnum,
  policyReason: z.string(),
  status: OfferStatusEnum,
  expiresAt: z.date().or(z.string()),
  isExpired: z.boolean(),
  checkoutUrl: z.string(),
  items: z.array(OfferItemResponseSchema),
  merchant: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      slug: z.string(),
      currency: z.string()
    })
    .optional(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string())
});
export type OfferResponse = z.infer<typeof OfferResponseSchema>;

export const AcceptOfferInputSchema = z.object({
  buyerSessionId: z.string().optional()
});
export type AcceptOfferInput = z.infer<typeof AcceptOfferInputSchema>;

export const RejectOfferInputSchema = z.object({
  reason: z.string().default('Customer rejected the offer')
});
export type RejectOfferInput = z.infer<typeof RejectOfferInputSchema>;

export const ListOffersQuerySchema = z.object({
  status: OfferStatusEnum.optional(),
  conversationId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().default(50),
  offset: z.coerce.number().int().nonnegative().default(0)
});
export type ListOffersQuery = z.infer<typeof ListOffersQuerySchema>;

// ============================================================================
// Human-in-the-Loop (HITL) Approval Schemas
// ============================================================================
export const ApprovalStatusEnum = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'TIMED_OUT'
]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusEnum>;

export const CreateApprovalInputSchema = z.object({
  offerId: z.string().uuid('Valid offer UUID is required'),
  requestReason: z.string().min(3, 'Reason must be at least 3 characters long')
});
export type CreateApprovalInput = z.infer<typeof CreateApprovalInputSchema>;

export const ReviewApprovalInputSchema = z.object({
  resolutionNotes: z.string().optional()
});
export type ReviewApprovalInput = z.infer<typeof ReviewApprovalInputSchema>;

export const ApprovalResponseSchema = z.object({
  id: z.string().uuid(),
  merchantId: z.string().uuid(),
  offerId: z.string().uuid(),
  requestedById: z.string().nullable().optional(),
  approvedById: z.string().nullable().optional(),
  status: ApprovalStatusEnum,
  requestReason: z.string(),
  resolutionNotes: z.string().nullable().optional(),
  requestedAt: z.date().or(z.string()),
  resolvedAt: z.date().or(z.string()).nullable().optional(),
  offer: OfferResponseSchema.optional(),
  approvedBy: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string()
    })
    .nullable()
    .optional()
});
export type ApprovalResponse = z.infer<typeof ApprovalResponseSchema>;

export const ListApprovalsQuerySchema = z.object({
  status: ApprovalStatusEnum.optional(),
  limit: z.coerce.number().int().positive().default(50),
  offset: z.coerce.number().int().nonnegative().default(0)
});
export type ListApprovalsQuery = z.infer<typeof ListApprovalsQuerySchema>;

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
  'OFFER_CREATED',
  'OFFER_ACCEPTED',
  'OFFER_REJECTED',
  'OFFER_EXPIRED',
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
