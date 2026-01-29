import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const envPath = path.join(process.cwd(), '.env');
let dbUrl = '';

try {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const dbUrlMatch = envContent.match(/DATABASE_URL="?([^"\n]+)"?/);
    if (dbUrlMatch) {
        dbUrl = dbUrlMatch[1];
    }
} catch (e) {
    console.log('Could not read .env');
}

if (!dbUrl) {
    dbUrl = process.env.DATABASE_URL || '';
}

if (!dbUrl) {
    console.error('DATABASE_URL not found');
    process.exit(1);
}

// Ensure table and column names are correct based on Prisma schema
// Model Tenant -> @@map("tenants")
// Field whatsappNumber -> no map, so it's likely "whatsappNumber" (Prisma quotes it)
const sql = `UPDATE "tenants" SET "whatsappNumber" = '6281234567890', "phoneNumber" = '6281234567890' WHERE "slug" = 'showroomjakarta';`;

console.log('Executing SQL update via psql...');
try {
    execSync(`psql "${dbUrl}" -c "${sql}"`, { stdio: 'inherit' });
    console.log('Update successful');
} catch (e) {
    console.error('Update failed');
    process.exit(1);
}
