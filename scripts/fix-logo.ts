import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const slug = 'prima-mobil'; // Assuming this is the slug based on previous research

    const tenant = await prisma.tenant.findFirst({
        where: {
            OR: [
                { slug: 'prima-mobil' },
                { slug: 'primamobil-id' },
                { slug: 'primamobil' },
                { domain: 'primamobil.id' }
            ]
        }
    });

    if (!tenant) {
        console.error('Tenant not found');
        return;
    }

    console.log(`Updating tenant: ${tenant.name} (${tenant.id})`);

    await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
            logoUrl: '/prima-mobil-logo.jpg'
        }
    });

    console.log('Logo updated successfully');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
