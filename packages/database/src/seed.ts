import { prisma } from './index.js';

export async function seedDatabase() {
  console.log('🌱 Starting Agent Sauda Database Seed...');

  // 1. Create or Find Demo User
  const demoUser = await prisma.user.upsert({
    where: { email: 'owner@agentsauda.com' },
    update: {},
    create: {
      email: 'owner@agentsauda.com',
      name: 'Ishaq Shaik',
      passwordHash: '$2b$10$epG9iN8vKk69qPqH1Nkm5O7mR0C75d3c8a91gQpY0fH2l3s5jK6eO' // Demo hashed password
    }
  });
  console.log(`👤 User initialized: ${demoUser.name} (${demoUser.email})`);

  // 2. Create or Find Demo Merchant
  const demoMerchant = await prisma.merchant.upsert({
    where: { slug: 'apex-furniture' },
    update: {},
    create: {
      name: 'Apex Modern Furniture Co.',
      slug: 'apex-furniture',
      currency: 'INR'
    }
  });
  console.log(`🏢 Merchant initialized: ${demoMerchant.name} [${demoMerchant.id}]`);

  // 3. Link User as OWNER in MerchantMember
  await prisma.merchantMember.upsert({
    where: {
      merchantId_userId: {
        merchantId: demoMerchant.id,
        userId: demoUser.id
      }
    },
    update: { role: 'OWNER' },
    create: {
      merchantId: demoMerchant.id,
      userId: demoUser.id,
      role: 'OWNER'
    }
  });

  // 4. Create or Update Merchant Policy
  const policy = await prisma.policy.upsert({
    where: { merchantId: demoMerchant.id },
    update: {
      maxDiscountPercent: 8.0,
      minimumMarginPercent: 18.0,
      autonomousOrderLimit: 100000.0,
      approvalThreshold: 100000.0,
      maxQuantityPerOrder: 50,
      isActive: true
    },
    create: {
      merchantId: demoMerchant.id,
      maxDiscountPercent: 8.0,
      minimumMarginPercent: 18.0,
      autonomousOrderLimit: 100000.0,
      approvalThreshold: 100000.0,
      maxQuantityPerOrder: 50,
      rules: {
        allowedPaymentMethods: ['RAZORPAY_TEST'],
        standardShippingCost: 0,
        freeShippingThreshold: 50000
      },
      isActive: true
    }
  });
  console.log(`🛡️ Policy configured: Max Discount ${policy.maxDiscountPercent}%, Min Margin ${policy.minimumMarginPercent}%, Autonomous Limit ₹${policy.autonomousOrderLimit.toLocaleString('en-IN')}`);

  // 5. Seed Demo Catalog Products & Inventory
  const demoProducts = [
    {
      title: 'ErgoPro Executive Desk Chair',
      slug: 'ergopro-executive-chair',
      description: 'High-back ergonomic mesh office chair with adjustable lumbar support, 4D armrests, and synchro-tilt mechanism.',
      category: 'Office Seating',
      basePrice: 15000.0,
      costPrice: 10000.0,
      stock: 80
    },
    {
      title: 'AeroMesh Task Chair',
      slug: 'aeromesh-task-chair',
      description: 'Breathable lightweight task chair engineered for agile workspaces and long productive hours.',
      category: 'Office Seating',
      basePrice: 8500.0,
      costPrice: 5500.0,
      stock: 150
    },
    {
      title: 'Solstice Solid Oak Standing Desk',
      slug: 'solstice-oak-standing-desk',
      description: 'Dual-motor electric height-adjustable desk featuring genuine solid oak tabletop and anti-collision technology.',
      category: 'Desks & Workstations',
      basePrice: 35000.0,
      costPrice: 24000.0,
      stock: 30
    },
    {
      title: 'Lumina Acoustic Desk Divider',
      slug: 'lumina-acoustic-divider',
      description: 'Sound-dampening acoustic privacy panel with fabric finish and universal desk clamp mount.',
      category: 'Accessories',
      basePrice: 4000.0,
      costPrice: 2200.0,
      stock: 200
    }
  ];

  for (const item of demoProducts) {
    const product = await prisma.product.upsert({
      where: {
        merchantId_slug: {
          merchantId: demoMerchant.id,
          slug: item.slug
        }
      },
      update: {
        basePrice: item.basePrice,
        costPrice: item.costPrice,
        description: item.description,
        category: item.category,
        isActive: true
      },
      create: {
        merchantId: demoMerchant.id,
        title: item.title,
        slug: item.slug,
        description: item.description,
        category: item.category,
        basePrice: item.basePrice,
        costPrice: item.costPrice,
        isActive: true
      }
    });

    const existingInv = await prisma.inventory.findFirst({
      where: {
        productId: product.id,
        variantId: null
      }
    });

    if (existingInv) {
      await prisma.inventory.update({
        where: { id: existingInv.id },
        data: {
          availableUnits: item.stock,
          reservedUnits: 0
        }
      });
    } else {
      await prisma.inventory.create({
        data: {
          merchantId: demoMerchant.id,
          productId: product.id,
          availableUnits: item.stock,
          reservedUnits: 0,
          location: 'Bangalore Primary Fulfillment Hub'
        }
      });
    }

    console.log(`📦 Product seeded: ${product.title} (₹${product.basePrice.toLocaleString('en-IN')} | Stock: ${item.stock})`);
  }

  // 6. Record Initial Seed Audit Event
  await prisma.auditEvent.create({
    data: {
      merchantId: demoMerchant.id,
      entityType: 'MERCHANT',
      entityId: demoMerchant.id,
      action: 'MERCHANT_INITIALIZED',
      actorType: 'SYSTEM',
      reason: 'Initial database seed for Agent Sauda demonstration',
      metadata: {
        seededBy: 'Agent Sauda System',
        productsCount: demoProducts.length
      }
    }
  });

  console.log('✅ Agent Sauda database seed completed successfully!');
}

seedDatabase()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
