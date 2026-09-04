import { prisma } from '../packages/database/src/index.js';

async function main() {
  console.log('⚡ Ensuring pgvector extension and embedding column...');
  try {
    // 1. Ensure pgvector extension
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('✅ Extension "vector" is verified.');

    // 2. Add embedding column to merchant_document_chunks
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "merchant_document_chunks" 
      ADD COLUMN IF NOT EXISTS "embedding" vector(768);
    `);
    console.log('✅ Column "embedding vector(768)" added to "merchant_document_chunks".');

    // 3. Create HNSW index for ultra-fast cosine similarity search
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_merchant_document_chunks_embedding" 
      ON "merchant_document_chunks" 
      USING hnsw ("embedding" vector_cosine_ops);
    `);
    console.log('✅ HNSW index "idx_merchant_document_chunks_embedding" verified.');

    // 4. Test column presence
    const columns = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'merchant_document_chunks' AND column_name = 'embedding';
    `);
    console.log('📊 Verified column info:', columns);
  } catch (err) {
    console.error('❌ Error configuring pgvector column:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
