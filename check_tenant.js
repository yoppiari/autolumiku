
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const tenant = await prisma.tenant.findUnique({
        where: { slug: 'primamobil-id' },
        include: {
            configuration: true // assuming there might be a configuration relation, check schema
        }
    });
    console.log(JSON.stringify(tenant, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
