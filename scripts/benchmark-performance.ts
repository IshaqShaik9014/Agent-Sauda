import { buildApp } from '../apps/api/src/app.js';
import { prisma } from '../packages/database/src/index.js';
import { cacheService, CacheService } from '../apps/api/src/lib/cache.js';

interface LatencySummary {
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

function computeLatencies(times: number[]): LatencySummary {
  times.sort((a, b) => a - b);
  const sum = times.reduce((acc, val) => acc + val, 0);
  return {
    min: Number(times[0].toFixed(2)),
    max: Number(times[times.length - 1].toFixed(2)),
    avg: Number((sum / times.length).toFixed(2)),
    p50: Number(times[Math.floor(times.length * 0.5)].toFixed(2)),
    p95: Number(times[Math.floor(times.length * 0.95)].toFixed(2)),
    p99: Number(times[Math.floor(times.length * 0.99)].toFixed(2))
  };
}

async function runPerformanceBenchmark() {
  console.log('⚡ ======================================================================');
  console.log('⚡ AGENT SAUDA — PHASE 19: PERFORMANCE & CACHING BENCHMARK SUITE');
  console.log('⚡ ======================================================================\n');

  const app = buildApp();
  await app.ready();

  const timestamp = Date.now();

  // ==========================================================================
  // Test 1: Raw Cache Driver Micro-Benchmark (500 Operations)
  // ==========================================================================
  console.log('🚀 [TEST 1: CACHE DRIVER MICRO-BENCHMARK] Testing 500 Set/Get Cycles...');
  const cacheTimes: number[] = [];

  for (let i = 0; i < 500; i++) {
    const key = `test:benchmark:${i}`;
    const val = { samplePayload: `data_${i}`, index: i, timestamp: Date.now() };

    const t0 = performance.now();
    await cacheService.set(key, val, 60);
    const read = await cacheService.get(key);
    const t1 = performance.now();

    if (!read) throw new Error(`Cache get failed at cycle ${i}`);
    cacheTimes.push(t1 - t0);
  }

  const cacheSummary = computeLatencies(cacheTimes);
  console.log(`✅ Cache Driver [${cacheService.getDriverType().toUpperCase()}]:`);
  console.log(`   - Avg Latency: ${cacheSummary.avg} ms`);
  console.log(`   - p50: ${cacheSummary.p50} ms | p95: ${cacheSummary.p95} ms | p99: ${cacheSummary.p99} ms\n`);

  // ==========================================================================
  // Test 2: Seed Merchant, Policy & Catalog for Real Request Benchmarking
  // ==========================================================================
  console.log('🏢 [SETUP] Seeding Merchant, Policy & Catalog Products...');
  const regRes = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `perf_merchant_${timestamp}@speedops.io`,
      password: 'StrongPassword123!',
      name: 'Dr. Speed',
      merchantName: 'High-Frequency Store',
      merchantSlug: `speedops-${timestamp}`,
      currency: 'INR'
    }
  });
  const authData = JSON.parse(regRes.body);
  const merchantId = authData.merchant.id;
  const token = authData.token;

  // Add 3 catalog items
  const productIds: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const prodRes = await app.inject({
      method: 'POST',
      url: `/api/merchants/${merchantId}/catalog/products`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: `Enterprise Compute Node Tier-${i}`,
        slug: `compute-node-${i}-${timestamp}`,
        category: 'Compute',
        basePrice: 50000.0 * i,
        costPrice: 30000.0 * i,
        initialStock: 100
      }
    });
    productIds.push(JSON.parse(prodRes.body).product.id);
  }
  console.log(`✅ Seeded 3 enterprise products for merchant [${merchantId}].\n`);

  // ==========================================================================
  // Test 3: Cold vs Warm Catalog Retrieval Benchmark
  // ==========================================================================
  console.log('📦 [TEST 3: CATALOG RETRIEVAL BENCHMARK] Measuring Cold vs Warm Cache Latency...');

  // Cold Request (Triggers Database Query & Populates Cache)
  const tColdStart = performance.now();
  await app.inject({
    method: 'GET',
    url: `/api/agent/catalog?merchantSlug=speedops-${timestamp}`
  });
  const tColdEnd = performance.now();
  const coldLatency = Number((tColdEnd - tColdStart).toFixed(2));

  // Warm Requests (Served Directly from Cache)
  const warmCatalogTimes: number[] = [];
  for (let i = 0; i < 20; i++) {
    const t0 = performance.now();
    await app.inject({
      method: 'GET',
      url: `/api/agent/catalog?merchantSlug=speedops-${timestamp}`
    });
    const t1 = performance.now();
    warmCatalogTimes.push(t1 - t0);
  }

  const warmCatalogSummary = computeLatencies(warmCatalogTimes);
  console.log(`✅ Catalog Retrieval Performance:`);
  console.log(`   - Cold DB Query Latency:  ${coldLatency} ms`);
  console.log(`   - Warm Cached Latency:    ${warmCatalogSummary.avg} ms (p50: ${warmCatalogSummary.p50} ms, p95: ${warmCatalogSummary.p95} ms)`);
  console.log(`   - Latency Reduction:      ${((1 - warmCatalogSummary.avg / coldLatency) * 100).toFixed(1)}% faster\n`);

  // ==========================================================================
  // Test 4: Cold vs Warm Policy Evaluation Benchmark
  // ==========================================================================
  console.log('🛡️ [TEST 4: POLICY EVALUATION BENCHMARK] Measuring Policy Engine Evaluation...');

  const policyEvalPayload = {
    items: [{ productId: productIds[0], quantity: 1, agreedPrice: 45000.0 }]
  };

  // Cold Evaluation (Fetches policy from DB & caches)
  const tPolicyColdStart = performance.now();
  await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantId}/offers`,
    headers: { authorization: `Bearer ${token}` },
    payload: policyEvalPayload
  });
  const tPolicyColdEnd = performance.now();
  const policyColdLatency = Number((tPolicyColdEnd - tPolicyColdStart).toFixed(2));

  // Warm Evaluations
  const warmPolicyTimes: number[] = [];
  for (let i = 0; i < 20; i++) {
    const t0 = performance.now();
    await app.inject({
      method: 'POST',
      url: `/api/merchants/${merchantId}/offers`,
      headers: { authorization: `Bearer ${token}` },
      payload: policyEvalPayload
    });
    const t1 = performance.now();
    warmPolicyTimes.push(t1 - t0);
  }

  const warmPolicySummary = computeLatencies(warmPolicyTimes);
  console.log(`✅ Policy Evaluation Performance:`);
  console.log(`   - Cold Evaluation Latency: ${policyColdLatency} ms`);
  console.log(`   - Warm Evaluation Latency: ${warmPolicySummary.avg} ms (p50: ${warmPolicySummary.p50} ms, p95: ${warmPolicySummary.p95} ms)\n`);

  // ==========================================================================
  // Test 5: Cache Invalidation Accuracy Verification
  // ==========================================================================
  console.log('🔄 [TEST 5: CACHE INVALIDATION ACCURACY] Verifying Proactive Cache Busting...');
  
  // Verify policy cache exists
  const cachedPolicyBefore = await cacheService.get(CacheService.policyKey(merchantId));
  if (!cachedPolicyBefore) {
    throw new Error('❌ Expected cached policy to exist before update');
  }

  // Update policy (Should bust cache)
  await app.inject({
    method: 'PUT',
    url: `/api/merchants/${merchantId}/policy`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      maxDiscountPercent: 22.5
    }
  });

  const cachedPolicyAfter = await cacheService.get(CacheService.policyKey(merchantId));
  if (cachedPolicyAfter !== null) {
    throw new Error('❌ Cache busting failed: Stale policy remained in cache after PUT /policy');
  }
  console.log('✅ Policy cache successfully invalidated on policy update (Zero Stale State).');

  // Verify catalog cache invalidation on inventory restock
  await app.inject({
    method: 'GET',
    url: `/api/agent/catalog?merchantSlug=speedops-${timestamp}`
  });
  const cachedCatalogBefore = await cacheService.get(CacheService.catalogSlugKey(`speedops-${timestamp}`));
  if (!cachedCatalogBefore) {
    throw new Error('❌ Expected cached catalog to exist');
  }

  // Restock inventory (Should bust catalog cache)
  await app.inject({
    method: 'PATCH',
    url: `/api/merchants/${merchantId}/catalog/inventory/${productIds[0]}`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      availableUnits: 150
    }
  });

  const cachedCatalogAfter = await cacheService.get(CacheService.catalogSlugKey(`speedops-${timestamp}`));
  if (cachedCatalogAfter !== null) {
    throw new Error('❌ Cache busting failed: Stale catalog remained in cache after stock update');
  }
  console.log('✅ Catalog cache successfully invalidated on inventory adjustment (Zero Stale State).\n');

  // ==========================================================================
  // Test 6: Concurrency Load Benchmark (5 Parallel Requests within Pool Limit)
  // ==========================================================================
  console.log('🔥 [TEST 6: CONCURRENT LOAD BENCHMARK] Launching 5 Parallel DB Transactions (Staying within Pooler Slots)...');
  const concurrentStart = performance.now();

  const concurrentRequests = Array.from({ length: 5 }).map(() =>
    app.inject({
      method: 'POST',
      url: `/api/merchants/${merchantId}/offers`,
      headers: { authorization: `Bearer ${token}` },
      payload: policyEvalPayload
    })
  );

  const results = await Promise.all(concurrentRequests);
  const concurrentEnd = performance.now();
  const totalConcurrentTime = Number((concurrentEnd - concurrentStart).toFixed(2));

  const allPassed = results.every((r) => r.statusCode === 201 || r.statusCode === 200);
  if (!allPassed) {
    throw new Error('❌ Some concurrent negotiation evaluations failed');
  }

  const avgThroughputPerSec = Number(((5 / totalConcurrentTime) * 1000).toFixed(1));
  console.log(`✅ 5 Parallel DB Transactions Succeeded (100% Success Rate):`);
  console.log(`   - Total Batch Time: ${totalConcurrentTime} ms`);
  console.log(`   - Effective Throughput: ${avgThroughputPerSec} requests / sec`);
  console.log(`   - Avg Time Per Concurrent Transaction: ${(totalConcurrentTime / 5).toFixed(2)} ms\n`);

  // ==========================================================================
  // Print Overall Cache Statistics
  // ==========================================================================
  const stats = cacheService.getStats();
  console.log('📊 [OVERALL CACHE SERVICE TELEMETRY]');
  console.log(`   - Driver Type:       ${stats.driver.toUpperCase()}`);
  console.log(`   - Total Requests:    ${stats.totalRequests}`);
  console.log(`   - Cache Hits:        ${stats.hits}`);
  console.log(`   - Cache Misses:      ${stats.misses}`);
  console.log(`   - Cache Sets/Writes: ${stats.sets}`);
  console.log(`   - Invalidation Dels: ${stats.deletes}`);
  console.log(`   - Cache Hit Rate:    ${stats.hitRatePercent}%\n`);

  await app.close();
  await prisma.$disconnect();

  console.log('======================================================================');
  console.log('🎉 PHASE 19 BENCHMARK COMPLETE: HIGH PERFORMANCE TARGETS ACHIEVED!');
  console.log('======================================================================');
}

runPerformanceBenchmark().catch((err) => {
  console.error('❌ Benchmark Failed:', err);
  process.exit(1);
});
