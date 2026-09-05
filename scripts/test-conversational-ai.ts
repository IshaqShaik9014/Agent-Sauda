import { buildApp } from '../apps/api/src/app.js';
import { prisma } from '@agent-sauda/database';

async function testConversationalAI() {
  console.log('🤖 ======================================================================');
  console.log('🤖 AGENT SAUDA — NATURAL LANGUAGE AI CONVERSATION TEST HARNESS');
  console.log('🤖 ======================================================================\n');

  const app = buildApp();
  await app.ready();

  // Find or create active demo merchant
  let merchant = await prisma.merchant.findFirst({
    where: { slug: 'abc-furniture' },
    include: { products: true }
  });

  if (!merchant) {
    merchant = await prisma.merchant.findFirst({
      include: { products: true }
    });
  }

  if (!merchant || merchant.products.length === 0) {
    throw new Error('No merchant with catalog products found.');
  }

  console.log(`🏪 Active Merchant: "${merchant.name}" (Slug: ${merchant.slug}, Products: ${merchant.products.length})`);

  let conversationId: string | undefined = undefined;

  const sendMessage = async (message: string, expectedPattern?: RegExp) => {
    console.log(`\n👤 User: "${message}"`);
    const res = await app.inject({
      method: 'POST',
      url: `/api/merchants/${merchant?.id}/agent/chat`,
      payload: {
        conversationId,
        message,
        customerId: 'test_user_ai_check'
      }
    });

    if (res.statusCode !== 200) {
      throw new Error(`Chat failed with HTTP ${res.statusCode}: ${res.body}`);
    }

    const data = JSON.parse(res.body);
    conversationId = data.conversationId;
    const replyText = data.message || '';
    console.log(`🤖 Agent: ${replyText}`);

    if (expectedPattern && !expectedPattern.test(replyText)) {
      throw new Error(`Response did not match expected pattern: ${expectedPattern}`);
    }

    return data;
  };

  // 1. Test Policy Question ("return what policy ?")
  console.log('\n--- TEST 1: Policy Question (RAG) ---');
  await sendMessage('return what policy ?', /(?:return|policy|days|according)/i);

  // 2. Test Unsolicited Affirmation ("sauda pakka")
  console.log('\n--- TEST 2: Unsolicited Affirmation ---');
  await sendMessage('sauda pakka', /(?:proceed|which product|catalog|price)/i);

  // 3. Test Percentage Volume Discount ("10 Ergonomic Study Chairs for 10%")
  console.log('\n--- TEST 3: 10 Study Chairs for 10% ---');
  await sendMessage('10 Ergonomic Study Chairs for 10%', /(?:discount|offer|counter-offer|₹)/i);

  // 4. Test Multi-word Affirmation ("yeah ok")
  console.log('\n--- TEST 4: Multi-Word Affirmation ("yeah ok") ---');
  const affRes1 = await sendMessage('yeah ok', /(?:deal confirmed|locked|quote card|checkout)/i);
  if (!affRes1.activeOffer?.id) {
    throw new Error('Expected activeOffer to be generated on deal confirmation!');
  }
  console.log(`   ✅ Active Commercial Offer Generated: ${affRes1.activeOffer.id} (Total: ₹${affRes1.activeOffer.totalAmount})`);

  // 5. Test Fix The Deal ("fix the deal")
  console.log('\n--- TEST 5: Fix The Deal Phrase ---');
  await sendMessage('fix the deal', /(?:deal confirmed|locked|quote card|checkout)/i);

  // 6. Test Best Price / Lowest Price
  console.log('\n--- TEST 6: Best Price Request ---');
  await sendMessage('what is your best price on 5 chairs?', /(?:best authorized price|₹|lock this deal)/i);

  // 7. Test Product Spec Inquiry ("tell me about the chair")
  console.log('\n--- TEST 7: Product Inquiry ---');
  await sendMessage('tell me about the chair', /(?:price|stock|warehouse|available)/i);

  // 8. Test Gratitude ("thank you so much")
  console.log('\n--- TEST 8: Gratitude ---');
  await sendMessage('thank you so much', /(?:welcome|always here|great day|happy)/i);

  await app.close();
  await prisma.$disconnect();

  console.log('\n======================================================================');
  console.log('🎉 ALL NATURAL LANGUAGE CONVERSATIONAL AI TESTS PASSED 100%!');
  console.log('   • RAG Policy Q&A returns grounded answers');
  console.log('   • Multi-word affirmations ("yeah ok", "fix the deal") confirmed');
  console.log('   • Commercial Offer Record automatically generated');
  console.log('   • Best price inquiries and stock inquiries handled seamlessly');
  console.log('======================================================================');
}

testConversationalAI().catch((err) => {
  console.error('❌ Conversational Test Failed:', err);
  process.exit(1);
});
