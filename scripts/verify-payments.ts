import { buildApp } from '../apps/api/src/app.js';
import { prisma } from '../packages/database/src/index.js';

async function runPaymentVerification() {
  console.log('💳 Running Phase 10 Razorpay Payment Integration Test Suite...\n');

  const app = buildApp();
  await app.ready();

  const timestamp = Date.now();

  // 1. Setup Merchant A (Miles Dyson - Cyberdyne)
  const regResA = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `miles_${timestamp}@cyberdyne-sauda.com`,
      password: 'StrongPassword123!',
      name: 'Miles Dyson',
      merchantName: `Cyberdyne Systems ${timestamp}`,
      merchantSlug: `cyberdyne-${timestamp}`,
      currency: 'INR'
    }
  });
  const dataA = JSON.parse(regResA.body);
  const tokenA = dataA.token;
  const merchantIdA = dataA.merchant.id;

  // Setup Merchant B (Skynet Competitor)
  const regResB = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `t1000_${timestamp}@skynet-sauda.com`,
      password: 'StrongPassword123!',
      name: 'T-1000',
      merchantName: `Skynet Corp ${timestamp}`,
      merchantSlug: `skynet-${timestamp}`,
      currency: 'INR'
    }
  });
  const tokenB = JSON.parse(regResB.body).token;

  console.log(`🏢 Created Merchant: "${dataA.merchant.name}" [${merchantIdA}]`);

  // 2. Seed Product with ₹95,000 Base Price
  const prodRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/catalog/products`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      title: 'T-800 Neural Net Processor',
      slug: 't800-neural-processor',
      description: 'Supercomputing learning neural architecture microchip.',
      category: 'Processors',
      basePrice: 95000.0,
      costPrice: 50000.0,
      initialStock: 10,
      location: 'Cyberdyne Lab 1'
    }
  });
  const product = JSON.parse(prodRes.body).product;
  console.log(`💻 Seeded Product: "${product.title}" (Base: ₹95,000 | Stock: 10)`);

  // 3. Create Offer & Convert to Order
  const offerRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/offers`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      items: [{ productId: product.id, quantity: 1, agreedPrice: 95000.0 }]
    }
  });
  const offer = JSON.parse(offerRes.body).offer;

  await app.inject({
    method: 'POST',
    url: `/api/offers/${offer.id}/accept`,
    payload: {}
  });

  const orderRes = await app.inject({
    method: 'POST',
    url: '/api/orders/create-from-offer',
    payload: { offerId: offer.id, notes: 'Direct delivery to Cyberdyne HQ' }
  });
  const order = JSON.parse(orderRes.body).order;
  console.log(`📦 Created Order ${order.orderNumber} in PAYMENT_PENDING status (Total: ₹95,000)\n`);

  // ==========================================================================
  // Test 1: Initiate Payment & Verify Razorpay Order in Paise
  // ==========================================================================
  console.log('▶️ Test 1: POST /api/orders/:orderId/pay (Initiate Payment in Paise)');
  const payRes = await app.inject({
    method: 'POST',
    url: `/api/orders/${order.id}/pay`,
    payload: {
      buyerName: 'John Connor',
      buyerEmail: 'john@resistance.org',
      buyerPhone: '+919876543210'
    }
  });

  if (payRes.statusCode !== 201) {
    throw new Error(`❌ Test 1 Failed: Status ${payRes.statusCode}. Response: ${payRes.body}`);
  }
  const paymentData = JSON.parse(payRes.body).payment;
  if (
    paymentData.status !== 'PENDING' ||
    !paymentData.checkoutPayload ||
    paymentData.checkoutPayload.amountInPaise !== 9500000 || // 95,000 * 100
    !paymentData.razorpayOrderId.startsWith('order_')
  ) {
    throw new Error(`❌ Test 1 Failed: Invalid payment payload: ${JSON.stringify(paymentData)}`);
  }
  console.log(
    `✅ Test 1 Passed: Payment initiated! Razorpay Order [${paymentData.razorpayOrderId}] created for ₹${paymentData.amount} (${paymentData.checkoutPayload.amountInPaise} Paise).`
  );

  // ==========================================================================
  // Test 2: Decoupled State Machine Verification
  // ==========================================================================
  console.log('\n▶️ Test 2: Decoupled State Machine (Order remains PAYMENT_PENDING while transaction in-flight)');
  const checkOrderRes = await app.inject({
    method: 'GET',
    url: `/api/orders/${order.id}`
  });
  const currentOrder = JSON.parse(checkOrderRes.body).order;
  if (currentOrder.status !== 'PAYMENT_PENDING') {
    throw new Error(`❌ Test 2 Failed: Order status should remain PAYMENT_PENDING, got ${currentOrder.status}`);
  }
  console.log(`✅ Test 2 Passed: Decoupled state confirmed. Order status: ${currentOrder.status}, Payment status: ${paymentData.status}.`);

  // ==========================================================================
  // Test 3: Cancelled Order Protection
  // ==========================================================================
  console.log('\n▶️ Test 3: Guard against initiating payment on a CANCELLED order');
  // Create another order and cancel it
  const offer2Res = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/offers`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: { items: [{ productId: product.id, quantity: 1, agreedPrice: 95000.0 }] }
  });
  const offer2 = JSON.parse(offer2Res.body).offer;
  await app.inject({ method: 'POST', url: `/api/offers/${offer2.id}/accept`, payload: {} });
  const order2Res = await app.inject({
    method: 'POST',
    url: '/api/orders/create-from-offer',
    payload: { offerId: offer2.id }
  });
  const order2 = JSON.parse(order2Res.body).order;

  // Cancel order 2
  await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/orders/${order2.id}/cancel`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: { reason: 'Test cancellation' }
  });

  const payCancelledRes = await app.inject({
    method: 'POST',
    url: `/api/orders/${order2.id}/pay`,
    payload: {}
  });
  if (payCancelledRes.statusCode !== 400) {
    throw new Error(`❌ Test 3 Failed: Expected 400 for cancelled order payment, got ${payCancelledRes.statusCode}`);
  }
  console.log('✅ Test 3 Passed: Payment on cancelled order deterministically rejected.');

  // ==========================================================================
  // Test 4: Multiple Payment Attempts Tracking
  // ==========================================================================
  console.log('\n▶️ Test 4: Multiple Payment Attempts create distinct Payment records');
  const payRetryRes = await app.inject({
    method: 'POST',
    url: `/api/orders/${order.id}/pay`,
    payload: { buyerName: 'John Connor (Retry)' }
  });
  if (payRetryRes.statusCode !== 201) {
    throw new Error(`❌ Test 4 Failed: Status ${payRetryRes.statusCode}`);
  }
  const payment2Data = JSON.parse(payRetryRes.body).payment;
  if (payment2Data.attempts !== 2 || payment2Data.id === paymentData.id) {
    throw new Error(`❌ Test 4 Failed: Expected attempt 2 and distinct ID, got attempt=${payment2Data.attempts}`);
  }
  console.log(`✅ Test 4 Passed: Multiple payment attempts tracked cleanly (Attempt #${payment2Data.attempts} created).`);

  // ==========================================================================
  // Test 5: Public Payment Lookup & Merchant Ledger Query
  // ==========================================================================
  console.log('\n▶️ Test 5: Public Payment Lookup & Merchant Ledger Query');
  const getPubPayRes = await app.inject({
    method: 'GET',
    url: `/api/payments/${paymentData.id}`
  });
  if (getPubPayRes.statusCode !== 200) {
    throw new Error(`❌ Test 5 Failed: Public payment lookup status ${getPubPayRes.statusCode}`);
  }

  const merchantPaymentsRes = await app.inject({
    method: 'GET',
    url: `/api/merchants/${merchantIdA}/payments?status=PENDING`,
    headers: { authorization: `Bearer ${tokenA}` }
  });
  const merchantPayments = JSON.parse(merchantPaymentsRes.body);
  if (merchantPayments.paymentsCount < 2) {
    throw new Error(`❌ Test 5 Failed: Expected at least 2 payments, got ${merchantPayments.paymentsCount}`);
  }
  console.log(`✅ Test 5 Passed: Public status lookup and merchant filtered ledger query (${merchantPayments.paymentsCount} payments) verified.`);

  // ==========================================================================
  // Test 6: Cross-Tenant Isolation Guard
  // ==========================================================================
  console.log('\n▶️ Test 6: Cross-Tenant Guard (Merchant B cannot view Merchant A payment)');
  const crossTenantRes = await app.inject({
    method: 'GET',
    url: `/api/merchants/${merchantIdA}/payments/${paymentData.id}`,
    headers: { authorization: `Bearer ${tokenB}` }
  });
  if (crossTenantRes.statusCode !== 403) {
    throw new Error(`❌ Test 6 Failed: Expected 403 Forbidden for cross-tenant query, got ${crossTenantRes.statusCode}`);
  }
  console.log('✅ Test 6 Passed: Cross-tenant payment access rejected with 403 Forbidden.');

  await app.close();
  await prisma.$disconnect();

  console.log('\n🎉 ALL PHASE 10 RAZORPAY PAYMENT INTEGRATION TESTS PASSED SUCCESSFULLY!');
}

runPaymentVerification().catch((err) => {
  console.error('❌ Payment Verification Error:', err);
  process.exit(1);
});
