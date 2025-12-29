// Test PDF command detection
const testCommands = [
  "operational metrics",
  "sales summary",
  "low stock alert",
  "report",
  "kirim pdf"
];

function isPDFCommand(message) {
  const normalized = message.toLowerCase().trim();

  if (normalized === 'report' || normalized === 'pdf') return true;

  const patterns = [
    'sales report',
    'operational metrics',
    'operational metric',
    'low stock alert',
    'sales summary',
    'kirim pdf',
    'kirim report'
  ];

  if (patterns.some(p => normalized.includes(p))) return true;

  if (/\b(sales|penjualan)\s+(summary|report|metrics)\b/i.test(normalized)) return true;
  if (/\b(metrics|metrix)\s+(sales|penjualan|operational|pelanggan|customer)\b/i.test(normalized)) return true;

  return false;
}

console.log("=== PDF Command Detection Test ===\n");
testCommands.forEach(cmd => {
  const detected = isPDFCommand(cmd);
  console.log(`"${cmd}" → ${detected ? '✅ YES' : '❌ NO'}`);
});
