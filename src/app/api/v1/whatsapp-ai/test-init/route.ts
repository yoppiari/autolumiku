/**
 * Test endpoint untuk debug initialize error
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get("tenantId") || "e592973f-9eff-4f40-adf6-ca6b2ad9721f";
  
  const result: any = {
    step: "start",
    tenantId,
  };
  
  try {
    // Step 1: Test Prisma connection
    result.step = "prisma_connect";
    const tenantCount = await prisma.tenant.count();
    result.tenantCount = tenantCount;
    
    // Step 2: Find AimeowAccount
    result.step = "find_account";
    const account = await prisma.aimeowAccount.findUnique({
      where: { tenantId },
    });
    result.account = account ? {
      id: account.id,
      clientId: account.clientId,
      isActive: account.isActive,
      phoneNumber: account.phoneNumber,
    } : null;
    
    // Step 3: Check aiConfig relation
    result.step = "find_account_with_aiconfig";
    const accountWithConfig = await prisma.aimeowAccount.findUnique({
      where: { tenantId },
      include: { aiConfig: true },
    });
    result.accountWithConfig = accountWithConfig ? {
      id: accountWithConfig.id,
      hasAiConfig: !!accountWithConfig.aiConfig,
    } : null;
    
    result.step = "success";
    result.success = true;
    
    return NextResponse.json(result);
  } catch (error: any) {
    result.error = error.message;
    result.stack = error.stack;
    return NextResponse.json(result, { status: 500 });
  }
}
