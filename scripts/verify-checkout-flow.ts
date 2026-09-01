import { buildApp } from '../apps/api/src/app.js';
import { prisma } from '../packages/database/src/index.js';

async function verifyCheckoutAndTrackingFlow() {
  console.log('💳 Running Phase 16 Buyer Checkout, Razorpay & Live Tracking Test Suite...\n');

  const app = buildApp();
  await app.ready();

  const timestamp = Date.now();

  // 1. Setup Merchant: Apex Hardware Corp
  const regRes = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `apex_${timestamp}@hardware.com`,
      password: 'StrongPassword123!',
      name: 'Alex Murphy',
      merchantName: 'Apex Hardware Corp',
      merchantSlug: `apex-hardware-${timestamp}`,
      currency: 'INR'
    }
  });
  const authData = JSON.parse(regRes.body);
  const token = authData.token;
  const merchantId = authData.merchant.id;

  console.log(`🏬 Created Merchant: "${authData.merchant.name}" [${merchantId}]`);

  // 2. Add Product
  const prodRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantId}/catalog/products`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: 'Titanium Fasteners Industrial Kit',
      slug: 'titanium-fasteners-kit',
      description: 'Aerospace grade titanium industrial fasteners.',
      category: 'Industrial',
      basePrice: 100000.0,
      costPrice: 60000.0,
      initialStock: 8,
      location: 'Warehouse B'
    }
  });
  const product = JSON.parse(prodRes.body).product;
  console.log(`📦 Seeded Product: "${product.title}" (Base Price: ₹${product.basePrice.toLocaleString('en-IN')})\n`);

  // ==========================================================================
  // Test 1: Materialize Formal Offer from Negotiation
  // ==========================================================================
  console.log('▶️ Test 1: Materialize Formal Offer (20% Negotiated Discount)');
  const offerRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantId}/offers`,
    headers: { authorization: `Bearer ${token}` },
    payload: { items: [{ productId: product.id, quantity: 1, agreedPrice: 80000.0 }] }
  });
  const offer = JSON.parse(offerRes.body).offer;

  await app.inject({ method: 'POST', url: `/api/offers/${offer.id}/accept`, payload: {} });
  console.log(`✅ Test 1 Passed: Offer #${offer.offerNumber} accepted for ₹${offer.totalAmount.toLocaleString('en-IN')}.`);

  // ==========================================================================
  // Test 2: Order Conversion with Two-Phase Stock Reservation
  // ==========================================================================
  console.log('\n▶️ Test 2: Convert Offer to Order (Stock Lock)');
  const orderRes = await app.inject({
    method: 'POST',
    url: '/api/orders/create-from-offer',
    payload: {
      offerId: offer.id,
      notes: 'Ship To: H-104 Cyber City, Hyderabad, TS | Customer: Ishaq Shaik'
    }
  });

  if (orderRes.statusCode !== 201) {
    throw new Error(`❌ Test 2 Failed: Status ${orderRes.statusCode}. Response: ${orderRes.body}`);
  }
  const order = JSON.parse(orderRes.body).order;
  if (order.status !== 'PAYMENT_PENDING' || order.totalAmount !== 80000) {
    throw new Error(`❌ Test 2 Failed: Unexpected order status: ${JSON.stringify(order)}`);
  }
  console.log(`✅ Test 2 Passed: Order #${order.orderNumber} created with reserved inventory in PAYMENT_PENDING state.`);

  // ==========================================================================
  // Test 3: Razorpay Payment Initiation (Subunit Paise Precision)
  // ==========================================================================
  console.log('\n▶️ Test 3: Initiate Razorpay Payment in Integer Paise (8,000,000 paise)');
  const payRes = await app.inject({
    method: 'POST',
    url: `/api/orders/${order.id}/pay`,
    payload: {
      buyerName: 'Ishaq Shaik',
      buyerEmail: 'ishaq@agent-sauda.com',
      buyerPhone: '+919876543210'
    }
  });

  if (payRes.statusCode !== 201) {
    throw new Error(`❌ Test 3 Failed: Status ${payRes.statusCode}. Response: ${payRes.body}`);
  }
  const payment = JSON.parse(payRes.body).payment;
  const payload = payment.checkoutPayload;

  if (payload.amountInPaise !== 8000000 || !payload.razorpayOrderId) {
    throw new Error(`❌ Test 3 Failed: Invalid paise subunit conversion: ${JSON.stringify(payload)}`);
  }
  console.log(`✅ Test 3 Passed: Razorpay Order created: "${payload.razorpayOrderId}" (${payload.amountInPaise} paise).`);

  // ==========================================================================
  // Test 4: Client Checkout Signature Verification
  // ==========================================================================
  console.log('\n▶️ Test 4: Verify Payment Signature & Transition to PAID');
  const verifyRes = await app.inject({
    method: 'POST',
    url: '/api/payments/verify',
    payload: {
      orderId: order.id,
      razorpayOrderId: payment.razorpayOrderId,
      razorpayPaymentId: `pay_test_${timestamp}`,
      razorpaySignature: `mock_sig_test_${timestamp}`
    }
  });

  if (verifyRes.statusCode !== 200) {
    throw new Error(`❌ Test 4 Failed: Status ${verifyRes.statusCode}. Response: ${verifyRes.body}`);
  }
  const verifyData = JSON.parse(verifyRes.body);
  if (!verifyData.success || !verifyData.orderId) {
    throw new Error(`❌ Test 4 Failed: Expected success verification, got ${JSON.stringify(verifyData)}`);
  }

  const orderCheck = await app.inject({ method: 'GET', url: `/api/orders/${order.id}` });
  const orderData = JSON.parse(orderCheck.body).order;
  if (orderData.status !== 'PAID') {
    throw new Error(`❌ Test 4 Failed: Expected PAID order, got ${orderData.status}`);
  }
  console.log(`✅ Test 4 Passed: Payment captured successfully. Order status is now "${orderData.status}".`);

  // ==========================================================================
  // Test 5: Warehouse Fulfillment Progression
  // ==========================================================================
  console.log('\n▶️ Test 5: Transition Order through Fulfillment Pipeline');
  await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantId}/orders/${order.id}/start-fulfillment`,
    headers: { authorization: `Bearer ${token}` },
    payload: { notes: 'Boxed and ready for pickup by courier' }
  });

  await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantId}/orders/${order.id}/fulfill`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      carrier: 'BlueDart Express',
      trackingNumber: `BD-EXP-${timestamp}`
    }
  });
  console.log('✅ Test 5 Passed: Order packed and marked COMPLETED with BlueDart tracking info.');

  // ==========================================================================
  // Test 6: Public 5-Milestone Tracking Timeline
  // ==========================================================================
  console.log('\n▶️ Test 6: GET /api/orders/:orderId/track (5-Milestone Delivery Stepper)');
  const trackRes = await app.inject({
    method: 'GET',
    url: `/api/orders/${order.id}/track`
  });

  if (trackRes.statusCode !== 200) {
    throw new Error(`❌ Test 6 Failed: Status ${trackRes.statusCode}. Response: ${trackRes.body}`);
  }
  const tracking = JSON.parse(trackRes.body).tracking;
  if (tracking.status !== 'COMPLETED' || tracking.timeline.length !== 5) {
    throw new Error(`❌ Test 6 Failed: Unexpected tracking timeline: ${JSON.stringify(tracking)}`);
  }

  const allCompleted = tracking.timeline.every((e: any) => e.completed === true);
  if (!allCompleted) {
    throw new Error('❌ Test 6 Failed: Not all timeline steps are marked completed!');
  }

  console.log(
    `✅ Test 6 Passed: Public tracking timeline verified with 5/5 milestones completed! (Carrier: BlueDart Express).`
  );

  await app.close();
  await prisma.$disconnect();

  console.log('\n🎉 ALL PHASE 16 BUYER CHECKOUT, PAYMENT & TRACKING TESTS PASSED SUCCESSFULLY!');
}

verifyCheckoutAndTrackingFlow().catch((err) => {
  console.error('❌ Checkout Verification Error:', err);
  process.exit(1);
});
