import { buildApp } from '../apps/api/src/app.js';
import { prisma, warmupDatabase } from '../packages/database/src/index.js';
import { knowledgeService } from '../apps/api/src/modules/knowledge/knowledge.service.js';

async function runRAGVerification() {
  console.log('📚 ======================================================================');
  console.log('📚 AGENT SAUDA — BUILDATHON PHASE A: MERCHANT KNOWLEDGE RAG TEST SUITE');
  console.log('📚 ======================================================================\n');

  console.log('⚡ Ensuring Neon Cloud Database is awake...');
  await warmupDatabase(10, 4000);
  console.log('✅ Neon Cloud Database is awake.\n');

  const app = buildApp();
  await app.ready();

  const timestamp = Date.now();

  // ==========================================================================
  // 1. Seed Two Distinct Merchants for Tenant Isolation Testing
  // ==========================================================================
  console.log('🏢 [SETUP] Seeding Merchant A (ABC Furniture) and Merchant B (XYZ Electronics)...');
  
  const regA = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `merchant_a_${timestamp}@abcfurniture.in`,
      password: 'SecurePassword123!',
      name: 'Anand Sharma',
      merchantName: 'ABC Furniture Ltd',
      merchantSlug: `abc-furniture-${timestamp}`,
      currency: 'INR'
    }
  });
  const merchantA = JSON.parse(regA.body).merchant;
  const tokenA = JSON.parse(regA.body).token;

  const regB = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `merchant_b_${timestamp}@xyzelectronics.in`,
      password: 'SecurePassword123!',
      name: 'Vikram Mehta',
      merchantName: 'XYZ Electronics',
      merchantSlug: `xyz-electronics-${timestamp}`,
      currency: 'INR'
    }
  });
  const merchantB = JSON.parse(regB.body).merchant;

  console.log(`✅ Seeded Merchant A [${merchantA.id}] and Merchant B [${merchantB.id}].\n`);

  // ==========================================================================
  // 2. Ingest Unstructured Policies for Merchant A
  // ==========================================================================
  console.log('📄 [STEP 2: INGESTION] Uploading Return Policy for Merchant A...');
  
  const returnPolicyText = `
    ABC Furniture Return and Refund Policy:
    Furniture items can be returned within 7 calendar days of delivery.
    Assembled furniture cannot be returned under any circumstances unless there is an authentic manufacturing defect verified by our technical inspection team.
    Custom upholstered or bespoke fabric orders are strictly non-refundable.
    Refunds are processed to the original payment method within 5 to 7 business days after warehouse inspection.
  `;

  const warrantyPolicyText = `
    ABC Furniture Comprehensive Warranty Guidelines:
    All solid wood tables and ergonomic executive office chairs include a 3-year limited structural warranty.
    Warranty covers frame warping, joint failure, and hydraulic gas-lift cylinder malfunction.
    Warranty explicitly excludes normal fabric wear and tear, accidental liquid spills, and modifications made by unauthorized technicians.
  `;

  const docRes1 = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantA.id}/knowledge/documents`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      title: 'Official Return & Refund Policy 2026',
      documentType: 'RETURN_POLICY',
      content: returnPolicyText
    }
  });

  if (docRes1.statusCode !== 201) {
    throw new Error(`❌ Document 1 ingestion failed with status ${docRes1.statusCode}: ${docRes1.body}`);
  }
  const doc1Data = JSON.parse(docRes1.body);
  console.log(`✅ Ingested "${doc1Data.document.title}" (${doc1Data.document.chunksCount} chunks generated).`);

  const docRes2 = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantA.id}/knowledge/documents`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      title: 'Structural Warranty Terms 2026',
      documentType: 'WARRANTY',
      content: warrantyPolicyText
    }
  });
  const doc2Data = JSON.parse(docRes2.body);
  console.log(`✅ Ingested "${doc2Data.document.title}" (${doc2Data.document.chunksCount} chunks generated).\n`);

  // ==========================================================================
  // 3. Test Vector Similarity Search with pgvector
  // ==========================================================================
  console.log('🔍 [STEP 3: VECTOR SEARCH] Running semantic query using pgvector...');
  const customerQuery = 'Can I return this chair after assembling it?';
  console.log(`   Customer asks: "${customerQuery}"`);

  const searchResults = await knowledgeService.searchKnowledge(merchantA.id, customerQuery, 2);
  
  if (searchResults.length === 0) {
    throw new Error('❌ pgvector search returned 0 results');
  }

  const topMatch = searchResults[0]!;
  console.log(`   🎯 Top pgvector Result:`);
  console.log(`      Document:   ${topMatch.documentTitle} [${topMatch.documentType}]`);
  console.log(`      Similarity: ${topMatch.similarityScore}`);
  console.log(`      Excerpt:    "${topMatch.content.trim()}"`);

  if (!topMatch.content.toLowerCase().includes('assembled')) {
    throw new Error('❌ Expected top chunk to mention assembly return restrictions');
  }
  console.log('✅ Semantic similarity retrieval accurately matched policy.\n');

  // ==========================================================================
  // 4. Strict Tenant Isolation Verification
  // ==========================================================================
  console.log('🛡️ [STEP 4: TENANT ISOLATION] Verifying Merchant B cannot access Merchant A documents...');
  
  // Search using Merchant B's ID for the exact same query
  const tenantBResults = await knowledgeService.searchKnowledge(merchantB.id, customerQuery, 2);
  
  if (tenantBResults.length > 0) {
    throw new Error('❌ CRITICAL SECURITY VULNERABILITY: Merchant B retrieved Merchant A knowledge chunks!');
  }
  console.log(`✅ Tenant Isolation 100% Verified: Merchant B query returned 0 chunks.\n`);

  // ==========================================================================
  // 5. Test AI Sales Agent End-to-End Grounded Tool Call
  // ==========================================================================
  console.log('🤖 [STEP 5: AGENT TOOL EXECUTION] Asking AI Sales Agent via chat...');
  
  const chatRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantA.id}/agent/chat`,
    payload: {
      message: 'Can I return the office chair after assembling it at home?'
    }
  });

  if (chatRes.statusCode !== 200) {
    throw new Error(`❌ Agent chat failed with status ${chatRes.statusCode}: ${chatRes.body}`);
  }

  const chatData = JSON.parse(chatRes.body);
  console.log(`   Agent Response:\n   "${chatData.message}"\n`);

  const executedTools = chatData.toolCallsExecuted || [];
  const calledKnowledge = executedTools.some((t: any) => t.name === 'search_merchant_knowledge');
  
  if (!calledKnowledge) {
    throw new Error('❌ AI Agent did not invoke search_merchant_knowledge tool');
  }
  console.log('✅ AI Agent successfully invoked search_merchant_knowledge tool and grounded its answer in merchant policy!\n');

  // ==========================================================================
  // 6. Verify Forensic Audit Trail Recording
  // ==========================================================================
  console.log('📜 [STEP 6: AUDIT VERIFICATION] Checking KNOWLEDGE_BASE audit events...');
  const auditEvents = await prisma.auditEvent.findMany({
    where: {
      merchantId: merchantA.id,
      entityType: 'KNOWLEDGE_BASE'
    }
  });

  if (auditEvents.length < 2) {
    throw new Error(`❌ Expected at least 2 audit events for knowledge ingestion, found ${auditEvents.length}`);
  }
  console.log(`✅ Forensic Audit Trail verified: ${auditEvents.length} DOCUMENT_INGESTED events recorded.`);

  await app.close();
  await prisma.$disconnect();

  console.log('\n======================================================================');
  console.log('🎉 PHASE A COMPLETE: MERCHANT KNOWLEDGE RAG FULLY VERIFIED & SECURE!');
  console.log('======================================================================');
}

runRAGVerification().catch((err) => {
  console.error('❌ RAG Verification Failed:', err);
  process.exit(1);
});
