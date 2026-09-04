import type { FastifyPluginAsync } from 'fastify';
import { knowledgeService } from './knowledge.service.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import { prisma } from '@agent-sauda/database';

export const knowledgeRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/merchants/:merchantId/knowledge/documents
   * Ingests an unstructured merchant document (e.g., Return Policy, Warranty, Shipping).
   */
  fastify.post(
    '/merchants/:merchantId/knowledge/documents',
    {
      preHandler: [authenticate, requireRole(['OWNER', 'ADMIN', 'STAFF'])],
      schema: {
        tags: ['Merchant Knowledge Base & RAG'],
        summary: 'Ingest Unstructured Merchant Document',
        description: 'Uploads and chunks merchant policy/knowledge text, computes 768-dim embeddings, and stores in PostgreSQL with pgvector.',
        params: {
          type: 'object',
          required: ['merchantId'],
          properties: {
            merchantId: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          required: ['title', 'content'],
          properties: {
            title: { type: 'string', example: 'Return & Refund Policy 2026' },
            documentType: {
              type: 'string',
              enum: ['RETURN_POLICY', 'WARRANTY', 'SHIPPING', 'FAQ', 'TERMS', 'GENERAL'],
              default: 'GENERAL'
            },
            content: {
              type: 'string',
              example: 'Furniture can be returned within 7 days. Assembled furniture cannot be returned unless there is a manufacturing defect.'
            },
            metadata: { type: 'object' }
          }
        }
      }
    },
    async (request, reply) => {
      const { merchantId } = request.params as { merchantId: string };
      const body = request.body as any;

      try {
        const result = await knowledgeService.ingestDocument(
          merchantId,
          body,
          (request as any).user?.userId
        );
        return reply.status(201).send({
          success: true,
          document: result
        });
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number };
        return reply.status(error.statusCode || 500).send({
          success: false,
          error: {
            code: 'DOCUMENT_INGESTION_FAILED',
            message: error.message
          }
        });
      }
    }
  );

  /**
   * GET /api/merchants/:merchantId/knowledge/documents
   * Lists all uploaded knowledge documents.
   */
  fastify.get(
    '/merchants/:merchantId/knowledge/documents',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Merchant Knowledge Base & RAG'],
        summary: 'List Ingested Merchant Documents',
        params: {
          type: 'object',
          required: ['merchantId'],
          properties: {
            merchantId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request, reply) => {
      const { merchantId } = request.params as { merchantId: string };
      const docs = await knowledgeService.listDocuments(merchantId);
      return reply.status(200).send({
        success: true,
        documents: docs
      });
    }
  );

  /**
   * POST /api/merchants/:merchantId/knowledge/search
   * Performs vector similarity search over merchant knowledge.
   */
  fastify.post(
    '/merchants/:merchantId/knowledge/search',
    {
      schema: {
        tags: ['Merchant Knowledge Base & RAG'],
        summary: 'Vector Similarity Search (pgvector)',
        description: 'Performs cosine similarity search against merchant document chunks. Strictly scoped to merchantId.',
        params: {
          type: 'object',
          required: ['merchantId'],
          properties: {
            merchantId: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          required: ['query'],
          properties: {
            query: { type: 'string', example: 'Can I return the chair after assembling it?' },
            topK: { type: 'number', default: 3 }
          }
        }
      }
    },
    async (request, reply) => {
      const { merchantId } = request.params as { merchantId: string };
      const { query, topK } = request.body as { query: string; topK?: number };

      const chunks = await knowledgeService.searchKnowledge(merchantId, query, topK || 3);
      return reply.status(200).send({
        success: true,
        query,
        chunksCount: chunks.length,
        chunks
      });
    }
  );

  /**
   * POST /api/knowledge/search
   * Public vector search supporting merchantId or merchantSlug.
   */
  fastify.post(
    '/knowledge/search',
    {
      schema: {
        tags: ['Merchant Knowledge Base & RAG'],
        summary: 'Public Knowledge Search by Slug or ID',
        body: {
          type: 'object',
          required: ['query'],
          properties: {
            merchantId: { type: 'string', format: 'uuid' },
            merchantSlug: { type: 'string', example: 'abc-furniture' },
            query: { type: 'string', example: 'What is your warranty period?' },
            topK: { type: 'number', default: 3 }
          }
        }
      }
    },
    async (request, reply) => {
      const body = request.body as {
        merchantId?: string;
        merchantSlug?: string;
        query: string;
        topK?: number;
      };

      let targetMerchantId = body.merchantId;
      if (!targetMerchantId && body.merchantSlug) {
        const merchant = await prisma.merchant.findUnique({
          where: { slug: body.merchantSlug }
        });
        if (merchant) targetMerchantId = merchant.id;
      }

      if (!targetMerchantId) {
        const defaultMerchant = await prisma.merchant.findFirst();
        if (defaultMerchant) targetMerchantId = defaultMerchant.id;
      }

      if (!targetMerchantId) {
        return reply.status(404).send({
          success: false,
          error: { code: 'MERCHANT_NOT_FOUND', message: 'No merchant found.' }
        });
      }

      const chunks = await knowledgeService.searchKnowledge(targetMerchantId, body.query, body.topK || 3);
      return reply.status(200).send({
        success: true,
        merchantId: targetMerchantId,
        query: body.query,
        chunksCount: chunks.length,
        chunks
      });
    }
  );
};
