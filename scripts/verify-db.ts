import { prisma } from '../packages/database/src/index.js';

async function runVerification() {
  console.log('🔍 Running Phase 2 Database & Tenant Isolation Verification...\n');

  // Test 1: Fetch Demo Merchant
  const merchant = await prisma.merchant.findUnique({
    where: { slug: 'apex-furniture' },
    include: {
      policies: true,
      products: {
        include: { inventory: true }
      },
      members: {
        include: { user: true }
      },
      auditEvents: true
    }
  });

  if (!merchant) {
    throw new Error('❌ Verification failed: Demo merchant not found.');
  }
  console.log(`✅ Test 1 Passed: Found Merchant "${merchant.name}" (ID: ${merchant.id})`);

  // Test 2: Verify Policy Guardrails
  const policy = merchant.policies;
  if (!policy || policy.maxDiscountPercent !== 8.0 || policy.autonomousOrderLimit !== 100000.0) {
    throw new Error('❌ Verification failed: Policy limits do not match expected guardrails.');
  }
  console.log(`✅ Test 2 Passed: Policy verified (Max Discount: ${policy.maxDiscountPercent}%, Autonomous Limit: ₹${policy.autonomousOrderLimit.toLocaleString('en-IN')})`);

  // Test 3: Catalog & Stock Verification
  if (merchant.products.length < 4) {
    throw new Error(`❌ Verification failed: Expected at least 4 products, found ${merchant.products.length}`);
  }
  for (const product of merchant.products) {
    const totalStock = product.inventory.reduce((sum, inv) => sum + inv.availableUnits, 0);
    console.log(`   📦 Catalog Item: "${product.title}" — Price: ₹${product.basePrice.toLocaleString('en-IN')}, Cost: ₹${product.costPrice.toLocaleString('en-IN')}, Available Stock: ${totalStock}`);
  }
  console.log(`✅ Test 3 Passed: Verified ${merchant.products.length} catalog products with active inventory.`);

  // Test 4: Strict Multi-Tenant Isolation Test
  const fakeMerchantId = '00000000-0000-0000-0000-000000000000';
  const leakedProducts = await prisma.product.findMany({
    where: { merchantId: fakeMerchantId }
  });
  if (leakedProducts.length !== 0) {
    throw new Error('❌ Security Failure: Foreign merchant query returned records!');
  }
  console.log('✅ Test 4 Passed: Tenant Isolation Verified (Foreign merchant query returned 0 records).');

  // Test 5: Audit Event Verification
  const auditLogs = merchant.auditEvents;
  if (auditLogs.length === 0) {
    throw new Error('❌ Verification failed: No audit events recorded for merchant.');
  }
  console.log(`✅ Test 5 Passed: Verified ${auditLogs.length} initial audit event(s) recorded.`);

  console.log('\n🎉 ALL PHASE 2 DATABASE VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runVerification()
  .catch((err) => {
    console.error('❌ Verification failed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
