import type { FastifyRequest, FastifyReply } from 'fastify';
import type { MerchantRole, AuthTokenPayload } from '@agent-sauda/domain';

// Extend Fastify types to include custom user payload
declare module 'fastify' {
  interface FastifyRequest {
    user: AuthTokenPayload;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthTokenPayload;
    user: AuthTokenPayload;
  }
}

/**
 * Hook to authenticate request via JWT Bearer token.
 * Rejects with 401 if token is missing, invalid, or expired.
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token is missing, invalid, or expired.',
        statusCode: 401,
        requestId: request.id
      }
    });
  }
}

/**
 * Factory hook to enforce Role-Based Access Control (RBAC).
 * Rejects with 403 if the user's role is not in the allowed list.
 */
export function requireRole(allowedRoles: MerchantRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user || !allowedRoles.includes(request.user.role)) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Action requires one of the following roles: ${allowedRoles.join(', ')}. Current role: ${request.user?.role || 'NONE'}`,
          statusCode: 403,
          requestId: request.id
        }
      });
    }
  };
}

/**
 * Hook to enforce strict Tenant Isolation.
 * Validates that the requested merchantId parameter matches the authenticated user's active merchant.
 */
export function requireMerchantAccess(paramKey: string = 'merchantId') {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const requestedMerchantId = (request.params as Record<string, string>)?.[paramKey];

    if (!requestedMerchantId) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: `Missing ${paramKey} in request route parameters.`,
          statusCode: 400,
          requestId: request.id
        }
      });
    }

    if (requestedMerchantId !== request.user.merchantId) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'CROSS_TENANT_FORBIDDEN',
          message: 'Access denied: You do not have permission to access another merchant organization.',
          statusCode: 403,
          requestId: request.id
        }
      });
    }
  };
}
