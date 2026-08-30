import { buildApp } from '../apps/api/src/app.js';
import { prisma } from '../packages/database/src/index.js';

async function runAuthVerification() {
  console.log('🔐 Running Phase 3 Authentication & Authorization Test Suite...\n');

  const app = buildApp();
  await app.ready();

  const timestamp = Date.now();
  const testUser = {
    email: `test_merchant_${timestamp}@agentsauda.com`,
    password: 'SuperSecretPassword123!',
    name: 'Sarah Connor',
    merchantName: `Cyberdyne Retail ${timestamp}`,
    merchantSlug: `cyberdyne-${timestamp}`
  };

  // Test 1: Merchant Registration
  console.log('▶️ Test 1: POST /api/auth/register (Atomic Merchant & Owner Creation)');
  const regRes = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: testUser
  });

  if (regRes.statusCode !== 201) {
    throw new Error(`❌ Test 1 Failed: Expected status 201, got ${regRes.statusCode}. Response: ${regRes.body}`);
  }
  const regData = JSON.parse(regRes.body);
  if (!regData.token || regData.merchant.role !== 'OWNER') {
    throw new Error('❌ Test 1 Failed: Response missing JWT token or incorrect role.');
  }
  const token = regData.token;
  const merchantId = regData.merchant.id;
  console.log(`✅ Test 1 Passed: Registered merchant "${regData.merchant.name}" with OWNER role.`);

  // Test 2: Duplicate Registration Protection
  console.log('▶️ Test 2: Duplicate Email & Slug Conflict Handling');
  const dupRes = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: testUser
  });
  if (dupRes.statusCode !== 409) {
    throw new Error(`❌ Test 2 Failed: Expected 409 for duplicate registration, got ${dupRes.statusCode}`);
  }
  console.log('✅ Test 2 Passed: Duplicate registration rejected with 409 Conflict.');

  // Test 3: Login with Correct Credentials
  console.log('▶️ Test 3: POST /api/auth/login (Valid Credentials)');
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      email: testUser.email,
      password: testUser.password
    }
  });
  if (loginRes.statusCode !== 200) {
    throw new Error(`❌ Test 3 Failed: Expected 200 for valid login, got ${loginRes.statusCode}`);
  }
  const loginData = JSON.parse(loginRes.body);
  if (!loginData.token || loginData.merchant.id !== merchantId) {
    throw new Error('❌ Test 3 Failed: Login token missing or merchant ID mismatch.');
  }
  console.log('✅ Test 3 Passed: Login authenticated successfully with bcrypt verification.');

  // Test 4: Login with Invalid Password
  console.log('▶️ Test 4: POST /api/auth/login (Invalid Password)');
  const badLoginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      email: testUser.email,
      password: 'WrongPassword999!'
    }
  });
  if (badLoginRes.statusCode !== 401) {
    throw new Error(`❌ Test 4 Failed: Expected 401 for wrong password, got ${badLoginRes.statusCode}`);
  }
  console.log('✅ Test 4 Passed: Invalid password rejected with 401 Unauthorized.');

  // Test 5: Protected Route Without Token
  console.log('▶️ Test 5: GET /api/auth/me (Unauthenticated Access)');
  const noTokenRes = await app.inject({
    method: 'GET',
    url: '/api/auth/me'
  });
  if (noTokenRes.statusCode !== 401) {
    throw new Error(`❌ Test 5 Failed: Expected 401 for unauthenticated request, got ${noTokenRes.statusCode}`);
  }
  console.log('✅ Test 5 Passed: Protected route blocked unauthenticated request.');

  // Test 6: Protected Route With Valid Token
  console.log('▶️ Test 6: GET /api/auth/me (Authenticated Access)');
  const meRes = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: {
      authorization: `Bearer ${token}`
    }
  });
  if (meRes.statusCode !== 200) {
    throw new Error(`❌ Test 6 Failed: Expected 200 for authenticated user, got ${meRes.statusCode}`);
  }
  const meData = JSON.parse(meRes.body);
  if (meData.session.merchantId !== merchantId || meData.profile.email !== testUser.email.toLowerCase()) {
    throw new Error('❌ Test 6 Failed: Session context does not match authenticated user.');
  }
  console.log(`✅ Test 6 Passed: Retrieved session profile for "${meData.profile.name}".`);

  // Test 7: Tampered Token Rejection
  console.log('▶️ Test 7: Tampered JWT Token Signature Rejection');
  const tamperedToken = token.slice(0, -5) + 'abcde';
  const tamperedRes = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: {
      authorization: `Bearer ${tamperedToken}`
    }
  });
  if (tamperedRes.statusCode !== 401) {
    throw new Error(`❌ Test 7 Failed: Expected 401 for tampered JWT, got ${tamperedRes.statusCode}`);
  }
  console.log('✅ Test 7 Passed: Tampered cryptographic signature rejected with 401.');

  await app.close();
  await prisma.$disconnect();

  console.log('\n🎉 ALL PHASE 3 AUTHENTICATION & AUTHORIZATION TESTS PASSED SUCCESSFULLY!');
}

runAuthVerification().catch((err) => {
  console.error('❌ Auth Verification Error:', err);
  process.exit(1);
});
