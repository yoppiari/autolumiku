// Check phone normalization match
const normalizePhone = (phone) => {
  if (!phone) return "";
  if (phone.includes("@")) phone = phone.split("@")[0];
  if (phone.includes(":")) phone = phone.split(":")[0];
  return phone.replace(/\D/g, "");
};

const incomingPhone = "6281310703754";
const dbPhone = "6281310703754";

const normalizedIncoming = normalizePhone(incomingPhone);
const normalizedDB = normalizePhone(dbPhone);

console.log("=== Phone Matching Check ===\n");
console.log(`Incoming phone: "${incomingPhone}"`);
console.log(`DB phone: "${dbPhone}"\n`);
console.log(`Normalized incoming: "${normalizedIncoming}"`);
console.log(`Normalized DB: "${normalizedDB}"\n`);
console.log(`Match: ${normalizedIncoming === normalizedDB ? '✅ YES' : '❌ NO'}`);

if (normalizedIncoming !== normalizedDB) {
  console.log("\n❌ PHONES DON'T MATCH! User will NOT be found.");
} else {
  console.log("\n✅ Phones match! Problem is elsewhere.");
  console.log("\nPossible issues:");
  console.log("1. Command not detected (but logic is correct)");
  console.log("2. Error in PDF generation (no logs shown)");
  console.log("3. Error sending to Aimeow (failed silently)");
}
