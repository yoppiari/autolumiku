/**
 * Call cleanup API
 */

const API_URL = 'https://primamobil.id/api/admin/clean-duplicate-users';

const payload = {
    phone: '081310703754'
};

console.log('🧹 Calling API to clean duplicate users...\n');
console.log('Payload:', JSON.stringify(payload, null, 2));

fetch(API_URL, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
})
    .then(async (response) => {
        const data = await response.json();

        if (response.ok) {
            console.log('\n✅ SUCCESS!');
            console.log(JSON.stringify(data, null, 2));

            if (data.deleted && data.deleted.length > 0) {
                console.log('\n🗑️  Deleted records:');
                data.deleted.forEach((d, idx) => {
                    console.log(`   ${idx + 1}. ${d.name} (${d.role}) - Tenant: ${d.tenantId || 'Platform'}`);
                });
            }

            if (data.remaining && data.remaining.length > 0) {
                console.log('\n✅ Remaining records:');
                data.remaining.forEach((r, idx) => {
                    console.log(`   ${idx + 1}. ${r.name} (${r.role}) - ${r.tenantName}`);
                });
            }
        } else {
            console.log('\n❌ ERROR!');
            console.log(JSON.stringify(data, null, 2));
        }
    })
    .catch((error) => {
        console.error('\n❌ Network Error:', error);
    });
