import { buildApp } from '../apps/api/src/app.js';
import { prisma } from '../packages/database/src/index.js';

async function runOrderVerification() {
  console.log('📦 Running Phase 9 Order Creation & Inventory Reservation Test Suite...\n');

  const app = buildApp();
  await app.ready();

  const timestamp = Date.now();

  // 1. Setup Merchant A (Tony Stark)
  const regResA = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `tony_${timestamp}@stark-sauda.com`,
      password: 'StrongPassword123!',
      name: 'Tony Stark',
      merchantName: `Stark Industries ${timestamp}`,
      merchantSlug: `stark-ind-${timestamp}`,
      currency: 'INR'
    }
  });
  const dataA = JSON.parse(regResA.body);
  const tokenA = dataA.token;
  const merchantIdA = dataA.merchant.id;

  // Setup Merchant B (Justin Hammer - Cross-Tenant Guard)
  const regResB = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `justin_${timestamp}@hammer-sauda.com`,
      password: 'StrongPassword123!',
      name: 'Justin Hammer',
      merchantName: `Hammer Tech ${timestamp}`,
      merchantSlug: `hammer-tech-${timestamp}`,
      currency: 'INR'
    }
  });
  const tokenB = JSON.parse(regResB.body).token;

  console.log(`🏢 Created Merchant: "${dataA.merchant.name}" [${merchantIdA}]`);

  // 2. Seed Product with 10 available units
  const prodRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/catalog/products`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      title: 'Arc Reactor Core MK-V',
      slug: 'arc-reactor-core-mkv',
      description: 'Clean high-density zero-emission clean energy core.',
      category: 'Power Units',
      basePrice: 50000.0,
      costPrice: 30000.0,
      initialStock: 10,
      location: 'Malibu Workshop'
    }
  });
  const product = JSON.parse(prodRes.body).product;
  console.log(`🔋 Seeded Product: "${product.title}" — Initial Stock: 10 Available | 0 Reserved\n`);

  // 3. Create and Accept Formal Offer for 2 units
  const offerRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/offers`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      items: [{ productId: product.id, quantity: 2, agreedPrice: 47500.0 }]
    }
  });
  const offer = JSON.parse(offerRes.body).offer;

  // Buyer accepts offer
  await app.inject({
    method: 'POST',
    url: `/api/offers/${offer.id}/accept`,
    payload: { buyerSessionId: 'session_buyer_stark_1' }
  });
  console.log(`📜 Offer ${offer.offerNumber} created & accepted (2 units @ ₹47,500 = ₹95,000 total)`);

  // ==========================================================================
  // Test 1: Convert Accepted Offer to Order (status: PAYMENT_PENDING)
  // ==========================================================================
  console.log('\n▶️ Test 1: POST /api/orders/create-from-offer (Convert Offer to Order)');
  const createOrderRes = await app.inject({
    method: 'POST',
    url: '/api/orders/create-from-offer',
    payload: {
      offerId: offer.id,
      buyerSessionId: 'session_buyer_stark_1',
      notes: 'Express courier delivery requested'
    }
  });

  if (createOrderRes.statusCode !== 201) {
    throw new Error(`❌ Test 1 Failed: Status ${createOrderRes.statusCode}. Response: ${createOrderRes.body}`);
  }
  const order = JSON.parse(createOrderRes.body).order;
  if (order.status !== 'PAYMENT_PENDING' || order.totalAmount !== 95000.0 || order.items.length !== 1) {
    throw new Error(`❌ Test 1 Failed: Unexpected order data: ${JSON.stringify(order)}`);
  }
  console.log(`✅ Test 1 Passed: Order ${order.orderNumber} created in PAYMENT_PENDING status (Total: ₹${order.totalAmount.toLocaleString('en-IN')}).`);

  // ==========================================================================
  // Test 2: ACID Inventory Reservation Verification
  // ==========================================================================
  console.log('\n▶️ Test 2: Verify Warehouse Inventory Stock Reservation');
  const inventoryDb = await prisma.inventory.findFirst({
    where: { productId: product.id }
  });

  if (!inventoryDb || inventoryDb.availableUnits !== 8 || inventoryDb.reservedUnits !== 2) {
    throw new Error(
      `❌ Test 2 Failed: Expected 8 available and 2 reserved, got ${inventoryDb?.availableUnits} avail / ${inventoryDb?.reservedUnits} reserved`
    );
  }
  console.log(`✅ Test 2 Passed: Stock reserved atomically! Available: ${inventoryDb.availableUnits} (was 10), Reserved: ${inventoryDb.reservedUnits} (was 0).`);

  // ==========================================================================
  // Test 3: Duplicate Conversion Protection
  // ==========================================================================
  console.log('\n▶️ Test 3: Guard against double-order conversion of the same offer');
  const dupRes = await app.inject({
    method: 'POST',
    url: '/api/orders/create-from-offer',
    payload: { offerId: offer.id }
  });
  if (dupRes.statusCode !== 400) {
    throw new Error(`❌ Test 3 Failed: Expected 400 for duplicate conversion, got ${dupRes.statusCode}`);
  }
  console.log('✅ Test 3 Passed: Duplicate conversion blocked with OFFER_ALREADY_CONVERTED.');

  // ==========================================================================
  // Test 4: Insufficient Inventory Guard
  // ==========================================================================
  console.log('\n▶️ Test 4: Insufficient Inventory Guard (Requested > Available units)');
  // Create product with only 1 unit
  const scarceProdRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/catalog/products`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      title: 'Vibranium Shield Prototype',
      slug: 'vibranium-shield-proto',
      basePrice: 80000.0,
      costPrice: 50000.0,
      initialStock: 1
    }
  });
  const scarceProd = JSON.parse(scarceProdRes.body).product;

  // Create offer for 5 units (> 1 unit stock)
  const excessiveOfferRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/offers`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      items: [{ productId: scarceProd.id, quantity: 5, agreedPrice: 75000.0 }]
    }
  });
  const excessiveOffer = JSON.parse(excessiveOfferRes.body).offer;

  const insufficientStockOrderRes = await app.inject({
    method: 'POST',
    url: '/api/orders/create-from-offer',
    payload: { offerId: excessiveOffer.id }
  });

  if (insufficientStockOrderRes.statusCode !== 400) {
    throw new Error(`❌ Test 4 Failed: Expected 400 for insufficient inventory, got ${insufficientStockOrderRes.statusCode}`);
  }
  console.log('✅ Test 4 Passed: Insufficient inventory rejected with 400 INSUFFICIENT_INVENTORY.');

  // ==========================================================================
  // Test 5: Order Cancellation & Inventory Release
  // ==========================================================================
  console.log('\n▶️ Test 5: POST /api/merchants/:merchantId/orders/:orderId/cancel (Cancel Order & Release Stock)');
  const cancelRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/orders/${order.id}/cancel`,
    headers: { authorization: `Bearer ${tokenA}` },
    payload: { reason: 'Customer requested cancellation prior to payment' }
  });

  if (cancelRes.statusCode !== 200) {
    throw new Error(`❌ Test 5 Failed: Status ${cancelRes.statusCode}. Response: ${cancelRes.body}`);
  }
  const cancelledOrder = JSON.parse(cancelRes.body).order;
  if (cancelledOrder.status !== 'CANCELLED') {
    throw new Error(`❌ Test 5 Failed: Expected status CANCELLED, got ${cancelledOrder.status}`);
  }

  // Check inventory restored
  const restoredInventory = await prisma.inventory.findFirst({
    where: { productId: product.id }
  });
  if (restoredInventory?.availableUnits !== 10 || restoredInventory?.reservedUnits !== 0) {
    throw new Error(
      `❌ Test 5 Failed: Inventory not restored! Got ${restoredInventory?.availableUnits} avail / ${restoredInventory?.reservedUnits} res`
    );
  }
  console.log(`✅ Test 5 Passed: Order cancelled and reserved stock restored! Available: ${restoredInventory.availableUnits}, Reserved: ${restoredInventory.reservedUnits}.`);

  // ==========================================================================
  // Test 6: Public Buyer Order View & Merchant Listing
  // ==========================================================================
  console.log('\n▶️ Test 6: Public Buyer Checkout View & Merchant Order Listing');
  const getPublicOrderRes = await app.inject({
    method: 'GET',
    url: `/api/orders/${order.id}`
  });
  if (getPublicOrderRes.statusCode !== 200) {
    throw new Error(`❌ Test 6 Failed: Public order view status ${getPublicOrderRes.statusCode}`);
  }

  const merchantOrdersRes = await app.inject({
    method: 'GET',
    url: `/api/merchants/${merchantIdA}/orders?status=CANCELLED`,
    headers: { authorization: `Bearer ${tokenA}` }
  });
  const merchantOrders = JSON.parse(merchantOrdersRes.body);
  if (merchantOrders.ordersCount < 1 || merchantOrders.orders[0].id !== order.id) {
    throw new Error('❌ Test 6 Failed: Merchant orders list did not return cancelled order.');
  }
  console.log(`✅ Test 6 Passed: Public checkout order summary and merchant filtered query verified.`);

  // ==========================================================================
  // Test 7: Cross-Tenant Isolation Guard
  // ==========================================================================
  console.log('\n▶️ Test 7: Cross-Tenant Guard (Merchant B cannot cancel Merchant A order)');
  const crossTenantRes = await app.inject({
    method: 'POST',
    url: `/api/merchants/${merchantIdA}/orders/${order.id}/cancel`,
    headers: { authorization: `Bearer ${tokenB}` },
    payload: { reason: 'Unauthorized attack' }
  });
  if (crossTenantRes.statusCode !== 403) {
    throw new Error(`❌ Test 7 Failed: Expected 403 Forbidden for cross-tenant request, got ${crossTenantRes.statusCode}`);
  }
  console.log('✅ Test 7 Passed: Cross-tenant order manipulation rejected with 403 Forbidden.');

  await app.close();
  await prisma.$disconnect();

  console.log('\n🎉 ALL PHASE 9 ORDER CREATION & INVENTORY RESERVATION TESTS PASSED SUCCESSFULLY!');
}

runOrderVerification().catch((err) => {
  console.error('❌ Order Verification Error:', err);
  process.exit(1);
});
