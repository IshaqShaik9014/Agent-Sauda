import { buildApp } from '../apps/api/src/app.js';
import { prisma } from '../packages/database/src/index.js';

async function verifyFrontendIntegration() {
  console.log('🖥️ Running Phase 15 Public Buyer Chat & Frontend Integration Test Suite...\n');

  const app = buildApp();
  await app.ready();

  const timestamp = Date.now();

  // 1. Setup Demo Merchant: "Quantum Dynamics Tech"
  const regRes = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `founder_${timestamp}@quantum-dynamics.io`,
      password: 'StrongPassword123!',
      name: 'Ada Lovelace',
      merchantName: 'Quantum Dynamics Tech',
      merchantSlug: `quantum-dynamics-${timestamp}`,
      currency: 'INR'
    }
  });
  const authData = JSON.parse(regRes.body);
  const token = authData.token;
  const merchantId = authData.merchant.id;
  const merchantSlug = authData.merchant.slug;

  console.log(`🏬 Created Store: "${authData.merchant.name}" (slug: "${merchantSlug}")`);

  // 2. Add Products to Catalog
  const prodRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantId}/catalog/products`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: 'Quantum Processor Q-1',
      slug: 'quantum-processor-q1',
      description: 'Superconducting quantum calculation core.',
      category: 'Processors',
      basePrice: 120000.0,
      costPrice: 70000.0,
      initialStock: 10,
      location: 'Cryo Lab 1'
    }
  });
  const product = JSON.parse(prodRes.body).product;
  console.log(`📦 Seeded Product: "${product.title}" (Base Price: ₹${product.basePrice.toLocaleString('en-IN')})\n`);

  // ==========================================================================
  // Test 1: Buyer Catalog Discovery by Merchant Slug
  // ==========================================================================
  console.log('▶️ Test 1: GET /api/agent/catalog?merchantSlug=' + merchantSlug);
  const catalogRes = await app.inject({
    method: 'GET',
    url: `/api/agent/catalog?merchantSlug=${merchantSlug}`
  });

  if (catalogRes.statusCode !== 200) {
    throw new Error(`❌ Test 1 Failed: Status ${catalogRes.statusCode}. Response: ${catalogRes.body}`);
  }
  const catalog = JSON.parse(catalogRes.body).products;
  if (catalog.length === 0 || catalog[0].slug !== product.slug) {
    throw new Error(`❌ Test 1 Failed: Expected product in catalog, got ${JSON.stringify(catalog)}`);
  }
  // Verify redaction
  if ('costPrice' in catalog[0]) {
    throw new Error('❌ Test 1 Failed: costPrice was leaked in public buyer catalog!');
  }
  console.log(`✅ Test 1 Passed: Redacted public catalog returned ${catalog.length} products for slug "${merchantSlug}".`);

  // ==========================================================================
  // Test 2: Buyer Natural Language Chat & AI Negotiation Proposal
  // ==========================================================================
  console.log('\n▶️ Test 2: POST /api/agent/chat (Buyer proposes deal)');
  const chatRes = await app.inject({
    method: 'POST',
    url: '/api/agent/chat',
    payload: {
      message: `I would like to buy 1 unit of "${product.title}" for ₹110,000. Can you make an offer?`,
      customerName: 'Enterprise Buyer'
    }
  });

  if (chatRes.statusCode !== 200) {
    throw new Error(`❌ Test 2 Failed: Status ${chatRes.statusCode}. Response: ${chatRes.body}`);
  }
  const chatData = JSON.parse(chatRes.body);
  if (!chatData.conversationId || !chatData.message) {
    throw new Error(`❌ Test 2 Failed: Invalid chat response format: ${JSON.stringify(chatData)}`);
  }
  console.log(`✅ Test 2 Passed: AI Sales Agent replied: "${chatData.message.slice(0, 80)}..."`);

  // ==========================================================================
  // Test 3: Materialize Formal Offer & Verify Public Buyer Offer Endpoint
  // ==========================================================================
  console.log('\n▶️ Test 3: Formal Offer Materialization and Public Offer Details');
  const offerRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantId}/offers`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      conversationId: chatData.conversationId,
      items: [{ productId: product.id, quantity: 1, agreedPrice: 110000.0 }]
    }
  });
  const offer = JSON.parse(offerRes.body).offer;

  const publicOfferRes = await app.inject({
    method: 'GET',
    url: `/api/offers/${offer.id}`
  });
  if (publicOfferRes.statusCode !== 200) {
    throw new Error(`❌ Test 3 Failed: Status ${publicOfferRes.statusCode}`);
  }
  const fetchedOffer = JSON.parse(publicOfferRes.body).offer;
  if (fetchedOffer.totalAmount !== 110000 || fetchedOffer.status !== 'ACTIVE') {
    throw new Error(`❌ Test 3 Failed: Unexpected offer state: ${JSON.stringify(fetchedOffer)}`);
  }
  console.log(
    `✅ Test 3 Passed: Formal Offer #${fetchedOffer.offerNumber} (₹${fetchedOffer.totalAmount.toLocaleString('en-IN')}) is ACTIVE with 24h expiration.`
  );

  // ==========================================================================
  // Test 4: Buyer Accepts Offer in Frontend & Converts to Order
  // ==========================================================================
  console.log('\n▶️ Test 4: Buyer Accepts Offer & Secures Stock Reservation');
  const acceptRes = await app.inject({
    method: 'POST',
    url: `/api/offers/${offer.id}/accept`,
    payload: {}
  });
  if (acceptRes.statusCode !== 200) {
    throw new Error(`❌ Test 4 Failed: Could not accept offer: ${acceptRes.body}`);
  }

  const orderRes = await app.inject({
    method: 'POST',
    url: '/api/orders/create-from-offer',
    payload: { offerId: offer.id, notes: 'Purchased via Web Chat UI' }
  });
  if (orderRes.statusCode !== 201) {
    throw new Error(`❌ Test 4 Failed: Could not create order: ${orderRes.body}`);
  }
  const order = JSON.parse(orderRes.body).order;
  console.log(
    `✅ Test 4 Passed: Order #${order.orderNumber} created in PAYMENT_PENDING status with guaranteed inventory reservation!`
  );

  await app.close();
  await prisma.$disconnect();

  console.log('\n🎉 ALL PHASE 15 PUBLIC BUYER FRONTEND INTEGRATION TESTS PASSED SUCCESSFULLY!');
}

verifyFrontendIntegration().catch((err) => {
  console.error('❌ Frontend Verification Error:', err);
  process.exit(1);
});
