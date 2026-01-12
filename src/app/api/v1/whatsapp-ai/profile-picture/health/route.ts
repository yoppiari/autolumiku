/**
 * WhatsApp Profile Picture Service Health Check
 * GET /api/v1/whatsapp-ai/profile-picture/health
 * 
 * Returns detailed diagnostics about:
 * - Aimeow service connectivity
 * - Connected WhatsApp clients
 * - Sample profile picture fetch test
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

const AIMEOW_BASE_URL = process.env.AIMEOW_BASE_URL || "https://meow.lumiku.com";

export async function GET(request: NextRequest) {
    const diagnostics: any = {
        timestamp: new Date().toISOString(),
        aimeowBaseUrl: AIMEOW_BASE_URL,
        steps: []
    };

    try {
        // STEP 1: Check Aimeow API connectivity
        diagnostics.steps.push("1. Checking Aimeow API connectivity...");
        let aimeowReachable = false;
        let clients: any[] = [];

        try {
            const clientsResponse = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients`, {
                cache: 'no-store',
            });

            aimeowReachable = clientsResponse.ok;

            if (aimeowReachable) {
                clients = await clientsResponse.json();
                diagnostics.aimeow = {
                    reachable: true,
                    status: clientsResponse.status,
                    totalClients: clients.length,
                    connectedClients: clients.filter((c: any) => c.isConnected).length
                };
                diagnostics.steps.push(`   ✅ Aimeow API reachable - ${clients.length} clients found, ${clients.filter((c: any) => c.isConnected).length} connected`);
            } else {
                diagnostics.aimeow = {
                    reachable: false,
                    status: clientsResponse.status,
                    error: `HTTP ${clientsResponse.status}`
                };
                diagnostics.steps.push(`   ❌ Aimeow API returned ${clientsResponse.status}`);
            }
        } catch (error: any) {
            diagnostics.aimeow = {
                reachable: false,
                error: error.message
            };
            diagnostics.steps.push(`   ❌ Cannot reach Aimeow: ${error.message}`);
        }

        // STEP 2: Check database accounts
        diagnostics.steps.push("2. Checking database WhatsApp accounts...");
        const dbAccounts = await prisma.aimeowAccount.findMany({
            select: {
                id: true,
                tenantId: true,
                clientId: true,
                phoneNumber: true,
                isActive: true,
                connectionStatus: true
            }
        });

        diagnostics.database = {
            totalAccounts: dbAccounts.length,
            activeAccounts: dbAccounts.filter(a => a.isActive).length,
            accounts: dbAccounts.map(a => ({
                tenantId: a.tenantId,
                clientId: a.clientId,
                phone: a.phoneNumber,
                status: a.connectionStatus
            }))
        };
        diagnostics.steps.push(`   ✅ Found ${dbAccounts.length} WhatsApp accounts in database`);

        // STEP 3: Match database accounts with Aimeow clients
        diagnostics.steps.push("3. Matching database accounts with Aimeow clients...");
        const matches = [];
        const mismatches = [];

        for (const account of dbAccounts) {
            const matchingClient = clients.find((c: any) =>
                c.id === account.clientId || c.phone === account.phoneNumber
            );

            if (matchingClient) {
                matches.push({
                    tenantId: account.tenantId,
                    clientId: matchingClient.id,
                    phone: matchingClient.phone,
                    connected: matchingClient.isConnected
                });
            } else {
                mismatches.push({
                    tenantId: account.tenantId,
                    dbClientId: account.clientId,
                    dbPhone: account.phoneNumber
                });
            }
        }

        diagnostics.matching = {
            matched: matches.length,
            mismatched: mismatches.length,
            matches: matches,
            mismatches: mismatches
        };

        if (matches.length > 0) {
            diagnostics.steps.push(`   ✅ ${matches.length} accounts matched with Aimeow clients`);
        }
        if (mismatches.length > 0) {
            diagnostics.steps.push(`   ⚠️  ${mismatches.length} accounts NOT found in Aimeow (might need sync)`);
        }

        // STEP 4: Test profile picture fetch
        if (matches.length > 0 && matches.some(m => m.connected)) {
            diagnostics.steps.push("4. Testing profile picture fetch...");
            const connectedMatch = matches.find(m => m.connected);

            if (connectedMatch) {
                // Get a user from this tenant to test
                const testUser = await prisma.user.findFirst({
                    where: {
                        tenantId: connectedMatch.tenantId,
                        phone: { not: null }
                    },
                    select: { phone: true, firstName: true, lastName: true }
                });

                if (testUser && testUser.phone) {
                    const cleanPhone = testUser.phone.replace(/@.*$/, "").replace(/:/g, "").replace(/[^0-9]/g, "");

                    try {
                        const pictureUrl = `${AIMEOW_BASE_URL}/api/v1/clients/${connectedMatch.clientId}/profile-picture/${cleanPhone}`;
                        diagnostics.steps.push(`   Testing: ${pictureUrl}`);

                        const picResponse = await fetch(pictureUrl, {
                            headers: { Accept: "application/json" },
                            cache: 'no-store',
                        });

                        const picData = await picResponse.json();

                        diagnostics.profilePictureTest = {
                            testUser: `${testUser.firstName} ${testUser.lastName}`,
                            testPhone: cleanPhone,
                            clientId: connectedMatch.clientId,
                            response: picData,
                            success: picData.success && picData.hasPicture
                        };

                        if (picData.success && picData.hasPicture) {
                            diagnostics.steps.push(`   ✅ Profile picture fetch WORKS - Got picture for ${testUser.firstName}`);
                        } else {
                            diagnostics.steps.push(`   ⚠️  Profile picture fetch returned no picture (user might not have one set)`);
                        }
                    } catch (error: any) {
                        diagnostics.profilePictureTest = {
                            error: error.message
                        };
                        diagnostics.steps.push(`   ❌ Profile picture fetch FAILED: ${error.message}`);
                    }
                } else {
                    diagnostics.steps.push(`   ⚠️  No users with phone found for testing`);
                }
            }
        } else {
            diagnostics.steps.push("4. ⚠️  Skipping profile picture test - no connected clients");
        }

        // Summary
        const allGood =
            diagnostics.aimeow?.reachable &&
            matches.length > 0 &&
            matches.some((m: any) => m.connected);

        diagnostics.summary = {
            healthy: allGood,
            message: allGood
                ? "✅ All systems operational - Profile pictures should be working"
                : "❌ Issues detected - Check details above"
        };

        return NextResponse.json(diagnostics, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({
            error: error.message,
            stack: error.stack,
            diagnostics
        }, { status: 500 });
    }
}
