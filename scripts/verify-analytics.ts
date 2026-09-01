import { buildApp } from '../apps/api/src/app.js';
import { prisma } from '../packages/database/src/index.js';

async function runAnalyticsVerification() {
  console.log('📊 Running Phase 14 Merchant Analytics & Negotiation Performance Test Suite...\n');

  const app = buildApp();
  await app.ready();

  const timestamp = Date.now();

  // 1. Setup Merchant A (Dick Jones - Omni Consumer Products)
  const regResA = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `dick_jones_${timestamp}@ocp-sauda.com`,
      password: 'StrongPassword123!',
      name: 'Dick Jones',
      merchantName: `Omni Consumer Products ${timestamp}`,
      merchantSlug: `ocp-analytics-${timestamp}`,
      currency: 'INR'
    }
  });
  const dataA = JSON.parse(regResA.body);
  const tokenA = dataA.token;
  const merchantIdA = dataA.merchant.id;

  // Setup Merchant B (Delta City Competitor)
  const regResB = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `bob_morton_${timestamp}@deltacity-sauda.com`,
      password: 'StrongPassword123!',
      name: 'Bob Morton',
      merchantName: `Delta City Corp ${timestamp}`,
      merchantSlug: `delta-city-${timestamp}`,
      currency: 'INR'
    }
  });
  const tokenB = JSON.parse(regResB.body).token;

  console.log(`🏢 Created Merchant: "${dataA.merchant.name}" [${merchantIdA}]`);

  // Configure Policy with autonomous limit of ₹500,000
  await app.inject({
    method: 'PUT',
    url: `/api/merchants/${merchantIdA}/policy`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      maxDiscountPercent: 20.0,
      minimumMarginPercent: 15.0,
      autonomousOrderLimit: 500000.0
    }
  });

  // 2. Seed Products
  // Product 1: ED-209 (Base: ₹150,000, Cost: ₹90,000)
  const prod1Res = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/catalog/products`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      title: 'ED-209 Enforcement Droid',
      slug: 'ed-209-droid',
      description: 'Urban pacification enforcement droid.',
      category: 'Robotics',
      basePrice: 150000.0,
      costPrice: 90000.0,
      initialStock: 5,
      location: 'OCP Hangar 1'
    }
  });
  const prod1 = JSON.parse(prod1Res.body).product;

  // Product 2: Titanium Armor (Base: ₹50,000, Cost: ₹25,000)
  const prod2Res = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/catalog/products`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      title: 'Titanium Armor Plating',
      slug: 'titanium-armor-plating',
      description: 'Reinforced ballistic body armor.',
      category: 'Armor',
      basePrice: 50000.0,
      costPrice: 25000.0,
      initialStock: 10,
      location: 'OCP Armory'
    }
  });
  const prod2 = JSON.parse(prod2Res.body).product;

  console.log(`🤖 Seeded Catalog: "${prod1.title}" and "${prod2.title}"\n`);

  // 3. Create Commercial History:
  // Deal 1: 1 unit ED-209 @ ₹140,000 (Accepted -> Order 1 -> Paid -> Completed)
  const offer1Res = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/offers`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: { items: [{ productId: prod1.id, quantity: 1, agreedPrice: 140000.0 }] }
  });
  const offer1 = JSON.parse(offer1Res.body).offer;
  await app.inject({ method: 'POST', url: `/api/offers/${offer1.id}/accept`, payload: {} });
  const order1Res = await app.inject({
    method: 'POST',
    url: '/api/orders/create-from-offer',
    payload: { offerId: offer1.id }
  });
  const order1 = JSON.parse(order1Res.body).order;
  const pay1Res = await app.inject({ method: 'POST', url: `/api/orders/${order1.id}/pay`, payload: {} });
  const payment1 = JSON.parse(pay1Res.body).payment;
  await app.inject({
    method: 'POST',
    url: '/api/payments/verify',
    payload: {
      orderId: order1.id,
      razorpayOrderId: payment1.razorpayOrderId,
      razorpayPaymentId: `pay_mock_${timestamp}_1`,
      razorpaySignature: 'mock_sig_valid'
    }
  });
  await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/orders/${order1.id}/fulfill`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: { trackingNumber: 'OCP-AIR-001', carrier: 'OCP Logistics' }
  });

  // Deal 2: 2 units Armor @ ₹45,000 each = ₹90,000 (Accepted -> Order 2 -> Paid)
  const offer2Res = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/offers`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: { items: [{ productId: prod2.id, quantity: 2, agreedPrice: 45000.0 }] }
  });
  const offer2 = JSON.parse(offer2Res.body).offer;
  await app.inject({ method: 'POST', url: `/api/offers/${offer2.id}/accept`, payload: {} });
  const order2Res = await app.inject({
    method: 'POST',
    url: '/api/orders/create-from-offer',
    payload: { offerId: offer2.id }
  });
  const order2 = JSON.parse(order2Res.body).order;
  const pay2Res = await app.inject({ method: 'POST', url: `/api/orders/${order2.id}/pay`, payload: {} });
  const payment2 = JSON.parse(pay2Res.body).payment;
  await app.inject({
    method: 'POST',
    url: '/api/payments/verify',
    payload: {
      orderId: order2.id,
      razorpayOrderId: payment2.razorpayOrderId,
      razorpayPaymentId: `pay_mock_${timestamp}_2`,
      razorpaySignature: 'mock_sig_valid'
    }
  });

  // Deal 3: HITL Approval Workflow
  const offer3Res = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/offers`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: { items: [{ productId: prod1.id, quantity: 1, agreedPrice: 135000.0 }], forceDraft: true }
  });
  const offer3 = JSON.parse(offer3Res.body).offer;
  const approvalRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/approvals`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: { offerId: offer3.id, requestReason: 'VIP Corporate discount request' }
  });
  const approval = JSON.parse(approvalRes.body).approval;
  await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/approvals/${approval.id}/approve`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: { resolutionNotes: 'Approved by VP Dick Jones' }
  });

  // Deal 4: Truly Rejected Offer
  const offer4Res = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/offers`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: { items: [{ productId: prod2.id, quantity: 1, agreedPrice: 30000.0 }] }
  });
  const offer4 = JSON.parse(offer4Res.body).offer;
  await app.inject({
    method: 'POST',
    url: `/api/offers/${offer4.id}/reject`,
    payload: { reason: 'Customer found price too high' }
  });

  console.log('📈 Commercial seed dataset finalized (2 Paid Orders, 1 Approved Quote, 1 Rejected Offer).\n');

  // ==========================================================================
  // Test 1: Commercial Revenue & Margin KPIs
  // ==========================================================================
  console.log('▶️ Test 1: GET /api/merchants/:merchantId/analytics/overview');
  const overviewRes = await app.inject({
    method: 'GET',
    url: `/api/merchants/${merchantIdA}/analytics/overview`,
    headers: { authorization: `Bearer ${tokenA}` }
  });

  if (overviewRes.statusCode !== 200) {
    throw new Error(`❌ Test 1 Failed: Status ${overviewRes.statusCode}. Response: ${overviewRes.body}`);
  }
  const kpis = JSON.parse(overviewRes.body).kpis;

  // Expected: ₹140,000 (ED-209) + ₹90,000 (2 Armor) = ₹230,000 Gross Revenue
  // Cost: ₹90,000 (ED-209) + ₹50,000 (2 Armor) = ₹140,000 Total Cost
  // Profit: ₹230,000 - ₹140,000 = ₹90,000 Gross Profit
  // Margin %: 90,000 / 230,000 = ~39.13%
  if (kpis.grossRevenue !== 230000 || kpis.netGrossProfit !== 90000 || kpis.paidOrdersCount !== 2) {
    throw new Error(`❌ Test 1 Failed: Unexpected commercial KPIs: ${JSON.stringify(kpis)}`);
  }
  console.log(
    `✅ Test 1 Passed: Gross Revenue ₹${kpis.grossRevenue.toLocaleString('en-IN')}, Profit ₹${kpis.netGrossProfit.toLocaleString('en-IN')}, Realized Margin: ${kpis.averageMarginPercent}% across ${kpis.paidOrdersCount} paid orders.`
  );

  // ==========================================================================
  // Test 2: AI Negotiation Funnel & Win Rate
  // ==========================================================================
  console.log('\n▶️ Test 2: GET /api/merchants/:merchantId/analytics/negotiations');
  const negRes = await app.inject({
    method: 'GET',
    url: `/api/merchants/${merchantIdA}/analytics/negotiations`,
    headers: { authorization: `Bearer ${tokenA}` }
  });

  if (negRes.statusCode !== 200) {
    throw new Error(`❌ Test 2 Failed: Status ${negRes.statusCode}`);
  }
  const neg = JSON.parse(negRes.body).negotiations;
  if (neg.totalOffersProposed < 4 || neg.acceptedOffersCount !== 2 || neg.rejectedOffersCount !== 1) {
    throw new Error(`❌ Test 2 Failed: Unexpected negotiation metrics: ${JSON.stringify(neg)}`);
  }
  console.log(
    `✅ Test 2 Passed: Win Rate: ${neg.negotiationWinRatePercent}% (${neg.acceptedOffersCount} accepted / ${neg.totalOffersProposed} proposed), Average Discount: ${neg.averageDiscountPercent}%.`
  );

  // ==========================================================================
  // Test 3: HITL Manager Approval Turnaround Metrics
  // ==========================================================================
  console.log('\n▶️ Test 3: GET /api/merchants/:merchantId/analytics/approvals');
  const appRes = await app.inject({
    method: 'GET',
    url: `/api/merchants/${merchantIdA}/analytics/approvals`,
    headers: { authorization: `Bearer ${tokenA}` }
  });

  if (appRes.statusCode !== 200) {
    throw new Error(`❌ Test 3 Failed: Status ${appRes.statusCode}`);
  }
  const approvalsData = JSON.parse(appRes.body).approvals;
  if (approvalsData.totalApprovalsRequested < 1 || approvalsData.approvedCount < 1 || approvalsData.approvalRatePercent !== 100) {
    throw new Error(`❌ Test 3 Failed: Unexpected approval metrics: ${JSON.stringify(approvalsData)}`);
  }
  console.log(
    `✅ Test 3 Passed: Approval Rate: ${approvalsData.approvalRatePercent}%, Avg Resolution: ${approvalsData.averageResolutionTimeMinutes} min.`
  );

  // ==========================================================================
  // Test 4: Top Negotiated Products Ranking
  // ==========================================================================
  console.log('\n▶️ Test 4: GET /api/merchants/:merchantId/analytics/top-products');
  const topProdRes = await app.inject({
    method: 'GET',
    url: `/api/merchants/${merchantIdA}/analytics/top-products`,
    headers: { authorization: `Bearer ${tokenA}` }
  });

  if (topProdRes.statusCode !== 200) {
    throw new Error(`❌ Test 4 Failed: Status ${topProdRes.statusCode}`);
  }
  const topProducts = JSON.parse(topProdRes.body).products;
  if (topProducts.length < 2 || topProducts[0].productId !== prod1.id || topProducts[0].totalRevenue !== 140000) {
    throw new Error(`❌ Test 4 Failed: Unexpected top products ranking: ${JSON.stringify(topProducts)}`);
  }
  console.log(
    `✅ Test 4 Passed: Top product #1: "${topProducts[0].title}" (Revenue: ₹${topProducts[0].totalRevenue.toLocaleString('en-IN')}).`
  );

  // ==========================================================================
  // Test 5: Complete Executive Analytics Dashboard
  // ==========================================================================
  console.log('\n▶️ Test 5: GET /api/merchants/:merchantId/analytics/dashboard');
  const dashRes = await app.inject({
    method: 'GET',
    url: `/api/merchants/${merchantIdA}/analytics/dashboard`,
    headers: { authorization: `Bearer ${tokenA}` }
  });

  if (dashRes.statusCode !== 200) {
    throw new Error(`❌ Test 5 Failed: Status ${dashRes.statusCode}`);
  }
  const dash = JSON.parse(dashRes.body).dashboard;
  if (!dash.commercialKPIs || !dash.negotiationAnalytics || !dash.approvalPerformance || !dash.topProducts) {
    throw new Error(`❌ Test 5 Failed: Missing dashboard sections: ${JSON.stringify(dash)}`);
  }
  console.log('✅ Test 5 Passed: Full multi-dimensional executive dashboard payload verified.');

  // ==========================================================================
  // Test 6: Cross-Tenant Isolation Guard
  // ==========================================================================
  console.log('\n▶️ Test 6: Cross-Tenant Guard (Merchant B cannot view Merchant A analytics)');
  const crossTenantRes = await app.inject({
    method: 'GET',
    url: `/api/merchants/${merchantIdA}/analytics/dashboard`,
    headers: { authorization: `Bearer ${tokenB}` }
  });
  if (crossTenantRes.statusCode !== 403) {
    throw new Error(`❌ Test 6 Failed: Expected 403 Forbidden, got ${crossTenantRes.statusCode}`);
  }
  console.log('✅ Test 6 Passed: Cross-tenant analytics query rejected with 403 Forbidden.');

  await app.close();
  await prisma.$disconnect();

  console.log('\n🎉 ALL PHASE 14 MERCHANT ANALYTICS & KPI TESTS PASSED SUCCESSFULLY!');
}

runAnalyticsVerification().catch((err) => {
  console.error('❌ Analytics Verification Error:', err);
  process.exit(1);
});
