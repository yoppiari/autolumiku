/**
 * Test: Budget Filtering Fix
 * 
 * This test demonstrates the budget filtering bug fix.
 * Run this file to verify the extractBudget function works correctly.
 */

// Simulate the extractBudget function
function extractBudget(message: string): number | null {
    if (!message) return null;

    const msg = message.toLowerCase();

    // Pattern 1: "budget 65 jt", "anggaran 100 juta", "dana 50jt"
    const withKeyword = msg.match(/(?:budget|anggaran|dana|harga|price)\s*(\d+)\s*(jt|juta|million)/i);
    if (withKeyword) {
        return parseInt(withKeyword[1]) * 1000000;
    }

    // Pattern 2: "65 jt", "100 juta", "50jt" (standalone numbers)
    const standalone = msg.match(/\b(\d+)\s*(jt|juta)\b/i);
    if (standalone) {
        return parseInt(standalone[1]) * 1000000;
    }

    return null;
}

// Mock inventory
const vehicles = [
    { make: 'Honda', model: 'City', year: 2006, price: 79000000, displayId: 'PM-PST-001' },
    { make: 'Toyota', model: 'Fortuner', year: 2021, price: 345000000, displayId: 'PM-PST-002' },
];

// Test cases
const testCases = [
    { input: "kalau budget 300jt ada?", expected: 300000000 },
    { input: "budget 50jt", expected: 50000000 },
    { input: "ada mobil budget 150 juta?", expected: 150000000 },
    { input: "harga", expected: null }, // No budget amount
    { input: "budget", expected: null }, // No budget amount
    { input: "65jt", expected: 65000000 },
];

console.log("=== Budget Extraction Tests ===\n");

testCases.forEach((test, i) => {
    const result = extractBudget(test.input);
    const passed = result === test.expected;
    console.log(`Test ${i + 1}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Input: "${test.input}"`);
    console.log(`  Expected: ${test.expected ? `Rp ${test.expected / 1000000}jt` : 'null'}`);
    console.log(`  Got: ${result ? `Rp ${result / 1000000}jt` : 'null'}`);
    console.log();
});

console.log("\n=== Budget Filtering Tests ===\n");

// Test budget filtering logic
function testBudgetFiltering(userMessage: string) {
    const budget = extractBudget(userMessage);

    console.log(`User: "${userMessage}"`);
    console.log(`Budget detected: ${budget ? `Rp ${Math.round(budget / 1000000)} juta` : 'None'}`);

    if (budget && budget > 0) {
        const minPrice = budget * 0.6; // Don't show vehicles too cheap
        const maxPrice = budget * 1.2; // Allow 20% over budget
        const relevantVehicles = vehicles.filter(v => v.price >= minPrice && v.price <= maxPrice);

        console.log(`Price range: Rp ${Math.round(minPrice / 1000000)} - ${Math.round(maxPrice / 1000000)} juta`);
        console.log(`Matching vehicles: ${relevantVehicles.length}`);

        if (relevantVehicles.length > 0) {
            relevantVehicles.forEach(v => {
                console.log(`  ✅ ${v.make} ${v.model} ${v.year} - Rp ${Math.round(v.price / 1000000)} juta | ${v.displayId}`);
            });
        } else {
            console.log(`  ⚠️ No vehicles within budget range`);
        }

        // Show excluded vehicles
        const tooChep = vehicles.filter(v => v.price < minPrice);
        const tooExpensive = vehicles.filter(v => v.price > maxPrice);

        if (tooChep.length > 0) {
            console.log(`Excluded (too cheap - below ${Math.round(minPrice / 1000000)}jt):`);
            tooChep.forEach(v => {
                console.log(`  ❌ ${v.make} ${v.model} ${v.year} - Rp ${Math.round(v.price / 1000000)} juta | ${v.displayId}`);
            });
        }

        if (tooExpensive.length > 0) {
            console.log(`Excluded (too expensive - above ${Math.round(maxPrice / 1000000)}jt):`);
            tooExpensive.forEach(v => {
                console.log(`  ❌ ${v.make} ${v.model} ${v.year} - Rp ${Math.round(v.price / 1000000)} juta | ${v.displayId}`);
            });
        }
    } else {
        console.log(`⚠️ No budget detected - would show premium vehicles`);
    }
    console.log();
}

// Run filtering tests
testBudgetFiltering("kalau budget 300jt ada?");
testBudgetFiltering("budget 50jt");
testBudgetFiltering("budget 400jt");
testBudgetFiltering("budget"); // Edge case: keyword without amount
testBudgetFiltering("harga"); // Edge case: keyword without amount
