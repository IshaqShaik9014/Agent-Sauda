import type { FastifyPluginAsync } from 'fastify';
import { RegisterInputSchema, LoginInputSchema } from './auth.schema.js';
import { authService } from './auth.service.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import type { AuthTokenPayload } from '@agent-sauda/domain';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/auth/register
   * Registers a new merchant organization and its owner account.
   */
  fastify.post('/register', async (request, reply) => {
    const parseResult = RegisterInputSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid registration input parameters.',
          details: parseResult.error.format(),
          statusCode: 400,
          requestId: request.id
        }
      });
    }

    try {
      const { user, merchant, role } = await authService.register(parseResult.data);

      const tokenPayload: AuthTokenPayload = {
        userId: user.id,
        email: user.email,
        name: user.name,
        merchantId: merchant.id,
        merchantSlug: merchant.slug,
        role
      };

      const token = fastify.jwt.sign(tokenPayload, { expiresIn: '7d' });

      return reply.status(201).send({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        merchant: {
          id: merchant.id,
          name: merchant.name,
          slug: merchant.slug,
          currency: merchant.currency,
          role
        }
      });
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number; code?: string };
      const statusCode = error.statusCode || 500;
      return reply.status(statusCode).send({
        success: false,
        error: {
          code: error.code || 'REGISTRATION_FAILED',
          message: error.message,
          statusCode,
          requestId: request.id
        }
      });
    }
  });

  /**
   * POST /api/auth/login
   * Authenticates credentials and issues signed JWT session token.
   */
  fastify.post('/login', async (request, reply) => {
    const parseResult = LoginInputSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid login credentials format.',
          details: parseResult.error.format(),
          statusCode: 400,
          requestId: request.id
        }
      });
    }

    try {
      const { user, merchant } = await authService.login(parseResult.data);

      const tokenPayload: AuthTokenPayload = {
        userId: user.id,
        email: user.email,
        name: user.name,
        merchantId: merchant.id,
        merchantSlug: merchant.slug,
        role: merchant.role
      };

      const token = fastify.jwt.sign(tokenPayload, { expiresIn: '7d' });

      return reply.status(200).send({
        success: true,
        token,
        user,
        merchant
      });
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number; code?: string };
      const statusCode = error.statusCode || 500;
      return reply.status(statusCode).send({
        success: false,
        error: {
          code: error.code || 'LOGIN_FAILED',
          message: error.message,
          statusCode,
          requestId: request.id
        }
      });
    }
  });

  /**
   * GET /api/auth/me
   * Retrieves active session details and all merchant memberships.
   */
  fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const profile = await authService.getUserProfile(request.user.userId);
    return reply.status(200).send({
      success: true,
      session: request.user,
      profile
    });
  });

  /**
   * POST /api/auth/logout
   * Client-side session invalidation endpoint.
   */
  fastify.post('/logout', { preHandler: [authenticate] }, async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      message: 'Logged out successfully.'
    });
  });
};
