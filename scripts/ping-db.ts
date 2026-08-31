import { warmupDatabase, prisma } from '../packages/database/src/index.js';

async function main() {
  console.log('⚡ Pinging Neon Cloud Database...\n');
  const start = Date.now();

  try {
    await warmupDatabase(5, 2000);
    const duration = ((Date.now() - start) / 1000).toFixed(2);

    // Quick verification query
    const merchantCount = await prisma.merchant.count();
    const productCount = await prisma.product.count();

    console.log(`\n✅ Neon Cloud is WIDE AWAKE & READY! (Response time: ${duration}s)`);
    console.log(`📊 Current DB Stats:`);
    console.log(`   - Active Merchants: ${merchantCount}`);
    console.log(`   - Catalog Products: ${productCount}`);
    console.log(`\n🚀 You can now run "npm run dev:api" or any test suite seamlessly with zero cold-start delay.\n`);
  } catch (err: unknown) {
    console.error('❌ Failed to wake up Neon Database:', (err as Error).message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
