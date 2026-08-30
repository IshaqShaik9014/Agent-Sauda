import type { FastifyPluginAsync } from 'fastify';
import type { HealthResponse } from '@agent-sauda/domain';
import { env } from '../../config/env.js';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/health',
    {
      schema: {
        tags: ['System'],
        summary: 'API Health Check',
        description: 'Returns the operational health and environment metadata of the Agent Sauda API.',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              service: { type: 'string' },
              version: { type: 'string' },
              timestamp: { type: 'string' },
              environment: { type: 'string' }
            }
          }
        }
      }
    },
    async (_request, reply) => {
      const response: HealthResponse = {
        status: 'ok',
        service: 'agent-sauda-api',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV
      };
      return reply.status(200).send(response);
    }
  );
};
