/**
 * Server Action: Clean Duplicate Users
 * 
 * This runs server-side to check and clean duplicate user records
 * that might not be visible in the dashboard (e.g., tenantId=null records)
 */

'use server';

import { prisma } from '@/lib/prisma';

export async function cleanDuplicateUsers(phone: string) {
    console.log(`🔍 Cleaning duplicate users for phone: ${phone}`);

    // Normalize phone for search
    const normalizePhone = (phone: string): string => {
        if (!phone) return "";
        if (phone.includes("@")) phone = phone.split("@")[0];
        if (phone.includes(":")) phone = phone.split(":")[0];
        let digits = phone.replace(/\D/g, "");
        if (digits.startsWith("0")) digits = "62" + digits.substring(1);
        return digits;
    };

    const normalized = normalizePhone(phone);

    // Get ALL users with this phone (including tenantId=null)
    const allUsers = await prisma.user.findMany({
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: true,
            roleLevel: true,
            tenantId: true,
            tenant: {
                select: {
                    id: true,
                    name: true,
                }
            },
            createdAt: true,
        },
        orderBy: { createdAt: 'asc' } // Oldest first
    });

    // Find matching users
    const matches = allUsers.filter(u => {
        if (!u.phone) return false;
        return normalizePhone(u.phone) === normalized;
    });

    console.log(`Found ${matches.length} user(s) with phone ${phone}:`);
    matches.forEach((u, idx) => {
        console.log(`  ${idx + 1}. ${u.firstName} ${u.lastName || ''} (${u.role}) - Tenant: ${u.tenant?.name || 'Platform/NULL'}`);
    });

    if (matches.length <= 1) {
        return {
            success: true,
            message: `No duplicates found. Only ${matches.length} user record exists.`,
            users: matches,
        };
    }

    // Find the "bad" records: firstName="User" and role="STAFF"
    const badRecords = matches.filter(u =>
        (u.firstName === 'User' || u.firstName === 'user') &&
        (u.role === 'STAFF' || u.role === 'staff')
    );

    if (badRecords.length === 0) {
        return {
            success: true,
            message: `Found ${matches.length} records but none are bad (User/STAFF). Manual review needed.`,
            users: matches,
        };
    }

    console.log(`\n🗑️  Found ${badRecords.length} bad record(s) to delete...`);

    // Delete bad records
    const deletedIds = [];
    for (const bad of badRecords) {
        console.log(`   Deleting: ${bad.id} (${bad.firstName} - ${bad.role})`);
        await prisma.user.delete({
            where: { id: bad.id }
        });
        deletedIds.push(bad.id);
    }

    console.log(`\n✅ Cleanup complete!`);

    // Get remaining records
    const remaining = matches.filter(u => !deletedIds.includes(u.id));

    return {
        success: true,
        message: `Deleted ${deletedIds.length} duplicate record(s). ${remaining.length} record(s) remaining.`,
        deleted: badRecords.map(u => ({
            id: u.id,
            name: `${u.firstName} ${u.lastName || ''}`,
            role: u.role,
            tenantId: u.tenantId,
        })),
        remaining: remaining.map(u => ({
            id: u.id,
            name: `${u.firstName} ${u.lastName || ''}`,
            role: u.role,
            tenantId: u.tenantId,
            tenantName: u.tenant?.name || 'Platform',
        })),
    };
}
