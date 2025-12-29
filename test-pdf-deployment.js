/**
 * Test Production PDF Command Detection
 * Run: node test-pdf-deployment.js
 */

const testCommands = [
  'report',
  'pdf',
  'sales summary',
  'operational metrics',
  'low stock alert',
  'kirim pdf',
];

console.log('=== Testing Production PDF Command Detection ===\n');
console.log('Production URL: https://auto.lumiku.com\n');

testCommands.forEach(cmd => {
  const normalized = cmd.toLowerCase().trim();

  // Test single word triggers
  const isSingleWord = normalized === 'report' || normalized === 'pdf';

  // Test Indonesian variations
  const hasKirim = normalized.includes('kirim report') ||
                    normalized.includes('kirim pdf') ||
                    normalized.includes('kirim pdf nya') ||
                    normalized.includes('kirim reportnya') ||
                    normalized.includes('kirim pdfnya');

  // Test specific report names
  const hasSpecific = normalized.includes('sales report') ||
                      normalized.includes('operational metrics') ||
                      normalized.includes('operational metric') ||
                      normalized.includes('low stock alert') ||
                      normalized.includes('sales summary');

  // Test regex patterns
  const salesMetrics = /\b(sales|penjualan)\s+(summary|report|metrics|data|analytics)\b/i.test(normalized);
  const metricsSales = /\b(metrics|metrix)\s+(sales|penjualan|operational|pelanggan|customer)\b/i.test(normalized);

  const isDetected = isSingleWord || hasKirim || hasSpecific || salesMetrics || metricsSales;

  console.log(`Command: "${cmd}"`);
  console.log(`  → Single word: ${isSingleWord ? '✅' : '❌'}`);
  console.log(`  → Indonesian: ${hasKirim ? '✅' : '❌'}`);
  console.log(`  → Specific: ${hasSpecific ? '✅' : '❌'}`);
  console.log(`  → Regex sales+metrics: ${salesMetrics ? '✅' : '❌'}`);
  console.log(`  → Regex metrics+sales: ${metricsSales ? '✅' : '❌'}`);
  console.log(`  → ** DETECTED: ${isDetected ? '✅ YES' : '❌ NO'} **`);
  console.log('');
});

console.log('\n=== Expected Results ===');
console.log('✅ ALL commands should be detected (✅ YES)');
console.log('\nIf any command shows ❌ NO, the fix is NOT deployed yet.');
console.log('\nTo verify deployment, test via WhatsApp:');
console.log('1. Send "report" to +62 853-8541-9766');
console.log('2. Should show PDF list, NOT dummy data');
console.log('3. Send "sales summary" to +62 853-8541-9766');
console.log('4. Should send PDF file');
