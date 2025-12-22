/**
 * WhatsApp AI - Send Manual Message
 * POST /api/v1/whatsapp-ai/send-message
 * Kirim pesan manual dari dashboard ke customer (text atau image)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AimeowClientService } from "@/lib/services/aimeow/aimeow-client.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, conversationId, to, message, imageUrl, caption } = body;

    // Validate required fields
    if (!tenantId || !to) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: tenantId, to" },
        { status: 400 }
      );
    }

    // Must have either message or imageUrl
    if (!message && !imageUrl) {
      return NextResponse.json(
        { success: false, error: "Must provide either message or imageUrl" },
        { status: 400 }
      );
    }

    // Get Aimeow account for tenant
    const account = await prisma.aimeowAccount.findFirst({
      where: { tenantId, isActive: true },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: "No active WhatsApp account found for tenant" },
        { status: 404 }
      );
    }

    let result;
    let contentToSave = message || '';

    // Send image or text message
    if (imageUrl) {
      // Send image with optional caption
      result = await AimeowClientService.sendImage(
        account.clientId,
        to,
        imageUrl,
        caption || message || ''
      );
      contentToSave = caption || message || '[Image]';
    } else {
      // Send text message
      result = await AimeowClientService.sendMessage({
        clientId: account.clientId,
        to,
        message,
      });
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to send message" },
        { status: 500 }
      );
    }

    // Save outbound message to database
    if (conversationId) {
      await prisma.whatsAppMessage.create({
        data: {
          conversationId,
          tenantId,
          direction: "outbound",
          sender: "Admin",
          senderType: "human",
          content: contentToSave,
          intent: "manual_reply",
          aiResponse: false,
          aimeowMessageId: result.messageId || `msg_${Date.now()}`,
          aimeowStatus: "sent",
        },
      });

      // Update conversation last message time
      await prisma.whatsAppConversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      });
    }

    return NextResponse.json({
      success: true,
      message: imageUrl ? "Image sent successfully" : "Message sent successfully",
      messageId: result.messageId,
    });
  } catch (error: any) {
    console.error("[Send Message API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
