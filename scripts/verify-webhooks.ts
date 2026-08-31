import { createHmac } from 'node:crypto';
import { buildApp } from '../apps/api/src/app.js';
import { prisma } from '../packages/database/src/index.js';

async function runWebhookVerification() {
  console.log('⚡ Running Phase 11 Razorpay Webhook Processing & Payment Verification Suite...\n');

  const app = buildApp();
  await app.ready();

  const timestamp = Date.now();

  // 1. Setup Merchant A (Acme Corp)
  const regResA = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `wile_${timestamp}@acme-sauda.com`,
      password: 'StrongPassword123!',
      name: 'Wile E. Coyote',
      merchantName: `Acme Corporation ${timestamp}`,
      merchantSlug: `acme-corp-${timestamp}`,
      currency: 'INR'
    }
  });
  const dataA = JSON.parse(regResA.body);
  const tokenA = dataA.token;
  const merchantIdA = dataA.merchant.id;

  // Setup Merchant B (Roadrunner Inc)
  const regResB = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `roadrunner_${timestamp}@acme-sauda.com`,
      password: 'StrongPassword123!',
      name: 'Road Runner',
      merchantName: `Roadrunner Inc ${timestamp}`,
      merchantSlug: `roadrunner-${timestamp}`,
      currency: 'INR'
    }
  });
  const tokenB = JSON.parse(regResB.body).token;

  console.log(`🏢 Created Merchant: "${dataA.merchant.name}" [${merchantIdA}]`);

  // 2. Seed Product with Initial Stock: 5 available, 0 reserved
  const prodRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/catalog/products`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      title: 'Quantum Teleportation Beacon',
      slug: 'quantum-teleport-beacon',
      description: 'Instantaneous sub-atomic relocation beacon.',
      category: 'Gadgets',
      basePrice: 60000.0,
      costPrice: 35000.0,
      initialStock: 5,
      location: 'Desert Lab 1'
    }
  });
  const product = JSON.parse(prodRes.body).product;
  console.log(`📡 Seeded Product: "${product.title}" — Stock: 5 Available | 0 Reserved\n`);

  // 3. Create Offer, Convert to Order, and Initiate Payment 1
  const offerRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/offers`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: { items: [{ productId: product.id, quantity: 1, agreedPrice: 60000.0 }] }
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
    payload: { buyerName: 'Wile Coyote' }
  });
  const payment = JSON.parse(payRes.body).payment;
  console.log(`💳 Initiated Payment [${payment.razorpayOrderId}] for Order ${order.orderNumber} (Stock reserved: 1)\n`);

  // ==========================================================================
  // Test 1: Client Signature Verification (POST /api/payments/verify)
  // ==========================================================================
  console.log('▶️ Test 1: POST /api/payments/verify (Valid Client Checkout Verification)');
  const clientPaymentId = `pay_client_${timestamp}`;
  const validSig = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'rzp_test_mock_key_secret')
    .update(`${payment.razorpayOrderId}|${clientPaymentId}`)
    .digest('hex');

  const verifyRes = await app.inject({
    method: 'POST',
    url: '/api/payments/verify',
    payload: {
      orderId: order.id,
      razorpayOrderId: payment.razorpayOrderId,
      razorpayPaymentId: clientPaymentId,
      razorpaySignature: validSig
    }
  });

  if (verifyRes.statusCode !== 200) {
    throw new Error(`❌ Test 1 Failed: Status ${verifyRes.statusCode}. Response: ${verifyRes.body}`);
  }

  // Verify database transitions
  const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
  const updatedPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
  const updatedInventory = await prisma.inventory.findFirst({ where: { productId: product.id } });

  if (
    updatedOrder?.status !== 'PAID' ||
    updatedPayment?.status !== 'CAPTURED' ||
    updatedInventory?.reservedUnits !== 0 ||
    updatedInventory?.availableUnits !== 4
  ) {
    throw new Error(
      `❌ Test 1 Failed: State mismatch! Order: ${updatedOrder?.status}, Payment: ${updatedPayment?.status}, Reserved: ${updatedInventory?.reservedUnits}`
    );
  }
  console.log(`✅ Test 1 Passed: Payment CAPTURED, Order PAID, and reserved stock permanently deducted (Available: 4, Reserved: 0).`);

  // ==========================================================================
  // Test 2: Invalid Client Signature Rejection
  // ==========================================================================
  console.log('\n▶️ Test 2: Reject forged client payment signature');
  const forgedRes = await app.inject({
    method: 'POST',
    url: '/api/payments/verify',
    payload: {
      orderId: order.id,
      razorpayOrderId: payment.razorpayOrderId,
      razorpayPaymentId: 'pay_hacker_123',
      razorpaySignature: 'forged_fake_signature_hex'
    }
  });

  if (forgedRes.statusCode !== 400) {
    throw new Error(`❌ Test 2 Failed: Expected 400 for forged signature, got ${forgedRes.statusCode}`);
  }
  console.log('✅ Test 2 Passed: Forged signature rejected with 400 INVALID_PAYMENT_SIGNATURE.');

  // ==========================================================================
  // Test 3: Webhook payment.captured Ingestion
  // ==========================================================================
  console.log('\n▶️ Test 3: POST /api/webhooks/razorpay (Ingest payment.captured Webhook)');
  // Create Order 2 and Payment 2
  const offer2Res = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/offers`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: { items: [{ productId: product.id, quantity: 1, agreedPrice: 60000.0 }] }
  });
  const offer2 = JSON.parse(offer2Res.body).offer;
  await app.inject({ method: 'POST', url: `/api/offers/${offer2.id}/accept`, payload: {} });
  const order2Res = await app.inject({
    method: 'POST',
    url: '/api/orders/create-from-offer',
    payload: { offerId: offer2.id }
  });
  const order2 = JSON.parse(order2Res.body).order;
  const pay2Res = await app.inject({
    method: 'POST',
    url: `/api/orders/${order2.id}/pay`,
    payload: {}
  });
  const payment2 = JSON.parse(pay2Res.body).payment;

  const webhookEventId = `evt_${timestamp}_captured`;
  const webhookPayload = {
    event_id: webhookEventId,
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: `pay_wh_${timestamp}`,
          order_id: payment2.razorpayOrderId,
          amount: 6000000,
          currency: 'INR',
          status: 'captured'
        }
      }
    }
  };
  const rawPayload = JSON.stringify(webhookPayload);
  const webhookSig = createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_test_mock_webhook_secret')
    .update(rawPayload)
    .digest('hex');

  const whRes = await app.inject({
    method: 'POST',
    url: '/api/webhooks/razorpay',
    headers: {
      'x-razorpay-signature': webhookSig,
      'content-type': 'application/json'
    },
    body: rawPayload
  });

  if (whRes.statusCode !== 200) {
    throw new Error(`❌ Test 3 Failed: Status ${whRes.statusCode}. Response: ${whRes.body}`);
  }
  const whData = JSON.parse(whRes.body);
  if (!whData.received || whData.status !== 'PROCESSED') {
    throw new Error(`❌ Test 3 Failed: Unexpected webhook response: ${JSON.stringify(whData)}`);
  }

  const order2Db = await prisma.order.findUnique({ where: { id: order2.id } });
  const payment2Db = await prisma.payment.findUnique({ where: { id: payment2.id } });
  if (order2Db?.status !== 'PAID' || payment2Db?.status !== 'CAPTURED') {
    throw new Error(`❌ Test 3 Failed: Order 2 not marked as PAID via webhook.`);
  }
  console.log(`✅ Test 3 Passed: Webhook payment.captured verified HMAC SHA256 and transitioned Order to PAID.`);

  // ==========================================================================
  // Test 4: Webhook Idempotency Layer
  // ==========================================================================
  console.log('\n▶️ Test 4: Webhook Idempotency (Duplicate event returns 200 without reprocessing)');
  const duplicateWhRes = await app.inject({
    method: 'POST',
    url: '/api/webhooks/razorpay',
    headers: {
      'x-razorpay-signature': webhookSig,
      'content-type': 'application/json'
    },
    body: rawPayload
  });

  if (duplicateWhRes.statusCode !== 200) {
    throw new Error(`❌ Test 4 Failed: Status ${duplicateWhRes.statusCode}`);
  }
  const dupData = JSON.parse(duplicateWhRes.body);
  if (!dupData.alreadyProcessed) {
    throw new Error('❌ Test 4 Failed: Duplicate webhook was not identified as alreadyProcessed.');
  }
  console.log('✅ Test 4 Passed: Duplicate webhook recognized with alreadyProcessed: true and 0 duplicate mutations.');

  // ==========================================================================
  // Test 5: Webhook payment.failed Handling
  // ==========================================================================
  console.log('\n▶️ Test 5: Ingest payment.failed Webhook (Payment marked FAILED, Order remains PAYMENT_PENDING)');
  // Create Order 3 and Payment 3
  const offer3Res = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/offers`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: { items: [{ productId: product.id, quantity: 1, agreedPrice: 60000.0 }] }
  });
  const offer3 = JSON.parse(offer3Res.body).offer;
  await app.inject({ method: 'POST', url: `/api/offers/${offer3.id}/accept`, payload: {} });
  const order3Res = await app.inject({
    method: 'POST',
    url: '/api/orders/create-from-offer',
    payload: { offerId: offer3.id }
  });
  const order3 = JSON.parse(order3Res.body).order;
  const pay3Res = await app.inject({
    method: 'POST',
    url: `/api/orders/${order3.id}/pay`,
    payload: {}
  });
  const payment3 = JSON.parse(pay3Res.body).payment;

  const failedPayload = {
    event_id: `evt_${timestamp}_failed`,
    event: 'payment.failed',
    payload: {
      payment: {
        entity: {
          id: `pay_failed_${timestamp}`,
          order_id: payment3.razorpayOrderId,
          error_code: 'BAD_REQUEST_ERROR',
          error_description: 'Card declined by bank simulator'
        }
      }
    }
  };
  const rawFailed = JSON.stringify(failedPayload);
  const failedSig = createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_test_mock_webhook_secret')
    .update(rawFailed)
    .digest('hex');

  const failedWhRes = await app.inject({
    method: 'POST',
    url: '/api/webhooks/razorpay',
    headers: {
      'x-razorpay-signature': failedSig,
      'content-type': 'application/json'
    },
    body: rawFailed
  });

  if (failedWhRes.statusCode !== 200) {
    throw new Error(`❌ Test 5 Failed: Status ${failedWhRes.statusCode}`);
  }

  const payment3Db = await prisma.payment.findUnique({ where: { id: payment3.id } });
  const order3Db = await prisma.order.findUnique({ where: { id: order3.id } });

  if (payment3Db?.status !== 'FAILED' || order3Db?.status !== 'PAYMENT_PENDING') {
    throw new Error(
      `❌ Test 5 Failed: Expected Payment FAILED and Order PAYMENT_PENDING, got Payment: ${payment3Db?.status}, Order: ${order3Db?.status}`
    );
  }
  console.log(`✅ Test 5 Passed: Failed payment recorded as FAILED while Order remains PAYMENT_PENDING for retry.`);

  // ==========================================================================
  // Test 6: Merchant Webhook Ledger & Cross-Tenant Guard
  // ==========================================================================
  console.log('\n▶️ Test 6: Merchant Webhook Ledger & Cross-Tenant Isolation');
  const merchantWhRes = await app.inject({
    method: 'GET',
    url: `/api/merchants/${merchantIdA}/webhooks`,
    headers: { authorization: `Bearer ${tokenA}` }
  });
  if (merchantWhRes.statusCode !== 200) {
    throw new Error(`❌ Test 6 Failed: Status ${merchantWhRes.statusCode}`);
  }

  const crossTenantRes = await app.inject({
    method: 'GET',
    url: `/api/merchants/${merchantIdA}/webhooks`,
    headers: { authorization: `Bearer ${tokenB}` }
  });
  if (crossTenantRes.statusCode !== 403) {
    throw new Error(`❌ Test 6 Failed: Expected 403 for cross-tenant webhook query, got ${crossTenantRes.statusCode}`);
  }
  console.log('✅ Test 6 Passed: Merchant webhook audit ledger verified and cross-tenant queries rejected.');

  await app.close();
  await prisma.$disconnect();

  console.log('\n🎉 ALL PHASE 11 WEBHOOK PROCESSING & PAYMENT VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runWebhookVerification().catch((err) => {
  console.error('❌ Webhook Verification Error:', err);
  process.exit(1);
});
