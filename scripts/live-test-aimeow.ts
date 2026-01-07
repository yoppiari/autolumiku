
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const AIMEOW_BASE_URL = process.env.AIMEOW_BASE_URL || "https://meow.lumiku.com";
const TEST_PHONE = "6285385419766"; // User's number from logs

async function runLiveTest() {
    console.log(`\n🚀 STARTING LIVE AIMEOW API TEST`);
    console.log(`📍 Base URL: ${AIMEOW_BASE_URL}`);

    try {
        // 1. Get Clients
        console.log(`\n1️⃣ Fetching Clients...`);
        const clientsRes = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients`);

        if (!clientsRes.ok) {
            throw new Error(`Failed to fetch clients: ${clientsRes.status} ${clientsRes.statusText}`);
        }

        const clients = await clientsRes.json();
        console.log(`✅ Found ${clients.length} clients.`);

        const connectedClient = clients.find((c: any) => c.isConnected);
        if (!connectedClient) {
            throw new Error("❌ No connected clients found! Cannot proceed.");
        }

        const clientId = connectedClient.id;
        console.log(`✅ Using Connected Client ID: ${clientId} (${connectedClient.phone})`);

        // 2. Test Send Text (Baseline)
        console.log(`\n2️⃣ Testing /send-message (Text)...`);
        const textEndpoint = `${AIMEOW_BASE_URL}/api/v1/clients/${clientId}/send-message`;
        console.log(`   Endpoint: ${textEndpoint}`);

        const textRes = await fetch(textEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                phone: TEST_PHONE,
                message: "🤖 Tes koneksi dari Autolumiku Debugger (Text)",
            })
        });

        if (!textRes.ok) {
            const err = await textRes.text();
            console.error(`❌ Text Send Failed: ${textRes.status} - ${err}`);
        } else {
            const data = await textRes.json();
            console.log(`✅ Text Send Success! ID: ${data.messageId || data.id}`);
        }

        // 3. Test Send Image (The Issue)
        console.log(`\n3️⃣ Testing /send-image (Base64)...`);
        const imageEndpoint = `${AIMEOW_BASE_URL}/api/v1/clients/${clientId}/send-image`;
        console.log(`   Endpoint: ${imageEndpoint}`);

        // Tiny 1x1 Red Dot GIF Base64
        const base64Image = "R0lGODlhAQABAIEAAAAAAP///yH5BAEAAAEALAAAAAABAAEAAAICTAEAOw==";

        const imagePayload = {
            clientId: clientId,
            phone: TEST_PHONE,
            image: `data:image/gif;base64,${base64Image}`,
            caption: "🤖 Tes koneksi (Gambar Base64)"
        };

        const imageRes = await fetch(imageEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(imagePayload)
        });

        if (!imageRes.ok) {
            const err = await imageRes.text();
            console.error(`❌ Image Send Failed: ${imageRes.status} - ${err}`);

            // Try fallback endpoint /send-images just in case
            console.log(`\n   ⚠️ Retrying with /send-images (Plural)...`);
            const pluralEndpoint = `${AIMEOW_BASE_URL}/api/v1/clients/${clientId}/send-images`;
            const pluralPayload = {
                phone: TEST_PHONE,
                images: [{
                    imageUrl: `data:image/gif;base64,${base64Image}`,
                    caption: "Tes Plural Endpoint"
                }]
            };

            const pluralRes = await fetch(pluralEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(pluralPayload)
            });

            if (!pluralRes.ok) {
                const pluralErr = await pluralRes.text();
                console.error(`   ❌ Plural /send-images Failed: ${pluralRes.status} - ${pluralErr}`);
            } else {
                console.log(`   ✅ Plural /send-images Success! (Use this one!)`);
            }

        } else {
            const data = await imageRes.json();
            console.log(`✅ Image Send Success! ID: ${data.messageId || data.id}`);
        }

    } catch (error: any) {
        console.error(`\n🔥 FATAL ERROR:`, error.message);
    }
}

runLiveTest();
