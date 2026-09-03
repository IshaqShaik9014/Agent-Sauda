import type { FastifyPluginAsync } from 'fastify';
import { RegisterInputSchema, LoginInputSchema } from './auth.schema.js';
import { authService } from './auth.service.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import type { AuthTokenPayload } from '@agent-sauda/domain';

const ErrorResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        statusCode: { type: 'number' },
        requestId: { type: 'string' }
      }
    }
  }
};

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/auth/register
   * Registers a new merchant organization and its owner account.
   */
  fastify.post(
    '/register',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute'
        }
      },
      schema: {
        tags: ['Authentication & Tenancy'],
        summary: 'Register New Merchant Organization & Owner Account',
        description: 'Atomically creates a new user, merchant organization, OWNER membership, and default policy in an ACID transaction.',
        body: {
          type: 'object',
          required: ['email', 'password', 'name', 'merchantName', 'merchantSlug'],
          properties: {
            email: { type: 'string', format: 'email', example: 'owner@apexspaces.com' },
            password: { type: 'string', minLength: 8, example: 'SecurePassword123!' },
            name: { type: 'string', example: 'Sarah Connor' },
            merchantName: { type: 'string', example: 'Apex Modern Workspaces' },
            merchantSlug: { type: 'string', example: 'apex-workspaces' },
            currency: { type: 'string', default: 'INR', example: 'INR' }
          }
        },
        response: {
          201: {
            description: 'Merchant registered successfully. Returns JWT session token.',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              token: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' }
                }
              },
              merchant: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  currency: { type: 'string' },
                  role: { type: 'string' }
                }
              }
            }
          },
          400: ErrorResponseSchema,
          409: ErrorResponseSchema,
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
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
        const statusCode = (error.statusCode === 409 ? 409 : 500) as 409 | 500;
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
    }
  );

  /**
   * POST /api/auth/login
   * Authenticates credentials and issues signed JWT session token.
   */
  fastify.post(
    '/login',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute'
        }
      },
      schema: {
        tags: ['Authentication & Tenancy'],
        summary: 'Merchant User Login',
        description: 'Authenticates credentials using bcrypt password hashing and issues a cryptographically signed JWT token.',
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'owner@agentsauda.com' },
            password: { type: 'string', example: 'DemoPassword123!' }
          }
        },
        response: {
          200: {
            description: 'Authentication successful. Returns JWT token and active merchant scope.',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              token: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' }
                }
              },
              merchant: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  currency: { type: 'string' },
                  role: { type: 'string' }
                }
              }
            }
          },
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
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
        const statusCode = (error.statusCode === 401 || error.statusCode === 403 ? error.statusCode : 500) as 401 | 403 | 500;
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
    }
  );

  /**
   * GET /api/auth/me
   * Retrieves active session details and all merchant memberships.
   */
  fastify.get(
    '/me',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Authentication & Tenancy'],
        summary: 'Get Current Authenticated User & Merchant Memberships',
        description: 'Returns the active user profile, decoded JWT token claims, and all associated merchant organizations.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            description: 'Session and profile data',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              session: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  merchantId: { type: 'string' },
                  merchantSlug: { type: 'string' },
                  role: { type: 'string' }
                }
              },
              profile: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  createdAt: { type: 'string' },
                  memberships: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        role: { type: 'string' },
                        createdAt: { type: 'string' },
                        merchant: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            name: { type: 'string' },
                            slug: { type: 'string' },
                            currency: { type: 'string' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const profile = await authService.getUserProfile(request.user.userId);
      return reply.status(200).send({
        success: true,
        session: request.user,
        profile
      });
    }
  );

  /**
   * POST /api/auth/logout
   * Client-side session invalidation endpoint.
   */
  fastify.post(
    '/logout',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Authentication & Tenancy'],
        summary: 'Logout Current Session',
        description: 'Invalidates active session on the client.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    async (_request, reply) => {
      return reply.status(200).send({
        success: true,
        message: 'Logged out successfully.'
      });
    }
  );
};
