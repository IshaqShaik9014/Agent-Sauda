import { prisma } from '@agent-sauda/database';
import { embeddingService } from './embedding.service.js';

export interface IngestDocumentInput {
  title: string;
  documentType?: string; // RETURN_POLICY, WARRANTY, SHIPPING, FAQ, TERMS
  content: string;
  metadata?: Record<string, unknown>;
}

export interface SearchKnowledgeResult {
  id: string;
  documentId: string;
  documentTitle: string;
  documentType: string;
  chunkIndex: number;
  content: string;
  similarityScore: number;
  metadata?: Record<string, unknown>;
}

export class KnowledgeService {
  /**
   * Splits text into overlapping semantic chunks for retrieval.
   */
  private chunkText(text: string, maxWords = 80, overlap = 15): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) {
      return [text.trim()];
    }

    const chunks: string[] = [];
    let start = 0;
    while (start < words.length) {
      const end = Math.min(start + maxWords, words.length);
      const chunk = words.slice(start, end).join(' ');
      chunks.push(chunk);
      if (end >= words.length) break;
      start += maxWords - overlap;
    }

    return chunks;
  }

  /**
   * Ingests a merchant unstructured document, generates chunk embeddings,
   * and persists them to PostgreSQL with pgvector.
   */
  async ingestDocument(
    merchantId: string,
    input: IngestDocumentInput,
    actorId?: string
  ): Promise<{
    documentId: string;
    title: string;
    documentType: string;
    chunksCount: number;
  }> {
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId }
    });

    if (!merchant) {
      const err = new Error(`Merchant ${merchantId} not found.`) as Error & { statusCode?: number };
      err.statusCode = 404;
      throw err;
    }

    const rawChunks = this.chunkText(input.content);

    // 1. Create Document Header
    const doc = await prisma.merchantDocument.create({
      data: {
        merchantId,
        title: input.title,
        documentType: input.documentType || 'GENERAL',
        rawContent: input.content,
        metadata: input.metadata ? (input.metadata as any) : undefined
      }
    });

    // 2. Generate embeddings & insert chunks
    for (let i = 0; i < rawChunks.length; i++) {
      const chunkContent = rawChunks[i]!;
      const embedding = await embeddingService.generateEmbedding(chunkContent);
      const vectorStr = `[${embedding.join(',')}]`;

      const chunk = await prisma.merchantDocumentChunk.create({
        data: {
          merchantId,
          documentId: doc.id,
          chunkIndex: i,
          content: chunkContent,
          metadata: {
            wordCount: chunkContent.split(/\s+/).length
          }
        }
      });

      // Update the vector column using raw SQL
      await prisma.$executeRawUnsafe(
        `UPDATE "merchant_document_chunks" SET "embedding" = $1::vector WHERE id = $2`,
        vectorStr,
        chunk.id
      );
    }

    // 3. Record Audit Event
    await prisma.auditEvent.create({
      data: {
        merchantId,
        entityType: 'KNOWLEDGE_BASE',
        entityId: doc.id,
        action: 'DOCUMENT_INGESTED',
        actorType: actorId ? 'USER' : 'SYSTEM',
        actorId: actorId || 'knowledge-engine',
        reason: `Ingested document "${doc.title}" (${doc.documentType}) with ${rawChunks.length} chunks`,
        metadata: {
          documentId: doc.id,
          title: doc.title,
          documentType: doc.documentType,
          chunksCount: rawChunks.length
        }
      }
    });

    return {
      documentId: doc.id,
      title: doc.title,
      documentType: doc.documentType,
      chunksCount: rawChunks.length
    };
  }

  /**
   * Performs tenant-isolated vector similarity search using pgvector.
   * Guarantees Merchant A can NEVER retrieve Merchant B's documents.
   */
  async searchKnowledge(
    merchantId: string,
    query: string,
    topK = 3
  ): Promise<SearchKnowledgeResult[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const queryEmbedding = await embeddingService.generateEmbedding(query);
    const vectorStr = `[${queryEmbedding.join(',')}]`;

    const results = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT 
        c.id,
        c."documentId",
        c."chunkIndex",
        c.content,
        c.metadata,
        d.title AS "documentTitle",
        d."documentType",
        ROUND((1 - (c.embedding <=> $1::vector))::numeric, 4) AS "similarityScore"
      FROM "merchant_document_chunks" c
      JOIN "merchant_documents" d ON d.id = c."documentId"
      WHERE c."merchantId" = $2
      ORDER BY c.embedding <=> $1::vector ASC
      LIMIT $3;
      `,
      vectorStr,
      merchantId,
      topK
    );

    return results.map((r) => ({
      id: r.id,
      documentId: r.documentId,
      documentTitle: r.documentTitle,
      documentType: r.documentType,
      chunkIndex: Number(r.chunkIndex),
      content: r.content,
      similarityScore: parseFloat(r.similarityScore),
      metadata: r.metadata
    }));
  }

  /**
   * Lists all knowledge documents for a merchant.
   */
  async listDocuments(merchantId: string) {
    return prisma.merchantDocument.findMany({
      where: { merchantId },
      include: {
        _count: {
          select: { chunks: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}

export const knowledgeService = new KnowledgeService();
