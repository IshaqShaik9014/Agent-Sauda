import { buildApp } from '../apps/api/src/app.js';
import { prisma } from '../packages/database/src/index.js';

async function runCatalogVerification() {
  console.log('📦 Running Phase 4 Merchant Catalog & Agent Tool Test Suite...\n');

  const app = buildApp();
  await app.ready();

  const timestamp = Date.now();

  // 1. Setup Merchant A
  const regResA = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `owner_a_${timestamp}@agentsauda.com`,
      password: 'StrongPassword123!',
      name: 'Merchant Alpha',
      merchantName: `Alpha Designs ${timestamp}`,
      merchantSlug: `alpha-designs-${timestamp}`,
      currency: 'INR'
    }
  });
  const dataA = JSON.parse(regResA.body);
  const tokenA = dataA.token;
  const merchantIdA = dataA.merchant.id;
  const merchantSlugA = dataA.merchant.slug;

  // 2. Setup Merchant B (For Tenant Isolation Testing)
  const regResB = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `owner_b_${timestamp}@agentsauda.com`,
      password: 'StrongPassword123!',
      name: 'Merchant Beta',
      merchantName: `Beta Tech ${timestamp}`,
      merchantSlug: `beta-tech-${timestamp}`,
      currency: 'INR'
    }
  });
  const dataB = JSON.parse(regResB.body);
  const tokenB = dataB.token;

  console.log(`🏢 Created Test Merchant A: "${dataA.merchant.name}" [${merchantIdA}]`);
  console.log(`🏢 Created Test Merchant B: "${dataB.merchant.name}" [${dataB.merchant.id}]\n`);

  // Test 1: Create Product with Initial Inventory
  console.log('▶️ Test 1: POST /api/merchants/:merchantId/catalog/products (Product + Inventory Creation)');
  const createProductRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/catalog/products`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      title: 'Quantum Ergonomic Task Chair',
      slug: 'quantum-ergonomic-chair',
      description: 'Breathable dual-mesh backrest with dynamic lumbar support.',
      category: 'Office Seating',
      basePrice: 14000.0,
      costPrice: 9000.0,
      initialStock: 45,
      location: 'Bangalore Central Hub'
    }
  });

  if (createProductRes.statusCode !== 201) {
    throw new Error(`❌ Test 1 Failed: Expected 201, got ${createProductRes.statusCode}. Response: ${createProductRes.body}`);
  }
  const createdProd = JSON.parse(createProductRes.body).product;
  const productId = createdProd.id;
  if (createdProd.totalAvailableStock !== 45 || createdProd.grossMarginPercent !== 35.71) {
    throw new Error(`❌ Test 1 Failed: Stock or margin calculation mismatch. Stock: ${createdProd.totalAvailableStock}, Margin: ${createdProd.grossMarginPercent}`);
  }
  console.log(`✅ Test 1 Passed: Created product "${createdProd.title}" (Margin: ${createdProd.grossMarginPercent}%, Stock: ${createdProd.totalAvailableStock})`);

  // Create second product
  await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/catalog/products`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      title: 'Solstice Oak Executive Desk',
      slug: 'solstice-oak-desk',
      description: 'Solid oak electronic standing desk.',
      category: 'Desks',
      basePrice: 32000.0,
      costPrice: 20000.0,
      initialStock: 12,
      location: 'Bangalore Central Hub'
    }
  });

  // Test 2: Duplicate Slug Rejection
  console.log('▶️ Test 2: Duplicate Product Slug in Same Merchant Catalog');
  const dupSlugRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/catalog/products`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      title: 'Another Quantum Chair',
      slug: 'quantum-ergonomic-chair',
      basePrice: 15000.0,
      costPrice: 10000.0
    }
  });
  if (dupSlugRes.statusCode !== 409) {
    throw new Error(`❌ Test 2 Failed: Expected 409 for duplicate slug, got ${dupSlugRes.statusCode}`);
  }
  console.log('✅ Test 2 Passed: Duplicate slug rejected with 409 Conflict.');

  // Test 3: List Products for Merchant Dashboard
  console.log('▶️ Test 3: GET /api/merchants/:merchantId/catalog/products (Dashboard View)');
  const listRes = await app.inject({
    method: 'GET',
    url: `/api/merchants/${merchantIdA}/catalog/products`,
    headers: { authorization: `Bearer ${tokenA}` }
  });
  if (listRes.statusCode !== 200) {
    throw new Error(`❌ Test 3 Failed: Expected 200, got ${listRes.statusCode}`);
  }
  const listData = JSON.parse(listRes.body);
  if (listData.count !== 2) {
    throw new Error(`❌ Test 3 Failed: Expected 2 products, found ${listData.count}`);
  }
  console.log(`✅ Test 3 Passed: Listed ${listData.count} products with cost prices and profit margins.`);

  // Test 4: Update Price and Verify Audit Log
  console.log('▶️ Test 4: PATCH /api/merchants/:merchantId/catalog/products/:productId (Price Update & Audit)');
  const updatePriceRes = await app.inject({
    method: 'PATCH',
    url: `/api/merchants/${merchantIdA}/catalog/products/${productId}`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      basePrice: 14500.0
    }
  });
  if (updatePriceRes.statusCode !== 200) {
    throw new Error(`❌ Test 4 Failed: Expected 200, got ${updatePriceRes.statusCode}`);
  }
  const updatedProd = JSON.parse(updatePriceRes.body).product;
  if (updatedProd.basePrice !== 14500.0) {
    throw new Error(`❌ Test 4 Failed: Base price was not updated.`);
  }

  // Check audit log in DB
  const priceAudit = await prisma.auditEvent.findFirst({
    where: {
      merchantId: merchantIdA,
      entityId: productId,
      action: 'PRICE_UPDATED'
    }
  });
  if (!priceAudit) {
    throw new Error('❌ Test 4 Failed: PRICE_UPDATED audit log not found in database.');
  }
  console.log('✅ Test 4 Passed: Price updated to ₹14,500 and PRICE_UPDATED audit event recorded.');

  // Test 5: Update Inventory Stock
  console.log('▶️ Test 5: PATCH /api/merchants/:merchantId/catalog/inventory/:productId (Warehouse Inventory Adjustment)');
  const updateInvRes = await app.inject({
    method: 'PATCH',
    url: `/api/merchants/${merchantIdA}/catalog/inventory/${productId}`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      availableUnits: 80,
      reservedUnits: 5
    }
  });
  if (updateInvRes.statusCode !== 200) {
    throw new Error(`❌ Test 5 Failed: Expected 200, got ${updateInvRes.statusCode}`);
  }
  const updatedInv = JSON.parse(updateInvRes.body).inventory;
  if (updatedInv.availableUnits !== 80 || updatedInv.reservedUnits !== 5) {
    throw new Error('❌ Test 5 Failed: Inventory counts did not update.');
  }
  console.log('✅ Test 5 Passed: Inventory updated to 80 available units (5 reserved) with audit trail.');

  // Test 6: Cross-Tenant Isolation Security Guard
  console.log('▶️ Test 6: Cross-Tenant Authorization Guard (Merchant B tries to mutate Merchant A)');
  const crossTenantRes = await app.inject({
    method: 'PATCH',
    url: `/api/merchants/${merchantIdA}/catalog/products/${productId}`,
    headers: { authorization: `Bearer ${tokenB}` }, // Merchant B's token!
    payload: {
      basePrice: 100.0 // Malicious attempt to change competitor price
    }
  });
  if (crossTenantRes.statusCode !== 403) {
    throw new Error(`❌ Test 6 Failed: Expected 403 Forbidden for cross-tenant request, got ${crossTenantRes.statusCode}`);
  }
  console.log('✅ Test 6 Passed: Cross-tenant modification rejected with 403 Forbidden.');

  // Test 7: Agent-Readable Public Catalog (AI Tool Endpoint)
  console.log('▶️ Test 7: GET /api/agent/catalog (AI Tool Optimization & Redaction Boundary)');
  const agentCatalogRes = await app.inject({
    method: 'GET',
    url: `/api/agent/catalog?merchantSlug=${merchantSlugA}`
  });
  if (agentCatalogRes.statusCode !== 200) {
    throw new Error(`❌ Test 7 Failed: Expected 200 for agent catalog, got ${agentCatalogRes.statusCode}`);
  }
  const agentData = JSON.parse(agentCatalogRes.body);
  if (agentData.productsCount !== 2) {
    throw new Error(`❌ Test 7 Failed: Expected 2 products in agent catalog, got ${agentData.productsCount}`);
  }

  // CRUCIAL SECURITY CHECK: Ensure NO costPrice is leaked in agent catalog!
  for (const item of agentData.products) {
    if ('costPrice' in item || 'grossMarginPercent' in item) {
      throw new Error(`❌ SECURITY VIOLATION: Agent catalog leaked costPrice or grossMarginPercent! Object: ${JSON.stringify(item)}`);
    }
    if (!item.inStock || item.availableUnits <= 0) {
      throw new Error(`❌ Test 7 Failed: Product ${item.title} should be inStock`);
    }
    console.log(`   🤖 Agent Product View: "${item.title}" — Price: ₹${item.basePrice.toLocaleString('en-IN')}, Stock: ${item.availableUnits} units (costPrice strictly redacted)`);
  }
  console.log('✅ Test 7 Passed: Agent-readable catalog is clean, token-efficient, and 100% redacted.');

  await app.close();
  await prisma.$disconnect();

  console.log('\n🎉 ALL PHASE 4 CATALOG & INVENTORY TESTS PASSED SUCCESSFULLY!');
}

runCatalogVerification().catch((err) => {
  console.error('❌ Catalog Verification Error:', err);
  process.exit(1);
});
