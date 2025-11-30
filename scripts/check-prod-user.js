
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser() {
    try {
        console.log('Checking for admin user...');
        const user = await prisma.user.findUnique({
            where: { email: 'admin@showroomjakarta.com' },
        });

        if (user) {
            console.log('User found:', user.email);
            console.log('Password hash:', user.passwordHash);
            console.log('Role:', user.role);
            console.log('Tenant ID:', user.tenantId);
        } else {
            console.log('User NOT found!');

            // List all users
            const allUsers = await prisma.user.findMany();
            console.log('Total users in DB:', allUsers.length);
            allUsers.forEach(u => console.log(`- ${u.email}`));
        }
    } catch (error) {
        console.error('Error checking user:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkUser();
