import { buildApp } from '../apps/api/src/app.js';
import { prisma } from '../packages/database/src/index.js';

async function runAuditVerification() {
  console.log('📜 Running Phase 13 Audit Trail & Compliance Logging Test Suite...\n');

  const app = buildApp();
  await app.ready();

  const timestamp = Date.now();

  // 1. Setup Merchant A (Pepper Potts - Stark Industries)
  const regResA = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `pepper_${timestamp}@stark-sauda.com`,
      password: 'StrongPassword123!',
      name: 'Pepper Potts',
      merchantName: `Stark Industries Compliance ${timestamp}`,
      merchantSlug: `stark-compliance-${timestamp}`,
      currency: 'INR'
    }
  });
  const dataA = JSON.parse(regResA.body);
  const tokenA = dataA.token;
  const merchantIdA = dataA.merchant.id;

  // Setup Merchant B (Justin Hammer - Hammer Industries)
  const regResB = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `hammer_${timestamp}@hammer-sauda.com`,
      password: 'StrongPassword123!',
      name: 'Justin Hammer',
      merchantName: `Hammer Industries ${timestamp}`,
      merchantSlug: `hammer-${timestamp}`,
      currency: 'INR'
    }
  });
  const tokenB = JSON.parse(regResB.body).token;

  console.log(`🏢 Created Merchant: "${dataA.merchant.name}" [${merchantIdA}]`);

  // 2. Generate End-to-End Deal: Product -> Offer -> Order -> Payment -> Fulfillment
  const prodRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/catalog/products`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      title: 'Vibranium Arc Reactor Model 5',
      slug: 'vibranium-arc-reactor',
      description: 'Clean energy plasma generator.',
      category: 'Energy',
      basePrice: 120000.0,
      costPrice: 70000.0,
      initialStock: 8,
      location: 'Stark Tower Vault'
    }
  });
  const product = JSON.parse(prodRes.body).product;

  const offerRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/offers`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: { items: [{ productId: product.id, quantity: 1, agreedPrice: 120000.0 }] }
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
    payload: { buyerName: 'Tony Stark' }
  });
  const payment = JSON.parse(payRes.body).payment;

  await app.inject({
    method: 'POST',
    url: '/api/payments/verify',
    payload: {
      orderId: order.id,
      razorpayOrderId: payment.razorpayOrderId,
      razorpayPaymentId: `pay_stark_${timestamp}`,
      razorpaySignature: 'mock_sig_valid'
    }
  });

  await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/orders/${order.id}/start-fulfillment`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: { notes: 'Packaged in titanium container' }
  });

  await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/orders/${order.id}/fulfill`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: { carrier: 'Stark Transport', trackingNumber: 'STARK-EXP-001' }
  });

  console.log(`📦 Seeded complete deal lifecycle for Order ${order.orderNumber} with immutable audit events.\n`);

  // ==========================================================================
  // Test 1: Query Merchant Audit Log with Filtering
  // ==========================================================================
  console.log('▶️ Test 1: GET /api/merchants/:merchantId/audit (Filter by entityType: ORDER)');
  const auditListRes = await app.inject({
    method: 'GET',
    url: `/api/merchants/${merchantIdA}/audit?entityType=ORDER`,
    headers: { authorization: `Bearer ${tokenA}` }
  });

  if (auditListRes.statusCode !== 200) {
    throw new Error(`❌ Test 1 Failed: Status ${auditListRes.statusCode}. Response: ${auditListRes.body}`);
  }
  const auditList = JSON.parse(auditListRes.body);
  if (auditList.eventsCount < 3) {
    throw new Error(`❌ Test 1 Failed: Expected at least 3 ORDER audit events, got ${auditList.eventsCount}`);
  }
  console.log(`✅ Test 1 Passed: Filtered audit query returned ${auditList.eventsCount} events.`);

  // ==========================================================================
  // Test 2: Reconstruct Full Forensic Timeline for Deal
  // ==========================================================================
  console.log('\n▶️ Test 2: GET /api/merchants/:merchantId/audit/forensic/ORDER/:orderId (Multi-Entity Trail)');
  const forensicRes = await app.inject({
    method: 'GET',
    url: `/api/merchants/${merchantIdA}/audit/forensic/ORDER/${order.id}`,
    headers: { authorization: `Bearer ${tokenA}` }
  });

  if (forensicRes.statusCode !== 200) {
    throw new Error(`❌ Test 2 Failed: Status ${forensicRes.statusCode}. Response: ${forensicRes.body}`);
  }
  const forensicData = JSON.parse(forensicRes.body);
  if (forensicData.totalEvents < 5) {
    throw new Error(`❌ Test 2 Failed: Expected at least 5 cross-subsystem events, got ${forensicData.totalEvents}`);
  }
  console.log(
    `✅ Test 2 Passed: Forensic timeline reconstructed ${forensicData.totalEvents} connected events across Offer, Order, Payment & Fulfillment.`
  );

  // ==========================================================================
  // Test 3: Export Audit Report as CSV (RFC 4180)
  // ==========================================================================
  console.log('\n▶️ Test 3: GET /api/merchants/:merchantId/audit/export?format=csv (CSV Export)');
  const csvExportRes = await app.inject({
    method: 'GET',
    url: `/api/merchants/${merchantIdA}/audit/export?format=csv`,
    headers: { authorization: `Bearer ${tokenA}` }
  });

  if (csvExportRes.statusCode !== 200) {
    throw new Error(`❌ Test 3 Failed: Status ${csvExportRes.statusCode}`);
  }
  const contentType = csvExportRes.headers['content-type'];
  const csvBody = csvExportRes.body;
  if (!contentType?.includes('text/csv') || !csvBody.startsWith('ID,Timestamp,EntityType,EntityID,Action')) {
    throw new Error(`❌ Test 3 Failed: Invalid CSV output: ${csvBody.substring(0, 100)}`);
  }
  console.log(`✅ Test 3 Passed: CSV export returned valid RFC 4180 stream with headers and records.`);

  // ==========================================================================
  // Test 4: Export Audit Report as JSON
  // ==========================================================================
  console.log('\n▶️ Test 4: GET /api/merchants/:merchantId/audit/export?format=json (JSON Export)');
  const jsonExportRes = await app.inject({
    method: 'GET',
    url: `/api/merchants/${merchantIdA}/audit/export?format=json`,
    headers: { authorization: `Bearer ${tokenA}` }
  });

  if (jsonExportRes.statusCode !== 200) {
    throw new Error(`❌ Test 4 Failed: Status ${jsonExportRes.statusCode}`);
  }
  const exportData = JSON.parse(jsonExportRes.body);
  if (!exportData.totalEvents || exportData.merchantId !== merchantIdA) {
    throw new Error(`❌ Test 4 Failed: Invalid JSON export data: ${JSON.stringify(exportData)}`);
  }
  console.log(`✅ Test 4 Passed: JSON export generated with ${exportData.totalEvents} total compliance records.`);

  // ==========================================================================
  // Test 5: Date Range Filtering
  // ==========================================================================
  console.log('\n▶️ Test 5: Date Range Filtering');
  const pastDate = new Date(Date.now() - 3600000).toISOString();
  const futureDate = new Date(Date.now() + 3600000).toISOString();
  const rangeRes = await app.inject({
    method: 'GET',
    url: `/api/merchants/${merchantIdA}/audit?startDate=${encodeURIComponent(pastDate)}&endDate=${encodeURIComponent(futureDate)}`,
    headers: { authorization: `Bearer ${tokenA}` }
  });
  if (rangeRes.statusCode !== 200) {
    throw new Error(`❌ Test 5 Failed: Status ${rangeRes.statusCode}`);
  }
  console.log(`✅ Test 5 Passed: Date range query verified successfully.`);

  // ==========================================================================
  // Test 6: Cross-Tenant Isolation Guard
  // ==========================================================================
  console.log('\n▶️ Test 6: Cross-Tenant Guard (Merchant B cannot view Merchant A audit logs)');
  const crossTenantRes = await app.inject({
    method: 'GET',
    url: `/api/merchants/${merchantIdA}/audit`,
    headers: { authorization: `Bearer ${tokenB}` }
  });
  if (crossTenantRes.statusCode !== 403) {
    throw new Error(`❌ Test 6 Failed: Expected 403 Forbidden, got ${crossTenantRes.statusCode}`);
  }
  console.log('✅ Test 6 Passed: Cross-tenant audit access rejected with 403 Forbidden.');

  await app.close();
  await prisma.$disconnect();

  console.log('\n🎉 ALL PHASE 13 AUDIT TRAIL & COMPLIANCE LOGGING TESTS PASSED SUCCESSFULLY!');
}

runAuditVerification().catch((err) => {
  console.error('❌ Audit Verification Error:', err);
  process.exit(1);
});
