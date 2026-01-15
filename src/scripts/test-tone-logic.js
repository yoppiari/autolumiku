
/**
 * Test Script for AI 5.2 Tone Analysis logic validation
 * Standalone version to avoid module resolution issues during quick testing
 */

// --- COPY OF THE LOGIC FROM chat.service.ts ---
function analyzeCustomerTone(message) {
    let cuekScore = 0;
    let aktifScore = 0;
    const msg = message.trim();
    const words = msg.split(/\s+/);
    const wordCount = words.length;

    // 1. Word Count <= 3 -> Cuek +2
    if (wordCount <= 3) {
        cuekScore += 2;
    }

    // 3. Emoji -> Aktif +1
    const emojiPattern = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}]/u;
    if (emojiPattern.test(msg)) {
        aktifScore += 1;
    }

    // 4. Greeting -> Aktif +1 (New Proxy)
    const greetingPattern = /^(halo|hai|selamat|pagi|siang|sore|malam|assalam|permisi|hi|hello)/i;
    if (greetingPattern.test(msg)) {
        aktifScore += 1;
    }

    // 5. Question -> Aktif +1 (New Proxy)
    if (msg.includes('?')) {
        aktifScore += 1;
    }

    // 6. Typo/Slang -> Cuek +1
    const typoPattern = /\b(brp|hrg|kpn|knp|sy|u|yg|gak|gx|ga|tx|thx|cm|kmn|dp|skrg|dmn)\b/i;
    if (typoPattern.test(msg)) {
        cuekScore += 1;
    }

    // Calculate Final Score
    const score = cuekScore - aktifScore;

    if (score >= 2) return 'CUEK';
    if (score <= -2) return 'AKTIF';
    return 'NORMAL';
}
// ----------------------------------------------

const testCases = [
    {
        name: "CUEK - Short Word Count",
        msg: "harga avanza",
        expected: "CUEK",
        reason: "Words <= 3 (+2 Cuek) -> Score 2"
    },
    {
        name: "CUEK - Typo Indicators",
        msg: "brp hrg fortuner gan",
        expected: "CUEK",
        reason: "brp, hrg (+1 Cuek) -> Score 1 (Wait, word count is 4. Score = 1. Threshold is >=2. Let's trace.)"
        // Trace: "brp hrg fortuner gan" -> 4 words. cuekScore=0.
        // Typo: yes (+1). Total Score = 1. Result: NORMAL.
        // User requirement: "brp" should be CUEK.
        // Maybe my threshold logic needs tuning or the test case expectation is wrong?
        // Let's see the result.
    },
    {
        name: "CUEK - Extremely Short & Typo",
        msg: "hrg brp",
        expected: "CUEK",
        reason: "Words 2 (+2 Cuek) + Typo (+1 Cuek) -> Score 3"
    },
    {
        name: "AKTIF - Emoji & Greetings",
        msg: "Halo kak, selamat siang 😊 mau tanya stok honda jazz ya",
        expected: "AKTIF",
        reason: "Emoji (+1 Aktif) -> Score -1. Wait, threshold is <= -2. Need more active signals."
        // Need to check if I missed any logic.
        // Original logic had "Greeting (-1)" and "Question (-1)".
        // My implementation in ChatService REPLACED that with the user's pseudo code "Score = Cuek - Aktif".
        // User pseudo code:
        // if responseTime < 60: aktif += 2
        // if emoji: aktif += 1
        // Score = Cuek - Aktif
        // <= -2 is Aktif.
        // Without response time (which we skipped), getting to -2 requires 2 emojis?
        // Let's test "Halo kak 😊 ✨"
    },
    {
        name: "AKTIF - Multiple Emojis",
        msg: "Halo kak!! 😊 Mau tanya dong ✨",
        expected: "AKTIF", // Should be?
        reason: "Emoji (+1). Words > 3. Score -1. Still NORMAL."
    },
    {
        name: "NORMAL - Standard",
        msg: "Saya mau lihat honda civic 2019",
        expected: "NORMAL",
        reason: "Words > 3. No typos. No emojis. Score 0."
    }
];

function runTest() {
    console.log("🧪 TESTING AI 5.2 TONE ANALYSIS LOGIC (STANDALONE)");
    console.log("==================================================");

    testCases.forEach((tc, i) => {
        const result = analyzeCustomerTone(tc.msg);

        // Dynamic Pass/Fail based on EXPECTATION vs RESULT
        // But for "brp hrg fortuner gan", if it returns NORMAL but we expect CUEK, we should note it.

        console.log(`\nTest #${i + 1}: ${tc.name}`);
        console.log(`Input:    "${tc.msg}"`);
        console.log(`Expected: ${tc.expected}`);
        console.log(`Result:   ${result}`);

        // Helper to see score breakdown
        const debugMsg = tc.msg.trim();
        const words = debugMsg.split(/\s+/).length;
        const hasTypo = /\b(brp|hrg|kpn|knp|sy|u|yg|gak|gx|ga|tx|thx|cm|kmn|dp|skrg|dmn)\b/i.test(debugMsg);
        const hasEmoji = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}]/u.test(debugMsg);
        console.log(`Debug:    Words=${words}, Typo=${hasTypo}, Emoji=${hasEmoji}`);
    });

    console.log("\n==================================================");
}

runTest();
