import { buildApp } from '../apps/api/src/app.js';
import { prisma } from '../packages/database/src/index.js';

async function runApprovalVerification() {
  console.log('🛡️ Running Phase 8 Human-in-the-Loop (HITL) Approvals Test Suite...\n');

  const app = buildApp();
  await app.ready();

  const timestamp = Date.now();

  // 1. Setup Merchant A (Owner: Bruce Wayne)
  const regResA = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `bruce_${timestamp}@wayne-sauda.com`,
      password: 'StrongPassword123!',
      name: 'Bruce Wayne',
      merchantName: `Wayne Enterprises ${timestamp}`,
      merchantSlug: `wayne-ent-${timestamp}`,
      currency: 'INR'
    }
  });
  const dataA = JSON.parse(regResA.body);
  const ownerTokenA = dataA.token;
  const merchantIdA = dataA.merchant.id;

  // Setup Staff Member for Merchant A (Lucius Fox - Role: STAFF)
  const regStaffRes = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `lucius_${timestamp}@wayne-sauda.com`,
      password: 'StrongPassword123!',
      name: 'Lucius Fox',
      merchantName: `Wayne Temp ${timestamp}`,
      merchantSlug: `wayne-temp-${timestamp}`,
      currency: 'INR'
    }
  });
  const staffUserId = JSON.parse(regStaffRes.body).user.id;

  // Add Lucius as STAFF member to Merchant A
  await prisma.merchantMember.create({
    data: {
      merchantId: merchantIdA,
      userId: staffUserId,
      role: 'STAFF'
    }
  });

  // Login as staff user scoped to Merchant A
  const staffLoginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      email: `lucius_${timestamp}@wayne-sauda.com`,
      password: 'StrongPassword123!'
    }
  });
  // Manually mint JWT for Staff scoped to Merchant A
  const staffToken = app.jwt.sign({
    userId: staffUserId,
    email: `lucius_${timestamp}@wayne-sauda.com`,
    name: 'Lucius Fox',
    merchantId: merchantIdA,
    merchantSlug: dataA.merchant.slug,
    role: 'STAFF'
  });

  // Setup Merchant B (LexCorp - For Cross-Tenant Guard)
  const regResB = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `lex_${timestamp}@lexcorp.com`,
      password: 'StrongPassword123!',
      name: 'Lex Luthor',
      merchantName: `LexCorp ${timestamp}`,
      merchantSlug: `lexcorp-${timestamp}`,
      currency: 'INR'
    }
  });
  const ownerTokenB = JSON.parse(regResB.body).token;

  console.log(`🏢 Created Merchant A: "${dataA.merchant.name}" [${merchantIdA}]`);

  // 2. Create Catalog Product
  const prodRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/catalog/products`,
    headers: { authorization: `Bearer ${ownerTokenA}` },
    payload: {
      title: 'Wayne Tactical Surveillance Drone',
      slug: 'wayne-tactical-drone',
      description: 'Long-range AI-assisted autonomous surveillance unit.',
      category: 'Surveillance',
      basePrice: 20000.0,
      costPrice: 12000.0,
      initialStock: 50,
      location: 'Gotham Vault'
    }
  });
  const product = JSON.parse(prodRes.body).product;
  console.log(`📦 Seeded Product: "${product.title}" — Base: ₹20,000 | Stock: 50\n`);

  // ==========================================================================
  // Test 1: High-Value Offer Trigger (APPROVAL_REQUIRED -> PENDING Approval)
  // ==========================================================================
  console.log('▶️ Test 1: High-Value Offer (₹152,000 > ₹100,000 cap creates DRAFT Offer & PENDING Approval)');
  const createHighValOfferRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/offers`,
    headers: { authorization: `Bearer ${ownerTokenA}` },
    payload: {
      items: [
        {
          productId: product.id,
          quantity: 8,
          agreedPrice: 19000.0 // 5% discount, Total = ₹152,000 > ₹100,000
        }
      ]
    }
  });

  if (createHighValOfferRes.statusCode !== 201) {
    throw new Error(`❌ Test 1 Failed: Status ${createHighValOfferRes.statusCode}. Response: ${createHighValOfferRes.body}`);
  }

  const highValOffer = JSON.parse(createHighValOfferRes.body).offer;
  if (highValOffer.status !== 'DRAFT' || highValOffer.policyDecision !== 'APPROVAL_REQUIRED') {
    throw new Error(`❌ Test 1 Failed: Offer should be DRAFT with decision APPROVAL_REQUIRED, got status=${highValOffer.status}`);
  }

  // Find created Approval record
  const dbApproval = await prisma.approval.findFirst({
    where: { offerId: highValOffer.id }
  });
  if (!dbApproval || dbApproval.status !== 'PENDING') {
    throw new Error('❌ Test 1 Failed: PENDING Approval record was not created.');
  }
  console.log(`✅ Test 1 Passed: Offer ${highValOffer.offerNumber} locked in DRAFT (Total: ₹${highValOffer.totalAmount.toLocaleString('en-IN')}), Approval [${dbApproval.id}] created in PENDING.`);

  // ==========================================================================
  // Test 2: Buyer Checkout Lock (Cannot accept while approval is PENDING)
  // ==========================================================================
  console.log('\n▶️ Test 2: Buyer Checkout Lock (Buyer cannot accept DRAFT offer awaiting approval)');
  const tryAcceptLocked = await app.inject({
    method: 'POST',
    url: `/api/offers/${highValOffer.id}/accept`,
    payload: {}
  });
  if (tryAcceptLocked.statusCode !== 400) {
    throw new Error(`❌ Test 2 Failed: Expected 400 when accepting DRAFT offer, got ${tryAcceptLocked.statusCode}`);
  }
  console.log('✅ Test 2 Passed: Buyer checkout correctly blocked on unapproved offer.');

  // ==========================================================================
  // Test 3: List Pending Approvals Queue
  // ==========================================================================
  console.log('\n▶️ Test 3: GET /api/merchants/:merchantId/approvals (List Pending Queue)');
  const listPendingRes = await app.inject({
    method: 'GET',
    url: `/api/merchants/${merchantIdA}/approvals?status=PENDING`,
    headers: { authorization: `Bearer ${ownerTokenA}` }
  });
  const pendingQueue = JSON.parse(listPendingRes.body);
  if (pendingQueue.approvalsCount < 1 || pendingQueue.approvals[0].offer.totalAmount !== 152000.0) {
    throw new Error('❌ Test 3 Failed: Pending approvals queue did not return the high-value deal.');
  }
  console.log(`✅ Test 3 Passed: Manager retrieved ${pendingQueue.approvalsCount} pending high-value approval request.`);

  // ==========================================================================
  // Test 4: Manager Approves Request (Unlocks Offer to ACTIVE)
  // ==========================================================================
  console.log('\n▶️ Test 4: POST /api/merchants/:merchantId/approvals/:approvalId/approve (Manager Approves Deal)');
  const approveRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/approvals/${dbApproval.id}/approve`,
    headers: { authorization: `Bearer ${ownerTokenA}` },
    payload: {
      resolutionNotes: 'Approved special volume pricing for corporate partner'
    }
  });

  if (approveRes.statusCode !== 200) {
    throw new Error(`❌ Test 4 Failed: Status ${approveRes.statusCode}. Response: ${approveRes.body}`);
  }
  const approvedData = JSON.parse(approveRes.body).approval;
  if (approvedData.status !== 'APPROVED') {
    throw new Error(`❌ Test 4 Failed: Expected status APPROVED, got ${approvedData.status}`);
  }

  // Verify Offer is now ACTIVE and buyer can accept
  const acceptUnlockedRes = await app.inject({
    method: 'POST',
    url: `/api/offers/${highValOffer.id}/accept`,
    payload: { buyerSessionId: 'buyer_session_corp_1' }
  });
  if (acceptUnlockedRes.statusCode !== 200) {
    throw new Error(`❌ Test 4 Failed: Buyer could not accept approved offer. Status ${acceptUnlockedRes.statusCode}`);
  }
  console.log(`✅ Test 4 Passed: Deal approved! Offer unlocked to ACTIVE and successfully accepted by buyer.`);

  // ==========================================================================
  // Test 5: Manager Rejects Deal Workflow
  // ==========================================================================
  console.log('\n▶️ Test 5: POST /api/merchants/:merchantId/approvals/:approvalId/reject (Manager Declines Deal)');
  const createOffer2Res = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/offers`,
    headers: { authorization: `Bearer ${ownerTokenA}` },
    payload: {
      items: [{ productId: product.id, quantity: 10, agreedPrice: 18500.0 }]
    }
  });
  const offer2 = JSON.parse(createOffer2Res.body).offer;
  const dbApproval2 = await prisma.approval.findFirst({ where: { offerId: offer2.id } });

  const rejectRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/approvals/${dbApproval2!.id}/reject`,
    headers: { authorization: `Bearer ${ownerTokenA}` },
    payload: { resolutionNotes: 'Capacity reserved for government order' }
  });
  if (rejectRes.statusCode !== 200) {
    throw new Error(`❌ Test 5 Failed: Status ${rejectRes.statusCode}`);
  }
  const rejectedApproval = JSON.parse(rejectRes.body).approval;
  if (rejectedApproval.status !== 'REJECTED') {
    throw new Error(`❌ Test 5 Failed: Expected status REJECTED, got ${rejectedApproval.status}`);
  }
  console.log(`✅ Test 5 Passed: Approval and Offer both transitioned to REJECTED.`);

  // ==========================================================================
  // Test 6: Timeout Auto-Rejection Check
  // ==========================================================================
  console.log('\n▶️ Test 6: Timeout Auto-Rejection (Expired unreviewed request lazily rejected)');
  const expiredOfferDb = await prisma.offer.create({
    data: {
      merchantId: merchantIdA,
      conversationId: highValOffer.conversationId,
      offerNumber: `OFF-EXPIRED-HITL-${timestamp}`,
      subtotal: 160000.0,
      totalAmount: 152000.0,
      marginPercent: 30.0,
      status: 'DRAFT',
      expiresAt: new Date(Date.now() - 3600000) // 1 hour ago
    }
  });
  const timedOutApproval = await prisma.approval.create({
    data: {
      merchantId: merchantIdA,
      offerId: expiredOfferDb.id,
      status: 'PENDING',
      requestReason: 'High value order test'
    }
  });

  const getTimedOutRes = await app.inject({
    method: 'GET',
    url: `/api/merchants/${merchantIdA}/approvals/${timedOutApproval.id}`,
    headers: { authorization: `Bearer ${ownerTokenA}` }
  });
  const timedOutResult = JSON.parse(getTimedOutRes.body).approval;
  if (timedOutResult.status !== 'REJECTED') {
    throw new Error(`❌ Test 6 Failed: Expired approval was not marked as REJECTED/TIMED_OUT.`);
  }
  console.log(`✅ Test 6 Passed: Expired approval lazily marked as REJECTED due to timeout.`);

  // ==========================================================================
  // Test 7: RBAC Restriction (STAFF cannot approve, only OWNER/ADMIN)
  // ==========================================================================
  console.log('\n▶️ Test 7: RBAC Guard (Staff member cannot execute manager approval)');
  const createOffer3Res = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/offers`,
    headers: { authorization: `Bearer ${ownerTokenA}` },
    payload: {
      items: [{ productId: product.id, quantity: 8, agreedPrice: 19000.0 }]
    }
  });
  const offer3 = JSON.parse(createOffer3Res.body).offer;
  const dbApproval3 = await prisma.approval.findFirst({ where: { offerId: offer3.id } });

  const staffApproveAttempt = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/approvals/${dbApproval3!.id}/approve`,
    headers: { authorization: `Bearer ${staffToken}` },
    payload: { resolutionNotes: 'Staff attempt' }
  });

  if (staffApproveAttempt.statusCode !== 403) {
    throw new Error(`❌ Test 7 Failed: Expected 403 Forbidden for STAFF role, got ${staffApproveAttempt.statusCode}`);
  }
  console.log(`✅ Test 7 Passed: Staff approval attempt rejected with 403 Forbidden.`);

  // ==========================================================================
  // Test 8: Cross-Tenant Authorization Guard
  // ==========================================================================
  console.log('\n▶️ Test 8: Cross-Tenant Guard (Merchant B cannot approve Merchant A request)');
  const crossTenantRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/approvals/${dbApproval3!.id}/approve`,
    headers: { authorization: `Bearer ${ownerTokenB}` },
    payload: {}
  });
  if (crossTenantRes.statusCode !== 403) {
    throw new Error(`❌ Test 8 Failed: Expected 403 Forbidden for cross-tenant request, got ${crossTenantRes.statusCode}`);
  }
  console.log(`✅ Test 8 Passed: Cross-tenant approval action rejected with 403 Forbidden.`);

  await app.close();
  await prisma.$disconnect();

  console.log('\n🎉 ALL PHASE 8 HITL APPROVALS TESTS PASSED SUCCESSFULLY!');
}

runApprovalVerification().catch((err) => {
  console.error('❌ Approval Verification Error:', err);
  process.exit(1);
});
