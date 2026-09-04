import { buildApp } from '../apps/api/src/app.js';
import { prisma, warmupDatabase } from '../packages/database/src/index.js';
import { AgentSauda } from '../packages/domain/src/sdk.js';

/**
 * DEVELOPER INTEGRATION DEMONSTRATION:
 * "MyStore AI Assistant" (Existing Chatbot at ABC Furniture)
 * integrating Agent Sauda SDK for autonomous commerce.
 */
async function runExistingAssistantDemo() {
  console.log('🤖 ======================================================================');
  console.log('🤖 AGENT SAUDA — B2B DEVELOPER SDK INTEGRATION DEMO');
  console.log('🤖 Showcase: "MyStore AI Assistant" delegating commerce to Agent Sauda');
  console.log('🤖 ======================================================================\n');

  console.log('⚡ Ensuring Neon Cloud Database is awake...');
  await warmupDatabase(8, 3000);

  // 1. Start backend Fastify gateway on a temporary port or ready instance
  const app = buildApp();
  await app.listen({ port: 4099, host: '127.0.0.1' });
  console.log('🌐 Agent Sauda Gateway listening on http://127.0.0.1:4099\n');

  try {
    // 2. Lookup ABC Furniture demo merchant
    let merchant = await prisma.merchant.findFirst({
      where: { slug: { startsWith: 'abc-furniture' } },
      include: { products: true }
    });

    if (!merchant) {
      // Fallback to any existing merchant
      merchant = await prisma.merchant.findFirst({
        include: { products: true }
      });
    }

    if (!merchant) {
      throw new Error('No merchant found in database. Please run npm run db:seed first.');
    }

    console.log(`🏢 [STORE CONTEXT] Integrating Business: "${merchant.name}" (ID: ${merchant.id})`);
    console.log(`📦 Catalog Products: ${merchant.products.map((p) => p.title).join(', ')}\n`);

    // ==========================================================================
    // 3. INITIALIZE AGENT SAUDA SDK (Third-party developer code)
    // ==========================================================================
    console.log('📦 [SDK INITIALIZATION] Third-party developer initializes Agent Sauda SDK:');
    console.log(`
      import { AgentSauda } from '@agent-sauda/sdk';

      const sauda = new AgentSauda({
        merchantId: "${merchant.id}",
        baseUrl: "http://127.0.0.1:4099"
      });
    `);

    const sauda = new AgentSauda({
      merchantId: merchant.id,
      baseUrl: 'http://127.0.0.1:4099'
    });

    const conversationId = `mystore_session_${Date.now()}`;

    // ==========================================================================
    // TURN 1: Customer asks an unstructured policy question (RAG)
    // ==========================================================================
    console.log('----------------------------------------------------------------------');
    console.log('💬 [TURN 1: POLICY / FAQ QUESTION]');
    const q1 = 'Can I return an ergonomic office chair after assembling it?';
    console.log(`👤 Customer to MyStore AI: "${q1}"`);
    console.log('⚡ MyStore AI Assistant delegates to sauda.commerce.process()...');

    const res1 = await sauda.commerce.process({
      conversationId,
      message: q1,
      customerName: 'Rahul Verma'
    });

    console.log(`🤖 Agent Sauda Response (Action: ${res1.actionType}):`);
    console.log(`   "${res1.reply}"`);
    console.log(`   🛠️ Tools Executed: [${res1.toolsExecuted.join(', ')}]\n`);

    // ==========================================================================
    // TURN 2: Customer asks for product discovery and pricing
    // ==========================================================================
    console.log('----------------------------------------------------------------------');
    console.log('💬 [TURN 2: PRODUCT DISCOVERY & STOCK]');
    const q2 = 'What chairs do you have available under ₹30,000?';
    console.log(`👤 Customer to MyStore AI: "${q2}"`);
    console.log('⚡ MyStore AI Assistant delegates to sauda.commerce.process()...');

    const res2 = await sauda.commerce.process({
      conversationId,
      message: q2,
      customerName: 'Rahul Verma'
    });

    console.log(`🤖 Agent Sauda Response (Action: ${res2.actionType}):`);
    console.log(`   "${res2.reply}"`);
    console.log(`   🛠️ Tools Executed: [${res2.toolsExecuted.join(', ')}]\n`);

    // ==========================================================================
    // TURN 3: Customer bargains / negotiates a volume deal
    // ==========================================================================
    console.log('----------------------------------------------------------------------');
    console.log('💬 [TURN 3: REAL-TIME NEGOTIATION]');
    const q3 = 'Can you do 2 chairs for ₹19,000 each?';
    console.log(`👤 Customer to MyStore AI: "${q3}"`);
    console.log('⚡ MyStore AI Assistant delegates to sauda.commerce.process()...');

    const res3 = await sauda.commerce.process({
      conversationId,
      message: q3,
      customerName: 'Rahul Verma'
    });

    console.log(`🤖 Agent Sauda Response (Action: ${res3.actionType}):`);
    console.log(`   "${res3.reply}"`);
    console.log(`   🛠️ Tools Executed: [${res3.toolsExecuted.join(', ')}]`);
    if (res3.evaluationResult) {
      console.log(`   ⚖️ Policy Engine Evaluation:`, JSON.stringify(res3.evaluationResult, null, 2));
    }
    console.log('\n======================================================================');
    console.log('🎉 B2B SDK INTEGRATION DEMO COMPLETED SUCCESSFULLY!');
    console.log('   Proven: Third-party chatbots integrate Agent Sauda with zero replatforming!');
    console.log('======================================================================');
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}

runExistingAssistantDemo().catch((err) => {
  console.error('❌ SDK Demo Failed:', err);
  process.exit(1);
});
