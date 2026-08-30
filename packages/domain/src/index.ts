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
// Policy Decision Enums
// ============================================================================
export const PolicyDecisionEnum = z.enum([
  'ALLOW',
  'COUNTER',
  'APPROVAL_REQUIRED',
  'REJECT'
]);
export type PolicyDecision = z.infer<typeof PolicyDecisionEnum>;

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
