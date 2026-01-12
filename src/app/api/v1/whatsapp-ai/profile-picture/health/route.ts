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
        logs: [],
        errors: []
    };

    const log = (msg: string, type: 'info' | 'error' | 'success' | 'warn' = 'info') => {
        diagnostics.logs.push({ msg, type });
        if (type === 'error') diagnostics.errors.push(msg);
    };

    try {
        log("1. Checking Aimeow API connectivity...", 'info');
        let aimeowReachable = false;
        let clients: any[] = [];

        try {
            const clientsResponse = await fetch(`${AIMEOW_BASE_URL}/api/v1/clients`, { cache: 'no-store' });
            aimeowReachable = clientsResponse.ok;

            if (aimeowReachable) {
                clients = await clientsResponse.json();
                log(`✅ Aimeow API reachable - ${clients.length} clients total`, 'success');
            } else {
                log(`❌ Aimeow API returned ${clientsResponse.status}`, 'error');
            }
        } catch (error: any) {
            log(`❌ Cannot reach Aimeow: ${error.message}`, 'error');
        }

        log("2. Checking database WhatsApp accounts...", 'info');
        const dbAccounts = await prisma.aimeowAccount.findMany({
            include: { tenant: true }
        });
        log(`Found ${dbAccounts.length} accounts in DB`, 'info');

        log("3. Matching accounts...", 'info');
        const matches = [];

        for (const account of dbAccounts) {
            const client = clients.find((c: any) => c.id === account.clientId || c.phone === account.phoneNumber);
            const status = client ? (client.isConnected ? 'CONNECTED' : 'DISCONNECTED') : 'NOT_FOUND_IN_AIMEOW';

            matches.push({
                tenant: account.tenant?.name || 'Unknown',
                phone: account.phoneNumber,
                clientId: account.clientId,
                aimeowStatus: status,
                dbStatus: account.connectionStatus
            });
        }

        // HTML Output Construction
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>WA Profile Diagnostics</title>
            <style>
                body { font-family: monospace; padding: 20px; background: #1a1a1a; color: #eee; }
                .card { background: #2a2a2a; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
                h2 { color: #4ade80; border-bottom: 1px solid #444; padding-bottom: 10px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th, td { border: 1px solid #444; padding: 8px; text-align: left; }
                th { background: #333; }
                .tag { padding: 2px 6px; border-radius: 4px; font-size: 11px; }
                .CONNECTED { background: #064e3b; color: #6ee7b7; }
                .DISCONNECTED { background: #7f1d1d; color: #fca5a5; }
                .log-info { color: #94a3b8; }
                .log-success { color: #4ade80; font-weight: bold; }
                .log-error { color: #f87171; font-weight: bold; }
                .log-warn { color: #fbbf24; }
            </style>
        </head>
        <body>
            <h1>🤖 WA Profile Debugger</h1>
            
            <div class="card">
                <h2>📊 Service Status</h2>
                <div>Aimeow URL: <code>${AIMEOW_BASE_URL}</code></div>
                <div>API Connectivity: ${aimeowReachable ? '<span class="tag CONNECTED">ONLINE</span>' : '<span class="tag DISCONNECTED">OFFLINE</span>'}</div>
            </div>

            <div class="card">
                <h2>🔗 Accounts & Connections</h2>
                <table>
                    <tr>
                        <th>Tenant</th>
                        <th>Phone (DB)</th>
                        <th>Client ID</th>
                        <th>DB Status</th>
                        <th>Real Status</th>
                    </tr>
                    ${matches.map(m => `
                        <tr>
                            <td>${m.tenant}</td>
                            <td>${m.phone}</td>
                            <td><small>${m.clientId}</small></td>
                            <td>${m.dbStatus}</td>
                            <td><span class="tag ${m.aimeowStatus}">${m.aimeowStatus}</span></td>
                        </tr>
                    `).join('')}
                </table>
            </div>

            <div class="card">
                <h2>📜 Execution Logs</h2>
                <div style="font-family: monospace; white-space: pre-wrap;">
${diagnostics.logs.map((l: any) => `<div class="log-${l.type}">[${l.type.toUpperCase()}] ${l.msg}</div>`).join('')}
                </div>
            </div>
            
            <div class="card">
                <h2>🛠️ Manual Test Tools</h2>
                <p>Use these links to test individual numbers:</p>
                <ul>
                    <li><a href="/api/v1/whatsapp-ai/profile-picture?tenantId=${dbAccounts[0]?.tenantId}&phone=YOUR_PHONE_HERE" target="_blank" style="color: #60a5fa">Test Fetch Profile Picture (JSON)</a></li>
                </ul>
            </div>
        </body>
        </html>
        `;

        return new NextResponse(html, {
            headers: { 'Content-Type': 'text/html' }
        });

    } catch (error: any) {
        return new NextResponse(`❌ Critical Error: ${error.message}<br><pre>${error.stack}</pre>`, {
            headers: { 'Content-Type': 'text/html' }
        });
    }
}
