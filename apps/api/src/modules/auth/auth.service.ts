import bcrypt from 'bcrypt';
import { prisma, type MerchantRole } from '@agent-sauda/database';
import type { RegisterInput, LoginInput } from './auth.schema.js';

export class AuthService {
  private static readonly SALT_ROUNDS = 10;

  /**
   * Registers a new User, creates their Merchant organization,
   * assigns the OWNER role, and creates their default Policy in a single ACID transaction.
   */
  async register(input: RegisterInput) {
    // 1. Check for existing user email
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() }
    });
    if (existingUser) {
      const error = new Error('An account with this email address already exists.') as Error & { statusCode?: number; code?: string };
      error.statusCode = 409;
      error.code = 'EMAIL_ALREADY_EXISTS';
      throw error;
    }

    // 2. Check for existing merchant slug
    const existingMerchant = await prisma.merchant.findUnique({
      where: { slug: input.merchantSlug.toLowerCase() }
    });
    if (existingMerchant) {
      const error = new Error('A merchant with this slug identifier already exists.') as Error & { statusCode?: number; code?: string };
      error.statusCode = 409;
      error.code = 'SLUG_ALREADY_EXISTS';
      throw error;
    }

    // 3. Hash password securely with bcrypt
    const passwordHash = await bcrypt.hash(input.password, AuthService.SALT_ROUNDS);

    // 4. Execute atomic creation inside a Prisma transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email.toLowerCase(),
          name: input.name,
          passwordHash
        }
      });

      const merchant = await tx.merchant.create({
        data: {
          name: input.merchantName,
          slug: input.merchantSlug.toLowerCase(),
          currency: input.currency || 'INR'
        }
      });

      const membership = await tx.merchantMember.create({
        data: {
          userId: user.id,
          merchantId: merchant.id,
          role: 'OWNER'
        }
      });

      const policy = await tx.policy.create({
        data: {
          merchantId: merchant.id,
          maxDiscountPercent: 8.0,
          minimumMarginPercent: 18.0,
          autonomousOrderLimit: 100000.0,
          approvalThreshold: 100000.0,
          maxQuantityPerOrder: 50,
          rules: {
            allowedPaymentMethods: ['RAZORPAY_TEST'],
            standardShippingCost: 0,
            freeShippingThreshold: 50000
          },
          isActive: true
        }
      });

      await tx.auditEvent.create({
        data: {
          merchantId: merchant.id,
          entityType: 'MERCHANT',
          entityId: merchant.id,
          action: 'MERCHANT_REGISTERED',
          actorType: 'USER',
          actorId: user.id,
          reason: `Merchant ${merchant.name} registered by ${user.name}`,
          metadata: {
            policyId: policy.id,
            ownerEmail: user.email
          }
        }
      });

      return { user, merchant, role: membership.role as MerchantRole };
    });

    return result;
  }

  /**
   * Authenticates user credentials and resolves their active merchant organization.
   */
  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: {
        memberships: {
          include: { merchant: true }
        }
      }
    });

    if (!user) {
      const error = new Error('Invalid email or password.') as Error & { statusCode?: number; code?: string };
      error.statusCode = 401;
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      const error = new Error('Invalid email or password.') as Error & { statusCode?: number; code?: string };
      error.statusCode = 401;
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    if (user.memberships.length === 0) {
      const error = new Error('User is not associated with any merchant organization.') as Error & { statusCode?: number; code?: string };
      error.statusCode = 403;
      error.code = 'NO_MERCHANT_MEMBERSHIP';
      throw error;
    }

    // Default to the first active merchant membership
    const activeMembership = user.memberships[0]!;

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      merchant: {
        id: activeMembership.merchant.id,
        name: activeMembership.merchant.name,
        slug: activeMembership.merchant.slug,
        currency: activeMembership.merchant.currency,
        role: activeMembership.role as MerchantRole
      }
    };
  }

  /**
   * Retrieves full profile and all merchant memberships for an authenticated user.
   */
  async getUserProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        memberships: {
          select: {
            role: true,
            createdAt: true,
            merchant: {
              select: {
                id: true,
                name: true,
                slug: true,
                currency: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      const error = new Error('User not found.') as Error & { statusCode?: number; code?: string };
      error.statusCode = 404;
      error.code = 'USER_NOT_FOUND';
      throw error;
    }

    return user;
  }
}

export const authService = new AuthService();
