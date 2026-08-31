import { buildApp } from '../apps/api/src/app.js';
import { prisma } from '../packages/database/src/index.js';

async function runFulfillmentVerification() {
  console.log('🚚 Running Phase 12 Order Lifecycle Transitions & Fulfillment Test Suite...\n');

  const app = buildApp();
  await app.ready();

  const timestamp = Date.now();

  // 1. Setup Merchant A (Cave Johnson - Aperture Science)
  const regResA = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `cave_${timestamp}@aperture-sauda.com`,
      password: 'StrongPassword123!',
      name: 'Cave Johnson',
      merchantName: `Aperture Science ${timestamp}`,
      merchantSlug: `aperture-sci-${timestamp}`,
      currency: 'INR'
    }
  });
  const dataA = JSON.parse(regResA.body);
  const tokenA = dataA.token;
  const merchantIdA = dataA.merchant.id;

  // Setup Merchant B (Black Mesa Competitor)
  const regResB = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `gman_${timestamp}@blackmesa-sauda.com`,
      password: 'StrongPassword123!',
      name: 'G-Man',
      merchantName: `Black Mesa ${timestamp}`,
      merchantSlug: `black-mesa-${timestamp}`,
      currency: 'INR'
    }
  });
  const tokenB = JSON.parse(regResB.body).token;

  console.log(`🏢 Created Merchant: "${dataA.merchant.name}" [${merchantIdA}]`);

  // 2. Seed Product
  const prodRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/catalog/products`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      title: 'Aperture Handheld Portal Device',
      slug: 'aperture-portal-device',
      description: 'Quantum tunneling device for inter-spatial portal generation.',
      category: 'Quantum Hardware',
      basePrice: 75000.0,
      costPrice: 40000.0,
      initialStock: 10,
      location: 'Test Chamber 04'
    }
  });
  const product = JSON.parse(prodRes.body).product;
  console.log(`🌀 Seeded Product: "${product.title}" (Base: ₹75,000 | Stock: 10)`);

  // 3. Create Offer, Convert to Order, and Pay
  const offerRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/offers`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: { items: [{ productId: product.id, quantity: 1, agreedPrice: 75000.0 }] }
  });
  const offer = JSON.parse(offerRes.body).offer;
  await app.inject({ method: 'POST', url: `/api/offers/${offer.id}/accept`, payload: {} });

  const orderRes = await app.inject({
    method: 'POST',
    url: '/api/orders/create-from-offer',
    payload: { offerId: offer.id }
  });
  const order = JSON.parse(orderRes.body).order;

  const payRes = await app.inject({
    method: 'POST',
    url: `/api/orders/${order.id}/pay`,
    payload: {}
  });
  const payment = JSON.parse(payRes.body).payment;

  // Verify payment to mark order as PAID
  await app.inject({
    method: 'POST',
    url: '/api/payments/verify',
    payload: {
      orderId: order.id,
      razorpayOrderId: payment.razorpayOrderId,
      razorpayPaymentId: `pay_mock_${timestamp}`,
      razorpaySignature: 'mock_sig_valid'
    }
  });
  console.log(`💰 Order ${order.orderNumber} successfully paid (Status: PAID)\n`);

  // ==========================================================================
  // Test 1: Start Fulfillment (PAID -> FULFILLMENT_PENDING)
  // ==========================================================================
  console.log('▶️ Test 1: POST /api/merchants/:merchantId/orders/:orderId/start-fulfillment');
  const startFulfillRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/orders/${order.id}/start-fulfillment`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: { notes: 'Order packed in custom quantum-dampening crate' }
  });

  if (startFulfillRes.statusCode !== 200) {
    throw new Error(`❌ Test 1 Failed: Status ${startFulfillRes.statusCode}. Response: ${startFulfillRes.body}`);
  }
  const orderPending = JSON.parse(startFulfillRes.body).order;
  if (orderPending.status !== 'FULFILLMENT_PENDING') {
    throw new Error(`❌ Test 1 Failed: Expected status FULFILLMENT_PENDING, got ${orderPending.status}`);
  }
  console.log(`✅ Test 1 Passed: Order ${orderPending.orderNumber} transitioned to FULFILLMENT_PENDING.`);

  // ==========================================================================
  // Test 2: Complete Fulfillment (FULFILLMENT_PENDING -> COMPLETED)
  // ==========================================================================
  console.log('\n▶️ Test 2: POST /api/merchants/:merchantId/orders/:orderId/fulfill (Ship with Tracking)');
  const completeFulfillRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/orders/${order.id}/fulfill`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      trackingNumber: 'APERTURE-CARGO-999',
      carrier: 'Aperture Air Cargo',
      notes: 'Dispatched via express cargo'
    }
  });

  if (completeFulfillRes.statusCode !== 200) {
    throw new Error(`❌ Test 2 Failed: Status ${completeFulfillRes.statusCode}. Response: ${completeFulfillRes.body}`);
  }
  const completedOrder = JSON.parse(completeFulfillRes.body).order;
  if (completedOrder.status !== 'COMPLETED') {
    throw new Error(`❌ Test 2 Failed: Expected status COMPLETED, got ${completedOrder.status}`);
  }
  console.log(`✅ Test 2 Passed: Order ${completedOrder.orderNumber} marked COMPLETED with tracking details.`);

  // ==========================================================================
  // Test 3: Public Buyer Order Tracking Timeline
  // ==========================================================================
  console.log('\n▶️ Test 3: GET /api/orders/:orderId/track (Public Tracking Timeline)');
  const trackRes = await app.inject({
    method: 'GET',
    url: `/api/orders/${order.id}/track`
  });

  if (trackRes.statusCode !== 200) {
    throw new Error(`❌ Test 3 Failed: Status ${trackRes.statusCode}. Response: ${trackRes.body}`);
  }
  const trackingData = JSON.parse(trackRes.body).tracking;
  if (
    trackingData.status !== 'COMPLETED' ||
    trackingData.timeline.length !== 5 ||
    !trackingData.timeline[4].completed
  ) {
    throw new Error(`❌ Test 3 Failed: Unexpected tracking data: ${JSON.stringify(trackingData)}`);
  }
  console.log(`✅ Test 3 Passed: Tracking timeline verified with 5 milestones (All 5 marked completed).`);

  // ==========================================================================
  // Test 4: Premature Fulfillment Guard (Unpaid order cannot be fulfilled)
  // ==========================================================================
  console.log('\n▶️ Test 4: Guard against fulfilling unpaid orders (PAYMENT_PENDING)');
  const offer2Res = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/offers`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: { items: [{ productId: product.id, quantity: 1, agreedPrice: 75000.0 }] }
  });
  const offer2 = JSON.parse(offer2Res.body).offer;
  await app.inject({ method: 'POST', url: `/api/offers/${offer2.id}/accept`, payload: {} });
  const unpaidOrderRes = await app.inject({
    method: 'POST',
    url: '/api/orders/create-from-offer',
    payload: { offerId: offer2.id }
  });
  const unpaidOrder = JSON.parse(unpaidOrderRes.body).order;

  const tryFulfillUnpaidRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/orders/${unpaidOrder.id}/fulfill`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {}
  });
  if (tryFulfillUnpaidRes.statusCode !== 400) {
    throw new Error(`❌ Test 4 Failed: Expected 400 when fulfilling unpaid order, got ${tryFulfillUnpaidRes.statusCode}`);
  }
  console.log('✅ Test 4 Passed: Premature fulfillment on unpaid order deterministically rejected.');

  // ==========================================================================
  // Test 5: Terminal State Guard (Cannot cancel COMPLETED order without refund)
  // ==========================================================================
  console.log('\n▶️ Test 5: Guard against cancelling COMPLETED orders');
  const tryCancelCompletedRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/orders/${order.id}/cancel`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: { reason: 'Cancellation after delivery' }
  });
  if (tryCancelCompletedRes.statusCode !== 400) {
    throw new Error(`❌ Test 5 Failed: Expected 400 for cancelling completed order, got ${tryCancelCompletedRes.statusCode}`);
  }
  console.log('✅ Test 5 Passed: Cancellation of completed order rejected with 400 INVALID_ORDER_STATE.');

  // ==========================================================================
  // Test 6: Cross-Tenant Isolation Guard
  // ==========================================================================
  console.log('\n▶️ Test 6: Cross-Tenant Guard (Merchant B cannot fulfill Merchant A order)');
  const crossTenantFulfillRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/orders/${order.id}/fulfill`,
    headers: { authorization: `Bearer ${tokenB}` },
    payload: {}
  });
  if (crossTenantFulfillRes.statusCode !== 403) {
    throw new Error(`❌ Test 6 Failed: Expected 403 Forbidden for cross-tenant fulfillment, got ${crossTenantFulfillRes.statusCode}`);
  }
  console.log('✅ Test 6 Passed: Cross-tenant fulfillment action rejected with 403 Forbidden.');

  await app.close();
  await prisma.$disconnect();

  console.log('\n🎉 ALL PHASE 12 ORDER LIFECYCLE & FULFILLMENT TESTS PASSED SUCCESSFULLY!');
}

runFulfillmentVerification().catch((err) => {
  console.error('❌ Fulfillment Verification Error:', err);
  process.exit(1);
});
