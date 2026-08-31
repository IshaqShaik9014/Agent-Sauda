import fastify, { type FastifyInstance, type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { randomUUID } from 'node:crypto';
import { env } from './config/env.js';
import { loggerConfig } from './infrastructure/logger/index.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { catalogRoutes } from './modules/catalog/catalog.routes.js';
import { policyRoutes } from './modules/policy/policy.routes.js';
import { agentRoutes } from './modules/agent/agent.routes.js';
import { offerRoutes } from './modules/offer/offer.routes.js';
import { approvalRoutes } from './modules/approval/approval.routes.js';
import { orderRoutes } from './modules/order/order.routes.js';
import { paymentRoutes } from './modules/payment/payment.routes.js';
import { webhookRoutes } from './modules/webhook/webhook.routes.js';
import { auditRoutes } from './modules/audit/audit.routes.js';

export function buildApp(): FastifyInstance {
  const app = fastify({
    logger: loggerConfig,
    genReqId: (req) => (req.headers['x-request-id'] as string) || randomUUID(),
    ajv: {
      customOptions: {
        strict: false
      }
    }
  });

  // Enable CORS
  app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  });

  // Register JWT Plugin
  app.register(fastifyJwt, {
    secret: env.JWT_SECRET
  });

  // Register OpenAPI / Swagger Documentation Generator
  app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Agent Sauda API Documentation',
        description:
          'Interactive API specification for Agent Sauda — "AI agents negotiate. Merchants stay in control."\n\n' +
          '**Architecture Principles**:\n' +
          '1. AI proposes money actions, but deterministic backend logic authorizes them.\n' +
          '2. Multi-tenancy is strictly enforced across all merchant-scoped entities.\n' +
          '3. Order states are strictly decoupled from raw Razorpay payment transitions.',
        version: '0.1.0'
      },
      servers: [
        {
          url: `http://localhost:${env.PORT}`,
          description: 'Local Development Server'
        }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Provide your JWT session token obtained from /api/auth/login or /api/auth/register'
          }
        }
      }
    }
  });

  // Register Interactive Swagger UI at /docs
  app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true
    },
    staticCSP: true,
    transformStaticCSP: (header) => header
  });

  // Global Error Handler
  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({
      err: error,
      reqId: request.id,
      url: request.url,
      method: request.method
    }, 'Unhandled exception during request');

    const statusCode = error.statusCode || 500;
    const isProd = env.NODE_ENV === 'production';

    return reply.status(statusCode).send({
      success: false,
      error: {
        code: error.code || 'INTERNAL_SERVER_ERROR',
        message: isProd && statusCode === 500 ? 'An unexpected error occurred' : error.message,
        statusCode,
        requestId: request.id
      }
    });
  });

  // 404 Handler
  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
        statusCode: 404,
        requestId: request.id
      }
    });
  });

  // Register Routes
  app.register(healthRoutes);
  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(catalogRoutes, { prefix: '/api' });
  app.register(policyRoutes, { prefix: '/api' });
  app.register(agentRoutes, { prefix: '/api' });
  app.register(offerRoutes, { prefix: '/api' });
  app.register(approvalRoutes, { prefix: '/api' });
  app.register(orderRoutes, { prefix: '/api' });
  app.register(paymentRoutes, { prefix: '/api' });
  app.register(webhookRoutes, { prefix: '/api' });
  app.register(auditRoutes, { prefix: '/api' });

  return app;
}
