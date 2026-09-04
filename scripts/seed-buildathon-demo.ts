import bcrypt from 'bcrypt';
import { prisma, warmupDatabase } from '../packages/database/src/index.js';
import { knowledgeService } from '../apps/api/src/modules/knowledge/knowledge.service.js';

/**
 * ROCK-SOLID BUILDATHON DEMO SEED SCRIPT
 * Sets up "ABC Furniture" with:
 * 1. Owner account (admin@abcfurniture.in / Demo1234!)
 * 2. Unstructured Policy Documents for pgvector RAG (Return, Warranty, Shipping)
 * 3. Exact ₹6,000 Study Chair and ₹24,000 Executive Desk
 * 4. Deterministic 5% / 10% policy guardrails
 */
async function seedBuildathonDemo() {
  console.log('🌱 ======================================================================');
  console.log('🌱 AGENT SAUDA — RAZORPAY BUILDATHON DEMO SEED');
  console.log('🌱 ======================================================================\n');

  console.log('⚡ Ensuring Neon Cloud Database is awake...');
  await warmupDatabase(8, 3000);

  // 1. Ensure or create Merchant: ABC Furniture
  let merchant = await prisma.merchant.findUnique({
    where: { slug: 'abc-furniture' }
  });

  if (!merchant) {
    merchant = await prisma.merchant.create({
      data: {
        name: 'ABC Furniture Ltd',
        slug: 'abc-furniture',
        currency: 'INR'
      }
    });
    console.log(`✅ Created Merchant: "${merchant.name}" (Slug: ${merchant.slug})`);
  } else {
    console.log(`ℹ️ Merchant "${merchant.name}" already exists (${merchant.id}).`);
  }

  // 2. Ensure or create Admin User
  const email = 'admin@abcfurniture.in';
  let user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    const passwordHash = await bcrypt.hash('Demo1234!', 10);
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: 'Anand Sharma'
      }
    });
    console.log(`✅ Created Admin User: "${user.name}" (${user.email})`);
  }

  // Ensure Merchant Membership
  const membership = await prisma.merchantMember.findUnique({
    where: {
      merchantId_userId: {
        merchantId: merchant.id,
        userId: user.id
      }
    }
  });

  if (!membership) {
    await prisma.merchantMember.create({
      data: {
        merchantId: merchant.id,
        userId: user.id,
        role: 'OWNER'
      }
    });
    console.log('✅ Linked user as OWNER of ABC Furniture.');
  }

  // 3. Configure Deterministic Policy Engine Guardrails
  // Rule: Max discount = 10%, Auto-approval limit = 5%, Threshold = ₹5,500
  await prisma.policy.upsert({
    where: { merchantId: merchant.id },
    create: {
      merchantId: merchant.id,
      maxDiscountPercent: 10.0,
      minimumMarginPercent: 18.0,
      autonomousOrderLimit: 10000.0,
      approvalThreshold: 5500.0, // Deals over ₹5,500 with discount > 5% require manager approval
      maxQuantityPerOrder: 50,
      rules: {
        autoApproveDiscountPercent: 5.0,
        managerApprovalRequiredDiscountPercent: 10.0,
        minimumAcceptablePrice: 5400.0
      },
      isActive: true
    },
    update: {
      maxDiscountPercent: 10.0,
      minimumMarginPercent: 18.0,
      approvalThreshold: 5500.0,
      rules: {
        autoApproveDiscountPercent: 5.0,
        managerApprovalRequiredDiscountPercent: 10.0,
        minimumAcceptablePrice: 5400.0
      },
      isActive: true
    }
  });
  console.log('✅ Configured Merchant Policy Guardrails (Max 10% discount, 5-10% HITL approval).');

  // 4. Seed Products and Real-Time Inventory
  // Product 1: Ergonomic Study Chair (Base: ₹6,000, Cost: ₹4,500)
  const studyChair = await prisma.product.upsert({
    where: {
      merchantId_slug: {
        merchantId: merchant.id,
        slug: 'ergonomic-study-chair'
      }
    },
    create: {
      merchantId: merchant.id,
      title: 'Ergonomic Study Chair',
      slug: 'ergonomic-study-chair',
      description: 'High-back mesh study chair with adjustable lumbar support and pneumatic height adjustment.',
      category: 'Seating',
      basePrice: 6000.0,
      costPrice: 4500.0,
      isActive: true
    },
    update: {
      basePrice: 6000.0,
      costPrice: 4500.0,
      isActive: true
    }
  });

  const existingInv1 = await prisma.inventory.findFirst({
    where: { productId: studyChair.id, variantId: null }
  });
  if (existingInv1) {
    await prisma.inventory.update({
      where: { id: existingInv1.id },
      data: { availableUnits: 50, reservedUnits: 0 }
    });
  } else {
    await prisma.inventory.create({
      data: {
        merchantId: merchant.id,
        productId: studyChair.id,
        availableUnits: 50,
        reservedUnits: 0,
        location: 'Bangalore Central Warehouse'
      }
    });
  }
  console.log(`✅ Seeded Product: "${studyChair.title}" — Base Price: ₹6,000 (Cost: ₹4,500, Stock: 50 units)`);

  // Product 2: Executive Walnut Desk (Base: ₹24,000, Cost: ₹17,000)
  const walnutDesk = await prisma.product.upsert({
    where: {
      merchantId_slug: {
        merchantId: merchant.id,
        slug: 'executive-walnut-desk'
      }
    },
    create: {
      merchantId: merchant.id,
      title: 'Executive Walnut Desk',
      slug: 'executive-walnut-desk',
      description: 'Solid walnut executive desk with cable management channels and scratch-resistant matte finish.',
      category: 'Desks',
      basePrice: 24000.0,
      costPrice: 17000.0,
      isActive: true
    },
    update: {
      basePrice: 24000.0,
      costPrice: 17000.0,
      isActive: true
    }
  });

  const existingInv2 = await prisma.inventory.findFirst({
    where: { productId: walnutDesk.id, variantId: null }
  });
  if (existingInv2) {
    await prisma.inventory.update({
      where: { id: existingInv2.id },
      data: { availableUnits: 30, reservedUnits: 0 }
    });
  } else {
    await prisma.inventory.create({
      data: {
        merchantId: merchant.id,
        productId: walnutDesk.id,
        availableUnits: 30,
        reservedUnits: 0,
        location: 'Bangalore Central Warehouse'
      }
    });
  }
  console.log(`✅ Seeded Product: "${walnutDesk.title}" — Base Price: ₹24,000 (Stock: 30 units)`);

  // 5. Seed Merchant Knowledge Documents (pgvector RAG)
  const existingDocs = await prisma.merchantDocument.count({
    where: { merchantId: merchant.id }
  });

  if (existingDocs === 0) {
    console.log('\n📄 Ingesting Merchant Policy Documents into pgvector...');

    // Doc 1: Return Policy
    await knowledgeService.ingestDocument(
      merchant.id,
      {
        title: 'Official Return & Refund Policy 2026',
        documentType: 'RETURN_POLICY',
        content: `ABC Furniture Return and Refund Policy:
Furniture items can be returned within 7 calendar days of delivery.
Assembled furniture cannot be returned under any circumstances unless there is an authentic manufacturing defect verified by our technical inspection team.
Custom upholstered or bespoke fabric orders are strictly non-refundable.
Refunds are processed to the original payment method within 5 to 7 business days after warehouse inspection.`
      },
      user.id
    );
    console.log('   ✅ Ingested "Official Return & Refund Policy 2026"');

    // Doc 2: Warranty Policy
    await knowledgeService.ingestDocument(
      merchant.id,
      {
        title: 'Comprehensive Warranty Guidelines 2026',
        documentType: 'WARRANTY',
        content: `ABC Furniture Comprehensive Warranty Guidelines:
All solid wood tables and ergonomic executive office chairs include a 3-year limited structural warranty.
Warranty covers frame warping, joint failure, and hydraulic gas-lift cylinder malfunction.
Warranty explicitly excludes normal fabric wear and tear, accidental liquid spills, and modifications made by unauthorized technicians.`
      },
      user.id
    );
    console.log('   ✅ Ingested "Comprehensive Warranty Guidelines 2026"');

    // Doc 3: Shipping Policy
    await knowledgeService.ingestDocument(
      merchant.id,
      {
        title: 'Pan-India Shipping & Delivery Terms 2026',
        documentType: 'SHIPPING',
        content: `ABC Furniture Shipping & Delivery Guidelines:
We provide free express delivery across all tier-1 and tier-2 Indian cities for orders above ₹10,000.
Orders below ₹10,000 incur a standard flat shipping fee of ₹499.
Dispatch occurs within 24 to 48 business hours via Delhivery Prime or BlueDart with end-to-end milestone tracking.`
      },
      user.id
    );
    console.log('   ✅ Ingested "Pan-India Shipping & Delivery Terms 2026"');
  } else {
    console.log(`ℹ️ Merchant already has ${existingDocs} knowledge documents in pgvector.`);
  }

  console.log('\n======================================================================');
  console.log('🎉 BUILDATHON DEMO SEED COMPLETED SUCCESSFULLY!');
  console.log('======================================================================');
  console.log('Credentials & Access:');
  console.log('  • Merchant Name: ABC Furniture Ltd (slug: "abc-furniture")');
  console.log(`  • Merchant ID:   ${merchant.id}`);
  console.log('  • Admin Login:   admin@abcfurniture.in / Demo1234!');
  console.log('  • Storefront UI: http://localhost:3000/negotiate/abc-furniture');
  console.log('  • Admin Portal:  http://localhost:3000/admin');
  console.log('  • Approvals UI:  http://localhost:3000/admin/approvals');
  console.log('======================================================================\n');

  await prisma.$disconnect();
}

seedBuildathonDemo().catch((err) => {
  console.error('❌ Seed Failed:', err);
  process.exit(1);
});
