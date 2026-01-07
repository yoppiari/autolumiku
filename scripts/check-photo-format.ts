import { prisma } from '../src/lib/prisma';

async function checkPhotoFormat() {
    const photo = await prisma.vehiclePhoto.findFirst({
        where: {
            vehicle: {
                displayId: 'PM-PST-001'
            }
        },
        select: {
            mediumUrl: true,
            originalUrl: true,
            largeUrl: true
        }
    });

    console.log('🔍 Photo URL Format from Database:');
    console.log('Medium:', photo?.mediumUrl);
    console.log('Original:', photo?.originalUrl);
    console.log('\nFormat check:');
    console.log('- Starts with http?', photo?.mediumUrl?.startsWith('http'));
    console.log('- Contains 0.0.0.0?', photo?.mediumUrl?.includes('0.0.0.0'));
    console.log('- Is relative?', photo?.mediumUrl?.startsWith('/'));

    await prisma.$disconnect();
}

checkPhotoFormat();
