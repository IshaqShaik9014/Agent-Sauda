import { buildApp } from '../apps/api/src/app.js';
import { prisma } from '../packages/database/src/index.js';

async function runPolicyVerification() {
  console.log('⚖️ Running Phase 5 Deterministic Policy Engine Test Suite...\n');

  const app = buildApp();
  await app.ready();

  const timestamp = Date.now();

  // 1. Setup Merchant A
  const regResA = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `policy_owner_a_${timestamp}@agentsauda.com`,
      password: 'StrongPassword123!',
      name: 'Elena Rostova',
      merchantName: `Rostova Dynamics ${timestamp}`,
      merchantSlug: `rostova-dyn-${timestamp}`,
      currency: 'INR'
    }
  });
  const dataA = JSON.parse(regResA.body);
  const tokenA = dataA.token;
  const merchantIdA = dataA.merchant.id;

  // 2. Setup Merchant B (For Tenant Isolation Testing)
  const regResB = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `policy_owner_b_${timestamp}@agentsauda.com`,
      password: 'StrongPassword123!',
      name: 'Viktor Reznov',
      merchantName: `Reznov Hardware ${timestamp}`,
      merchantSlug: `reznov-hw-${timestamp}`,
      currency: 'INR'
    }
  });
  const dataB = JSON.parse(regResB.body);
  const tokenB = dataB.token;

  console.log(`🏢 Created Merchant A: "${dataA.merchant.name}" [${merchantIdA}]`);
  console.log(`🏢 Created Merchant B: "${dataB.merchant.name}" [${dataB.merchant.id}]\n`);

  // Create Product in Merchant A
  const productRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/catalog/products`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      title: 'Nexus Ergonomic Workstation Chair',
      slug: 'nexus-ergo-chair',
      description: 'Dynamic synchronous tilt office chair.',
      category: 'Seating',
      basePrice: 20000.0,
      costPrice: 12000.0,
      initialStock: 100
    }
  });
  const productId = JSON.parse(productRes.body).product.id;
  console.log(`📦 Seeded Product: Base ₹20,000 | Cost ₹12,000 | Max Margin 40%\n`);

  // ==========================================================================
  // Test 1: ALLOW Decision
  // ==========================================================================
  console.log('▶️ Test 1: Policy ALLOW Decision (5% discount <= 8% limit, Total ₹57,000 <= ₹100k cap)');
  const allowRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/policy/evaluate`,
    payload: {
      items: [
        {
          productId,
          quantity: 3,
          proposedUnitPrice: 19000.0 // 5% discount
        }
      ]
    }
  });
  if (allowRes.statusCode !== 200) {
    throw new Error(`❌ Test 1 Failed: Expected status 200, got ${allowRes.statusCode}. Body: ${allowRes.body}`);
  }
  const allowData = JSON.parse(allowRes.body).evaluation;
  if (allowData.decision !== 'ALLOW' || !allowData.allowed) {
    throw new Error(`❌ Test 1 Failed: Expected decision ALLOW, got ${allowData.decision}`);
  }
  console.log(`✅ Test 1 Passed: Evaluated ALLOW. Effective Discount: ${allowData.totalEffectiveDiscountPercent}%, Margin: ${allowData.averageGrossMarginPercent}%`);

  // ==========================================================================
  // Test 2: COUNTER Decision (Auto-Calculated Counter Offer)
  // ==========================================================================
  console.log('▶️ Test 2: Policy COUNTER Decision (20% discount requested -> Auto-capped to 8% discount)');
  const counterRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/policy/evaluate`,
    payload: {
      items: [
        {
          productId,
          quantity: 4,
          proposedUnitPrice: 16000.0 // 20% discount exceeds 8% cap
        }
      ]
    }
  });
  const counterData = JSON.parse(counterRes.body).evaluation;
  if (counterData.decision !== 'COUNTER' || counterData.allowed) {
    throw new Error(`❌ Test 2 Failed: Expected decision COUNTER, got ${counterData.decision}`);
  }
  const counterOffer = counterData.counterOffer;
  if (!counterOffer || counterOffer.items[0].counterUnitPrice !== 18400.0) {
    throw new Error(`❌ Test 2 Failed: Expected counter unit price ₹18,400, got ${counterOffer?.items[0]?.counterUnitPrice}`);
  }
  console.log(`✅ Test 2 Passed: Evaluated COUNTER. Buyer asked ₹16,000, Engine counter-offered ₹${counterOffer.items[0].counterUnitPrice} (exact 8% max discount).`);

  // ==========================================================================
  // Test 3: APPROVAL_REQUIRED Decision (Order Exceeds Autonomous Spending Limit)
  // ==========================================================================
  console.log('▶️ Test 3: Policy APPROVAL_REQUIRED Decision (Profitable deal but Total ₹152,000 > ₹100k limit)');
  const approvalRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/policy/evaluate`,
    payload: {
      items: [
        {
          productId,
          quantity: 8,
          proposedUnitPrice: 19000.0 // 8 * 19000 = ₹152,000 (> 100k)
        }
      ]
    }
  });
  const approvalData = JSON.parse(approvalRes.body).evaluation;
  if (approvalData.decision !== 'APPROVAL_REQUIRED' || !approvalData.requiresApproval) {
    throw new Error(`❌ Test 3 Failed: Expected APPROVAL_REQUIRED, got ${approvalData.decision}`);
  }
  console.log(`✅ Test 3 Passed: Evaluated APPROVAL_REQUIRED. Total order ₹${approvalData.totalProposedAmount.toLocaleString('en-IN')} routed to merchant manager.`);

  // ==========================================================================
  // Test 4: REJECT Decision (Negative Margin / Violation)
  // ==========================================================================
  console.log('▶️ Test 4: Policy REJECT Decision (Selling below cost price of ₹12,000)');
  const rejectRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/policy/evaluate`,
    payload: {
      items: [
        {
          productId,
          quantity: 2,
          proposedUnitPrice: 10000.0 // Below cost price of 12000!
        }
      ]
    }
  });
  const rejectData = JSON.parse(rejectRes.body).evaluation;
  if (rejectData.decision !== 'REJECT') {
    throw new Error(`❌ Test 4 Failed: Expected REJECT, got ${rejectData.decision}`);
  }
  console.log(`✅ Test 4 Passed: Evaluated REJECT for predatory negative-margin deal.`);

  // ==========================================================================
  // Test 5: Policy Update & Immutable Version Snapshotting
  // ==========================================================================
  console.log('▶️ Test 5: PUT /api/merchants/:merchantId/policy (Update limits & snapshot version)');
  const updatePolicyRes = await app.inject({
    method: 'PUT',
    url: `/api/merchants/${merchantIdA}/policy`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      maxDiscountPercent: 12.0, // Increase discount to 12%
      autonomousOrderLimit: 200000.0 // Increase limit to ₹200k
    }
  });
  if (updatePolicyRes.statusCode !== 200) {
    throw new Error(`❌ Test 5 Failed: Policy update failed with status ${updatePolicyRes.statusCode}`);
  }

  // Verify version snapshot in database
  const snapshots = await prisma.policyVersion.findMany({
    where: { policy: { merchantId: merchantIdA } }
  });
  if (snapshots.length === 0) {
    throw new Error('❌ Test 5 Failed: Policy version snapshot was not recorded in policy_versions table.');
  }
  console.log(`✅ Test 5 Passed: Updated policy (Max Discount: 12%, Limit: ₹200k) and archived Version 1 snapshot.`);

  // Verify new policy is active on re-evaluation
  const reEvaluateRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/policy/evaluate`,
    payload: {
      items: [{ productId, quantity: 2, proposedUnitPrice: 18000.0 }] // 10% discount
    }
  });
  const reEvalData = JSON.parse(reEvaluateRes.body).evaluation;
  if (reEvalData.decision !== 'ALLOW') {
    throw new Error(`❌ Test 5 Failed: 10% discount should now be ALLOWed under 12% cap, got ${reEvalData.decision}`);
  }
  console.log(`✅ Test 5 Passed: 10% discount offer now successfully ALLOWed under new 12% policy.`);

  // ==========================================================================
  // Test 6: Cross-Tenant Isolation
  // ==========================================================================
  console.log('▶️ Test 6: Cross-Tenant Authorization Guard (Merchant B attempts to alter Merchant A policy)');
  const crossTenantRes = await app.inject({
    method: 'PUT',
    url: `/api/merchants/${merchantIdA}/policy`,
    headers: { authorization: `Bearer ${tokenB}` }, // Merchant B's token
    payload: { maxDiscountPercent: 50.0 }
  });
  if (crossTenantRes.statusCode !== 403) {
    throw new Error(`❌ Test 6 Failed: Expected 403 Forbidden for cross-tenant policy update, got ${crossTenantRes.statusCode}`);
  }
  console.log('✅ Test 6 Passed: Cross-tenant policy update rejected with 403 Forbidden.');

  await app.close();
  await prisma.$disconnect();

  console.log('\n🎉 ALL PHASE 5 POLICY ENGINE TESTS PASSED SUCCESSFULLY!');
}

runPolicyVerification().catch((err) => {
  console.error('❌ Policy Verification Error:', err);
  process.exit(1);
});
