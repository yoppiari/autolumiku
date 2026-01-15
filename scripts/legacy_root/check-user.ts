
import { prisma } from './src/lib/prisma';

async function checkUser() {
  const phone = '081310703754';
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("0") ? "62" + digits.substring(1) : digits;

  console.log(`Checking for phone: ${phone} (Normalized: ${normalized})`);

  const users = await prisma.user.findMany({
    where: {
      phone: { contains: digits.substring(3) } // Fuzzy search
    }
  });

  console.log(`Found ${users.length} users with similar phone numbers:`);
  console.dir(users, { depth: null });

  if (users.length === 0) {
    console.log("No users found. Creating one for testing if empty?");
  }
}

checkUser()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
