/**
 * Production Command Testing Script
 * Tests WhatsApp AI commands in production environment
 */

const PRODUCTION_URL = 'https://primamobil.id';
const COMMAND_ENDPOINT = `${PRODUCTION_URL}/api/v1/whatsapp-ai/command`;

interface CommandResult {
  success: boolean;
  message?: string;
  hasPDF?: boolean;
  filename?: string;
  followUp?: boolean;
}

interface TestContext {
  tenantId: string;
  userId: string;
  userRole: string;
  userRoleLevel: number;
  phoneNumber: string;
}

/**
 * Test a single command
 */
async function testCommand(
  command: string,
  context: TestContext
): Promise<CommandResult> {
  const response = await fetch(COMMAND_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      command,
      ...context
    }),
  });

  const data = await response.json();
  return data;
}

/**
 * Display test result
 */
function displayResult(command: string, result: CommandResult) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🧪 Command: "${command}"`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Success: ${result.success}`);
  console.log(`📄 Message:`);
  console.log(result.message?.substring(0, 300));
  if (result.message && result.message.length > 300) console.log('...');
  if (result.hasPDF) {
    console.log(`📦 PDF: ${result.filename}`);
  }
  if (result.followUp) {
    console.log(`💬 Follow-up: enabled`);
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('========================================');
  console.log('🚀 WhatsApp AI Commands - Production Test');
  console.log('========================================');
  console.log(`📍 URL: ${PRODUCTION_URL}`);
  console.log(`🔗 Endpoint: ${COMMAND_ENDPOINT}`);

  // NOTE: Replace these with actual production values
  // You can get these from:
  // 1. Database: SELECT id, name FROM tenant LIMIT 1;
  // 2. Database: SELECT id, firstName, lastName, role, roleLevel, phone FROM "User" LIMIT 1;

  const testContext: TestContext = {
    tenantId: 'YOUR_TENANT_ID', // Replace with actual tenant ID from production
    userId: 'YOUR_USER_ID',     // Replace with actual user ID from production
    userRole: 'ADMIN',          // Or 'SALES', 'OWNER', 'SUPER_ADMIN'
    userRoleLevel: 90,          // SALES: 50, ADMIN: 90, OWNER: 95, SUPER_ADMIN: 100
    phoneNumber: '6281234567890'
  };

  console.log('\n⚠️  NOTE: Update testContext with actual production credentials!');
  console.log('   Get tenant ID from: SELECT id, name FROM tenant LIMIT 1;');
  console.log('   Get user info from: SELECT id, firstName, lastName, role, roleLevel FROM "User" LIMIT 1;');
  console.log('\nSkipping actual API calls until credentials are provided.\n');

  // Display test plan
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Test Plan');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const tests = [
    { command: 'status', desc: 'Show showroom status', type: 'universal' },
    { command: 'inventory', desc: 'Check inventory', type: 'universal' },
    { command: 'statistik', desc: 'View statistics', type: 'universal' },
    { command: 'sales report', desc: 'Generate sales report PDF', type: 'admin' },
    { command: 'whatsapp ai', desc: 'Generate WhatsApp AI analytics PDF', type: 'admin' },
  ];

  tests.forEach((test, idx) => {
    const badge = test.type === 'admin' ? '🔐' : '✅';
    console.log(`${idx + 1}. ${badge} "${test.command}" - ${test.desc}`);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Example: Test via WhatsApp (Production)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1. Open WhatsApp on your phone');
  console.log('2. Send message to showroom number: +62 8xx-xxxx-xxxx');
  console.log('3. Type: status');
  console.log('4. Expected: Showroom status breakdown');
  console.log('5. Type: sales report (if admin)');
  console.log('6. Expected: PDF sent via WhatsApp');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Test Plan Created!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\nNext steps:');
  console.log('1. Update testContext with real credentials');
  console.log('2. Run: npx tsx test-production-commands.ts');
  console.log('3. Or test via WhatsApp directly');
  console.log('');
}

runTests().catch(console.error);
