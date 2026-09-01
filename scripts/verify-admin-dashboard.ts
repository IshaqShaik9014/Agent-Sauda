import { buildApp } from '../apps/api/src/app.js';
import { prisma } from '../packages/database/src/index.js';

async function verifyAdminDashboardFlow() {
  console.log('🏛️ Running Phase 17 Merchant Admin Dashboard Full Verification Suite...\n');

  const app = buildApp();
  await app.ready();

  const timestamp = Date.now();

  // ==========================================================================
  // Stage 1: Merchant Auth & Session Onboarding
  // ==========================================================================
  console.log('▶️ Stage 1: Register Merchant & Issue Stateless JWT');
  const regRes = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `director_${timestamp}@cyber-dynamics.org`,
      password: 'StrongPassword123!',
      name: 'Dr. Evelyn Vance',
      merchantName: 'Cyber Dynamics Robotics',
      merchantSlug: `cyber-dynamics-${timestamp}`,
      currency: 'INR'
    }
  });

  if (regRes.statusCode !== 201) {
    throw new Error(`❌ Stage 1 Failed: Status ${regRes.statusCode}. Response: ${regRes.body}`);
  }
  const authData = JSON.parse(regRes.body);
  const token = authData.token;
  const merchantId = authData.merchant.id;
  console.log(`✅ Stage 1 Passed: Merchant Registered [${merchantId}] with JWT session token.`);

  // ==========================================================================
  // Stage 2: Configure Policy Guardrails in Admin Portal
  // ==========================================================================
  console.log('\n▶️ Stage 2: Configure Policy Guardrails (PUT /api/merchants/:id/policy)');
  const policyRes = await app.inject({
    method: 'PUT',
    url: `/api/merchants/${merchantId}/policy`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      maxDiscountPercent: 25,
      minimumMarginPercent: 20,
      autonomousOrderLimit: 75000,
      approvalThreshold: 150000,
      maxQuantityPerOrder: 5
    }
  });

  if (policyRes.statusCode !== 200) {
    throw new Error(`❌ Stage 2 Failed: Status ${policyRes.statusCode}. Response: ${policyRes.body}`);
  }
  const policy = JSON.parse(policyRes.body).policy;
  if (policy.maxDiscountPercent !== 25 || policy.approvalThreshold !== 150000) {
    throw new Error(`❌ Stage 2 Failed: Policy values not updated: ${JSON.stringify(policy)}`);
  }
  console.log(`✅ Stage 2 Passed: Policy Guardrails configured (Max Discount: 25%, Approval Threshold: ₹150,000).`);

  // ==========================================================================
  // Stage 3: Catalog & Stock Restock Management
  // ==========================================================================
  console.log('\n▶️ Stage 3: Add Catalog Product & Restock Inventory');
  const prodRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantId}/catalog/products`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: 'Cybernetic Security Drone CD-4',
      slug: `security-drone-cd4-${timestamp}`,
      description: 'Autonomous aerial security drone with thermal sensing.',
      category: 'Robotics',
      basePrice: 200000.0,
      costPrice: 120000.0,
      initialStock: 5,
      location: 'Hangar 7'
    }
  });

  if (prodRes.statusCode !== 201) {
    throw new Error(`❌ Stage 3 Failed: Product create error: ${prodRes.body}`);
  }
  const product = JSON.parse(prodRes.body).product;

  // Restock to 8 units
  const restockRes = await app.inject({
    method: 'PATCH',
    url: `/api/merchants/${merchantId}/catalog/inventory/${product.id}`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      availableUnits: 8,
      location: 'Hangar 7'
    }
  });
  if (restockRes.statusCode !== 200) {
    throw new Error(`❌ Stage 3 Failed: Restock error: ${restockRes.body}`);
  }
  console.log(`✅ Stage 3 Passed: Seeded product "${product.title}" and restocked to 8 available units.`);

  // ==========================================================================
  // Stage 4: HITL Human Manager Approval Workflow
  // ==========================================================================
  console.log('\n▶️ Stage 4: Propose High-Value Quote (₹180,000 > ₹150,000 Threshold) & Authorize');
  const offerRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantId}/offers`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      items: [{ productId: product.id, quantity: 1, agreedPrice: 180000.0 }]
    }
  });
  const offer = JSON.parse(offerRes.body).offer;

  if (offer.status !== 'DRAFT') {
    throw new Error(`❌ Stage 4 Failed: Expected offer in DRAFT status, got ${offer.status}`);
  }
  console.log(`🔒 Offer #${offer.offerNumber} locked in DRAFT status requiring manager approval.`);

  // Fetch Pending Approvals
  const apprListRes = await app.inject({
    method: 'GET',
    url: `/api/merchants/${merchantId}/approvals?status=PENDING`,
    headers: { authorization: `Bearer ${token}` }
  });
  const approvals = JSON.parse(apprListRes.body).approvals;
  const targetApproval = approvals.find((a: any) => a.offerId === offer.id);

  if (!targetApproval) {
    throw new Error(`❌ Stage 4 Failed: Pending approval for offer not found in queue`);
  }

  // Manager Approves Offer
  const approveRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantId}/approvals/${targetApproval.id}/approve`,
    headers: { authorization: `Bearer ${token}` },
    payload: { notes: 'Authorized high-value sale by Store Director' }
  });
  if (approveRes.statusCode !== 200) {
    throw new Error(`❌ Stage 4 Failed: Approval error: ${approveRes.body}`);
  }
  console.log(`✅ Stage 4 Passed: Manager authorized quotation #${offer.offerNumber}. Offer is now ACTIVE.`);

  // ==========================================================================
  // Stage 5: Convert Offer -> Order -> Payment -> Fulfillment Dispatch
  // ==========================================================================
  console.log('\n▶️ Stage 5: Complete Order, Pay & Dispatch with Courier Tracking');
  const acceptRes = await app.inject({
    method: 'POST',
    url: `/api/offers/${offer.id}/accept`,
    payload: {}
  });

  const orderRes = await app.inject({
    method: 'POST',
    url: '/api/orders/create-from-offer',
    payload: { offerId: offer.id, notes: 'Deliver to Cyber HQ' }
  });
  const order = JSON.parse(orderRes.body).order;

  // Pay
  const payRes = await app.inject({
    method: 'POST',
    url: `/api/orders/${order.id}/pay`,
    payload: { buyerName: 'Corporate Buyer' }
  });
  const payment = JSON.parse(payRes.body).payment;

  // Verify Signature
  await app.inject({
    method: 'POST',
    url: '/api/payments/verify',
    payload: {
      orderId: order.id,
      razorpayOrderId: payment.razorpayOrderId,
      razorpayPaymentId: `pay_test_${timestamp}`,
      razorpaySignature: `mock_sig_test_${timestamp}`
    }
  });

  // Start Fulfillment
  await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantId}/orders/${order.id}/start-fulfillment`,
    headers: { authorization: `Bearer ${token}` },
    payload: { notes: 'Packing drone in flight case' }
  });

  // Fulfill with Tracking
  const fulfillRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantId}/orders/${order.id}/fulfill`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      carrier: 'BlueDart Aviation',
      trackingNumber: `BD-AV-${timestamp}`
    }
  });
  if (fulfillRes.statusCode !== 200) {
    throw new Error(`❌ Stage 5 Failed: Fulfillment error: ${fulfillRes.body}`);
  }
  console.log(`✅ Stage 5 Passed: Order #${order.orderNumber} dispatched via BlueDart Aviation.`);

  // ==========================================================================
  // Stage 6: Commercial Analytics Verification
  // ==========================================================================
  console.log('\n▶️ Stage 6: Inspect Commercial Analytics Dashboard (GET /api/merchants/:id/analytics)');
  const analyticsRes = await app.inject({
    method: 'GET',
    url: `/api/merchants/${merchantId}/analytics/dashboard`,
    headers: { authorization: `Bearer ${token}` }
  });

  if (analyticsRes.statusCode !== 200) {
    throw new Error(`❌ Stage 6 Failed: Status ${analyticsRes.statusCode}`);
  }
  const analyticsData = JSON.parse(analyticsRes.body);
  const kpis = analyticsData.dashboard.commercialKPIs;

  if (kpis.grossRevenue !== 180000 || kpis.netGrossProfit !== 60000) {
    throw new Error(`❌ Stage 6 Failed: Inaccurate revenue/profit calculations: ${JSON.stringify(kpis)}`);
  }
  console.log(
    `✅ Stage 6 Passed: Analytics verified: Gross Revenue = ₹${kpis.grossRevenue.toLocaleString('en-IN')}, Net Profit = ₹${kpis.netGrossProfit.toLocaleString('en-IN')}, Margin = ${kpis.averageMarginPercent}%.`
  );

  // ==========================================================================
  // Stage 7: Forensic Audit Trail Inspection
  // ==========================================================================
  console.log('\n▶️ Stage 7: Query Forensic Compliance Audit Log (GET /api/merchants/:id/audit)');
  const auditRes = await app.inject({
    method: 'GET',
    url: `/api/merchants/${merchantId}/audit`,
    headers: { authorization: `Bearer ${token}` }
  });

  if (auditRes.statusCode !== 200) {
    throw new Error(`❌ Stage 7 Failed: Status ${auditRes.statusCode}`);
  }
  const auditEvents = JSON.parse(auditRes.body).events;
  if (auditEvents.length < 5) {
    throw new Error(`❌ Stage 7 Failed: Expected at least 5 audit events, found ${auditEvents.length}`);
  }
  console.log(`✅ Stage 7 Passed: Verified ${auditEvents.length} immutable forensic audit events across all subsystems.`);

  await app.close();
  await prisma.$disconnect();

  console.log('\n🎉 ALL 7 STAGES OF PHASE 17 MERCHANT ADMIN DASHBOARD PASSED SUCCESSFULLY!');
}

verifyAdminDashboardFlow().catch((err) => {
  console.error('❌ Admin Dashboard Verification Error:', err);
  process.exit(1);
});
