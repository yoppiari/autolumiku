/**
 * Call API to fix user record
 */

const API_URL = 'https://primamobil.id/api/admin/fix-user-record';

const payload = {
    phone: '081310703754',
    firstName: 'Yudho',
    lastName: 'D.L.',
    role: 'SUPER_ADMIN'
};

console.log('🔧 Calling API to fix user record...\n');
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
        } else {
            console.log('\n❌ ERROR!');
            console.log(JSON.stringify(data, null, 2));
        }
    })
    .catch((error) => {
        console.error('\n❌ Network Error:', error);
    });
