
import { prisma } from '../src/lib/prisma';

async function checkHealth() {
  console.log('--- System Health Check ---');
  try {
    const accounts = await prisma.aimeowAccount.findMany({
      where: { isActive: true }
    });
    
    console.log(`Active Accounts: ${accounts.length}`);
    accounts.forEach(acc => {
      console.log(`- Account: ${acc.phoneNumber} | Status: ${acc.connectionStatus} | Client: ${acc.clientId}`);
    });

    const now = new Date();
    console.log(`Current Server Time: ${now.toISOString()}`);
    
    // Check pending catchups
    const pending = await prisma.whatsAppConversation.count({
      where: {
        contextData: {
          path: ['needsCatchup'],
          equals: true
        }
      }
    });
    console.log(`Conversations needing catch-up: ${pending}`);

    // Check last messages
    const lastMsg = await prisma.whatsAppMessage.findFirst({
      orderBy: { createdAt: 'desc' }
    });
    console.log(`Last message in DB: ${lastMsg?.createdAt?.toISOString()} (${lastMsg?.direction})`);

  } catch (err) {
    console.error('Error fetching data:', err);
  } finally {
    await prisma.$disconnect();
  }
}

checkHealth();
