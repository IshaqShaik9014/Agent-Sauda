import { buildApp } from '../apps/api/src/app.js';
import { prisma } from '../packages/database/src/index.js';

async function runOfferVerification() {
  console.log('📜 Running Phase 7 Offer Management & State Machine Test Suite...\n');

  const app = buildApp();
  await app.ready();

  const timestamp = Date.now();

  // 1. Setup Merchant A
  const regResA = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `stark_owner_${timestamp}@agentsauda.com`,
      password: 'StrongPassword123!',
      name: 'Tony Stark',
      merchantName: `Stark Industries ${timestamp}`,
      merchantSlug: `stark-ind-${timestamp}`,
      currency: 'INR'
    }
  });
  const dataA = JSON.parse(regResA.body);
  const tokenA = dataA.token;
  const merchantIdA = dataA.merchant.id;

  // Setup Merchant B (For Cross-Tenant Tests)
  const regResB = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `hammer_owner_${timestamp}@agentsauda.com`,
      password: 'StrongPassword123!',
      name: 'Justin Hammer',
      merchantName: `Hammer Tech ${timestamp}`,
      merchantSlug: `hammer-tech-${timestamp}`,
      currency: 'INR'
    }
  });
  const tokenB = JSON.parse(regResB.body).token;

  console.log(`🏢 Created Merchant A: "${dataA.merchant.name}" [${merchantIdA}]`);

  // 2. Create Catalog Product
  const prodRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/catalog/products`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      title: 'Arc Reactor Clean Power Unit',
      slug: 'arc-reactor-clean-power',
      description: 'Zero-emission high capacity clean energy generator.',
      category: 'Energy',
      basePrice: 50000.0,
      costPrice: 30000.0,
      initialStock: 25,
      location: 'Malibu Facility'
    }
  });
  const product = JSON.parse(prodRes.body).product;
  console.log(`📦 Seeded Product: "${product.title}" — Base: ₹50,000 | Cost: ₹30,000\n`);

  // ==========================================================================
  // Test 1: Create Formal Commercial Offer
  // ==========================================================================
  console.log('▶️ Test 1: POST /api/merchants/:merchantId/offers (Create 24h Offer at 5% discount)');
  const createOfferRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/offers`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      expirationHours: 24,
      items: [
        {
          productId: product.id,
          quantity: 2,
          agreedPrice: 47500.0 // 5% discount
        }
      ]
    }
  });

  if (createOfferRes.statusCode !== 201) {
    throw new Error(`❌ Test 1 Failed: Status ${createOfferRes.statusCode}. Response: ${createOfferRes.body}`);
  }

  const offer1 = JSON.parse(createOfferRes.body).offer;
  if (offer1.status !== 'ACTIVE' || offer1.totalAmount !== 95000.0 || offer1.discountAmount !== 5000.0) {
    throw new Error(`❌ Test 1 Failed: Financial calculations mismatch. Total: ${offer1.totalAmount}`);
  }
  console.log(`✅ Test 1 Passed: Offer ${offer1.offerNumber} created! Total: ₹${offer1.totalAmount.toLocaleString('en-IN')} (Checkout: ${offer1.checkoutUrl})`);

  // ==========================================================================
  // Test 2: Public Buyer Checkout View (No Auth Required)
  // ==========================================================================
  console.log('\n▶️ Test 2: GET /api/offers/:offerId (Public Buyer Checkout View)');
  const publicOfferRes = await app.inject({
    method: 'GET',
    url: `/api/offers/${offer1.id}`
  });

  if (publicOfferRes.statusCode !== 200) {
    throw new Error(`❌ Test 2 Failed: Status ${publicOfferRes.statusCode}`);
  }
  const publicOffer = JSON.parse(publicOfferRes.body).offer;
  if (publicOffer.items.length !== 1 || publicOffer.items[0].productTitle !== product.title) {
    throw new Error(`❌ Test 2 Failed: Line item mismatch on public checkout.`);
  }
  console.log(`✅ Test 2 Passed: Public checkout retrieved product "${publicOffer.items[0].productTitle}" for ₹${publicOffer.totalAmount.toLocaleString('en-IN')}`);

  // ==========================================================================
  // Test 3: Buyer Accepts Offer
  // ==========================================================================
  console.log('\n▶️ Test 3: POST /api/offers/:offerId/accept (Buyer Confirms Acceptance)');
  const acceptRes = await app.inject({
    method: 'POST',
    url: `/api/offers/${offer1.id}/accept`,
    payload: { buyerSessionId: 'buyer_session_999' }
  });

  if (acceptRes.statusCode !== 200) {
    throw new Error(`❌ Test 3 Failed: Status ${acceptRes.statusCode}`);
  }
  const acceptedOffer = JSON.parse(acceptRes.body).offer;
  if (acceptedOffer.status !== 'ACCEPTED') {
    throw new Error(`❌ Test 3 Failed: Expected status ACCEPTED, got ${acceptedOffer.status}`);
  }
  console.log(`✅ Test 3 Passed: Offer ${acceptedOffer.offerNumber} state transitioned to ACCEPTED.`);

  // ==========================================================================
  // Test 4: Expiration Handling & Guard
  // ==========================================================================
  console.log('\n▶️ Test 4: Offer Expiration Lifecycle (Expired offer cannot be accepted)');
  // Create an already-expired offer in database
  const expiredDbOffer = await prisma.offer.create({
    data: {
      merchantId: merchantIdA,
      conversationId: offer1.conversationId,
      offerNumber: `OFF-EXPIRED-${timestamp}`,
      subtotal: 50000.0,
      totalAmount: 45000.0,
      marginPercent: 30.0,
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      items: {
        create: [
          {
            productId: product.id,
            quantity: 1,
            unitPrice: 50000.0,
            agreedPrice: 45000.0,
            costPrice: 30000.0,
            subtotal: 45000.0
          }
        ]
      }
    }
  });

  const getExpiredRes = await app.inject({
    method: 'GET',
    url: `/api/offers/${expiredDbOffer.id}`
  });
  const getExpired = JSON.parse(getExpiredRes.body).offer;
  if (!getExpired.isExpired || getExpired.status !== 'EXPIRED') {
    throw new Error(`❌ Test 4 Failed: Offer was not lazily marked as EXPIRED.`);
  }

  // Attempting to accept expired offer should fail
  const tryAcceptExpired = await app.inject({
    method: 'POST',
    url: `/api/offers/${expiredDbOffer.id}/accept`,
    payload: {}
  });
  if (tryAcceptExpired.statusCode !== 400) {
    throw new Error(`❌ Test 4 Failed: Expected 400 when accepting expired offer, got ${tryAcceptExpired.statusCode}`);
  }
  console.log(`✅ Test 4 Passed: Expired offer lazily transitioned to EXPIRED and acceptance blocked.`);

  // ==========================================================================
  // Test 5: Rejection Handling
  // ==========================================================================
  console.log('\n▶️ Test 5: POST /api/offers/:offerId/reject (Buyer rejects terms)');
  const createOffer2Res = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/offers`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      items: [{ productId: product.id, quantity: 1, agreedPrice: 48000.0 }]
    }
  });
  const offer2 = JSON.parse(createOffer2Res.body).offer;

  const rejectRes = await app.inject({
    method: 'POST',
    url: `/api/offers/${offer2.id}/reject`,
    payload: { reason: 'Found cheaper alternative' }
  });
  if (rejectRes.statusCode !== 200) {
    throw new Error(`❌ Test 5 Failed: Status ${rejectRes.statusCode}`);
  }
  const rejectedOffer = JSON.parse(rejectRes.body).offer;
  if (rejectedOffer.status !== 'REJECTED') {
    throw new Error(`❌ Test 5 Failed: Expected status REJECTED, got ${rejectedOffer.status}`);
  }
  console.log(`✅ Test 5 Passed: Offer ${rejectedOffer.offerNumber} state transitioned to REJECTED.`);

  // ==========================================================================
  // Test 6: Merchant Dashboard Listing with Status Filters
  // ==========================================================================
  console.log('\n▶️ Test 6: GET /api/merchants/:merchantId/offers (Merchant Listing & Filtering)');
  const listAllRes = await app.inject({
    method: 'GET',
    url: `/api/merchants/${merchantIdA}/offers`,
    headers: { authorization: `Bearer ${tokenA}` }
  });
  const listAll = JSON.parse(listAllRes.body);
  if (listAll.offersCount < 3) {
    throw new Error(`❌ Test 6 Failed: Expected at least 3 offers, got ${listAll.offersCount}`);
  }

  const listAcceptedRes = await app.inject({
    method: 'GET',
    url: `/api/merchants/${merchantIdA}/offers?status=ACCEPTED`,
    headers: { authorization: `Bearer ${tokenA}` }
  });
  const listAccepted = JSON.parse(listAcceptedRes.body);
  if (listAccepted.offers.length < 1 || listAccepted.offers[0].status !== 'ACCEPTED') {
    throw new Error(`❌ Test 6 Failed: Filter status=ACCEPTED failed.`);
  }
  console.log(`✅ Test 6 Passed: Retrieved ${listAll.offersCount} total offers, filtered ${listAccepted.offers.length} ACCEPTED offers.`);

  // ==========================================================================
  // Test 7: Cross-Tenant Authorization Guard
  // ==========================================================================
  console.log('\n▶️ Test 7: Cross-Tenant Guard (Merchant B attempts to read Merchant A offer)');
  const crossTenantRes = await app.inject({
    method: 'GET',
    url: `/api/merchants/${merchantIdA}/offers/${offer1.id}`,
    headers: { authorization: `Bearer ${tokenB}` }
  });
  if (crossTenantRes.statusCode !== 403) {
    throw new Error(`❌ Test 7 Failed: Expected 403 Forbidden, got ${crossTenantRes.statusCode}`);
  }
  console.log(`✅ Test 7 Passed: Cross-tenant offer access rejected with 403 Forbidden.`);

  await app.close();
  await prisma.$disconnect();

  console.log('\n🎉 ALL PHASE 7 OFFER MANAGEMENT & STATE MACHINE TESTS PASSED SUCCESSFULLY!');
}

runOfferVerification().catch((err) => {
  console.error('❌ Offer Verification Error:', err);
  process.exit(1);
});
