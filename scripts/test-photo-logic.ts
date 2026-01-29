
/**
 * Test script for AI Photo Sending Logic
 * Verifies the regex and logic used to detect photo requests vs information requests.
 */

function testPhotoDecisionLogic(msg: string, isPhotoConfirmation: boolean = false): boolean {
    msg = msg.toLowerCase();

    // Logic from WhatsAppAIChatService.generateSmartFallback
    const hasPhotoKeyword = msg.includes("foto") || msg.includes("gambar") ||
        /mana.*(foto|gambar)/i.test(msg) ||
        msg.startsWith("mana ");

    const hasVisualDetailKeyword = /\b(interior|eksterior|detail|mesin|dalam|body|kondisi|fisik)/i.test(msg);
    const hasExplanationKeyword = /\b(jelaskan|penjelasan|jabarkan|penjabaran|deskripsi|ceritakan|info|kabar|surat|dokumen)/i.test(msg);

    // AI 5.4 Logic: ONLY trigger auto-photo if:
    // 1. Explicit photo keyword is present
    // 2. Visual keyword is present AND NO explanation keyword is present
    const userExplicitlyAsksPhoto = hasPhotoKeyword || (hasVisualDetailKeyword && !hasExplanationKeyword);

    const result = isPhotoConfirmation || userExplicitlyAsksPhoto;

    console.log(`Input: "${msg}"`);
    console.log(`  - hasPhotoKeyword: ${hasPhotoKeyword}`);
    console.log(`  - hasVisualDetailKeyword: ${hasVisualDetailKeyword}`);
    console.log(`  - hasExplanationKeyword: ${hasExplanationKeyword}`);
    console.log(`  - RESULT (Trigger Photo): ${result}`);
    console.log('---');

    return result;
}

const photoDecisionTestScenarios = [
    // Should trigger photo
    { msg: "kirim foto interior", expected: true },
    { msg: "mana gambar mesinnya?", expected: true },
    { msg: "foto eksterior dong", expected: true },
    { msg: "lihat interiornya", expected: true },
    { msg: "kondisi fisik gimana? kirim foto", expected: true },

    // Should NOT trigger photo (verbal requests)
    { msg: "jelaskan kondisi interiornya", expected: false },
    { msg: "jabarkan kelengkapan surat", expected: false },
    { msg: "minta penjelasan eksterior", expected: false },
    { msg: "surat berarti lengkap ya?", expected: false },
    { msg: "deskripsi mesinnya gimana?", expected: false },

    // Mixed cases
    { msg: "penjelasan interior dan kirim fotonya juga", expected: true }, // hasPhotoKeyword wins
];

let photoDecisionFailCount = 0;
photoDecisionTestScenarios.forEach(tc => {
    const result = testPhotoDecisionLogic(tc.msg);
    if (result !== tc.expected) {
        console.error(`❌ FAILED: Expected ${tc.expected}, got ${result} for "${tc.msg}"`);
        photoDecisionFailCount++;
    } else {
        console.log(`✅ PASSED: "${tc.msg}"`);
    }
});

if (photoDecisionFailCount === 0) {
    console.log("\n✨ ALL REGEX TESTS PASSED!");
} else {
    console.error(`\n💥 ${photoDecisionFailCount} TESTS FAILED!`);
    process.exit(1);
}

export { };
