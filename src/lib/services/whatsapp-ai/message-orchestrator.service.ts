/**
 * Message Orchestrator Service
 * Central coordinator untuk WhatsApp message processing
 * - Intent classification
 * - Route ke AI atau Staff Command handler
 * - Save messages
 * - Send responses via Aimeow
 */

import { prisma } from "@/lib/prisma";
import { AimeowClientService } from "../aimeow/aimeow-client.service";
import { IntentClassifierService, MessageIntent } from "./intent-classifier.service";
import { WhatsAppAIChatService } from "./chat.service";
import { StaffCommandService } from "./staff-command.service";
import { AIHealthMonitorService } from "./ai-health-monitor.service";

// ==================== TYPES ====================

export interface IncomingMessage {
  accountId: string;
  tenantId: string;
  from: string;
  message: string;
  mediaUrl?: string;
  mediaType?: string;
  messageId: string;
}

export interface ProcessingResult {
  success: boolean;
  conversationId: string;
  intent: MessageIntent;
  responseMessage?: string;
  escalated: boolean;
  error?: string;
}

// ==================== MESSAGE ORCHESTRATOR ====================

export class MessageOrchestratorService {
  /**
   * Process incoming WhatsApp message
   * Main entry point untuk semua message processing
   */
  static async processIncomingMessage(
    incoming: IncomingMessage
  ): Promise<ProcessingResult> {
    console.log(`[Orchestrator] === Processing incoming message ===`);
    console.log(`[Orchestrator] Account: ${incoming.accountId}, Tenant: ${incoming.tenantId}`);
    console.log(`[Orchestrator] From: ${incoming.from}, Message: ${incoming.message}`);

    try {
      // 1. Get or create conversation
      const conversation = await this.getOrCreateConversation(
        incoming.accountId,
        incoming.tenantId,
        incoming.from
      );

      // 2. Save incoming message
      const incomingMsg = await this.saveIncomingMessage(
        conversation.id,
        incoming
      );

      // 3. Check AI health status before processing customer messages
      const aiHealth = await AIHealthMonitorService.canProcessAI(incoming.tenantId);
      console.log(`[Orchestrator] AI Health: canProcess=${aiHealth.canProcess}, status=${aiHealth.status}`);

      // 4. Check conversation state for multi-step flows
      let classification;
      // Detect media if EITHER:
      // 1. mediaUrl exists (can process the photo), OR
      // 2. mediaType indicates an image (photo detected but might not be downloadable)
      const isMediaTypeImage = incoming.mediaType === 'image' || incoming.mediaType?.includes('image');
      const hasMedia = !!(incoming.mediaUrl || isMediaTypeImage);
      const hasDownloadableMedia = !!(incoming.mediaUrl && isMediaTypeImage);

      // Log media detection for debugging
      console.log(`[Orchestrator] Media detection:`, {
        mediaUrl: incoming.mediaUrl ? 'YES' : 'NO',
        mediaType: incoming.mediaType,
        hasMedia,
        hasDownloadableMedia,
      });

      // Greeting patterns to check before forcing upload_vehicle state
      const greetingPatterns = [
        /^(halo|helo|hai|hello|hi|hey|hallo|hei|haloha|halohaa?)$/i,
        /^(halo|helo|hai|hello|hi|hey|hallo|hei|haloha)\s*(kak|min|admin|bos|boss)?[.!?]?$/i,
        /^(selamat\s+(pagi|siang|sore|malam))$/i,
        /^(pagi|siang|sore|malam)$/i,
        /^(assalamu.*alaikum|assalamualaikum)/i,
        /^(met\s+(pagi|siang|sore|malam))/i,
        /^(yo|yoo|woi|woii|hoi|hoii)$/i,             // informal greetings
      ];

      // Escape patterns - specific questions that should reset upload flow
      // NOTE: Removed /\?$/ as it was too broad and matched valid vehicle data questions
      const escapePatterns = [
        /^(kamu|anda|lu|lo)\s*(siapa|apa)\??$/i,     // kamu siapa?, anda siapa?
        /^(siapa)\s*(kamu|anda|ini|lu|lo)\??$/i,    // siapa kamu?, siapa ini?
        /^(ini)\s*(siapa|apa)\??$/i,                 // ini siapa?, ini apa?
        /^(apa)\s*(ini|itu|kabar)\??$/i,             // apa ini?, apa kabar?
        /^(gimana|bagaimana)\s*\??$/i,               // gimana?, bagaimana?
        /^(tolong|help)\s*$/i,                       // tolong, help (alone)
        /^(menu|fitur)$/i,                           // menu, fitur (alone)
        /^(cara\s+pakai|cara\s+upload)/i,            // cara pakai, cara upload
      ];

      // Confirmation patterns - user confirming they sent photos/data (should be acknowledged, not parsed as vehicle data)
      const confirmationPatterns = [
        /sudah\s*(saya\s*)?(kirim|upload|send)/i,    // sudah kirim, sudah saya kirim, sudah upload
        /foto\s*(sudah|udah)\s*(di)?(kirim|upload|send)/i,  // foto sudah dikirim, foto udah kirim
        /(mohon|tolong)\s*(di)?\s*proses/i,          // mohon diproses, tolong proses
        /^(proses|process)\s*(ya|dong)?$/i,          // proses, proses ya
        /apakah.*diinfo.*update/i,                   // apakah saya akan diinfo update
        /kapan\s*(selesai|jadi)/i,                   // kapan selesai, kapan jadi
        /^(ok|oke|siap|done|selesai)\s*(ya)?$/i,     // ok, oke, siap, done
      ];

      const normalizedMessage = (incoming.message || "").trim();
      const isGreeting = greetingPatterns.some(p => p.test(normalizedMessage));
      const isEscapeMessage = escapePatterns.some(p => p.test(normalizedMessage));
      const isConfirmationMessage = confirmationPatterns.some(p => p.test(normalizedMessage));

      if (conversation.conversationState === "upload_vehicle" && !isGreeting && !isEscapeMessage && !isConfirmationMessage && !normalizedMessage.toLowerCase().includes("batal")) {
        // Staff is in middle of vehicle upload flow (and NOT sending a greeting, question, or cancel)
        console.log(`[Orchestrator] Conversation in upload_vehicle state, treating message as vehicle data/photo`);

        // IMPORTANT: If this is a photo, make sure it's treated as photo for upload
        if (hasMedia) {
          console.log(`[Orchestrator] ✅ Photo detected in upload flow!`);
        }

        classification = {
          intent: "staff_upload_vehicle" as MessageIntent,
          confidence: 1.0,
          isStaff: true,
          isCustomer: false,
        };
      } else if (conversation.conversationState === "upload_vehicle" && (isGreeting || isEscapeMessage || normalizedMessage.toLowerCase().includes("batal"))) {
        // User sent greeting, question, or "batal" while in upload flow - reset conversation state
        console.log(`[Orchestrator] 🔄 Greeting/question/cancel detected in upload flow, resetting conversation state`);

        await prisma.whatsAppConversation.update({
          where: { id: conversation.id },
          data: {
            conversationState: null,
            contextData: {
              ...((conversation.contextData as Record<string, any>) || {}),
              // Clear upload-related data
              vehicleData: null,
              photos: null,
              uploadStep: null,
              photoRequestAttempts: null,
            },
          },
        });

        // Classify as staff greeting
        classification = {
          intent: "staff_greeting" as MessageIntent,
          confidence: 0.95,
          isStaff: conversation.isStaff || false,
          isCustomer: !conversation.isStaff,
          reason: "Greeting detected, reset upload flow",
        };
      } else if (conversation.conversationState === "upload_vehicle" && isConfirmationMessage) {
        // User sent confirmation message like "sudah kirim" or "selesai" during upload flow
        console.log(`[Orchestrator] 📝 Confirmation message detected in upload flow: "${normalizedMessage}"`);

        const contextData = (conversation.contextData as Record<string, any>) || {};
        const photosCollected = contextData.photos?.length || 0;
        const vehicleData = contextData.vehicleData;

        // Check if user wants to finish/complete the upload
        const finishPatterns = [/^(selesai|done|cukup|udah|sudah|beres)$/i];
        const wantsToFinish = finishPatterns.some(p => p.test(normalizedMessage));

        // If user wants to finish AND we have vehicle data, create vehicle without photos
        if (wantsToFinish && vehicleData) {
          console.log(`[Orchestrator] 🚗 User wants to finish upload - creating vehicle without photos`);

          // Import and call the vehicle upload service
          const { WhatsAppVehicleUploadService } = await import('./vehicle-upload.service');

          try {
            const uploadResult = await WhatsAppVehicleUploadService.createVehicle(
              {
                make: vehicleData.make,
                model: vehicleData.model,
                year: vehicleData.year,
                price: vehicleData.price,
                mileage: vehicleData.mileage || undefined, // Keep undefined if not provided
                color: vehicleData.color || 'Unknown',
                transmission: vehicleData.transmission || 'Manual',
              },
              photosCollected > 0 ? contextData.photos : [],
              incoming.tenantId,
              incoming.from
            );

            // Clear conversation state but preserve lastUploadedVehicleId and isStaff for edit feature
            const currentContext = (conversation.contextData as Record<string, any>) || {};
            await prisma.whatsAppConversation.update({
              where: { id: conversation.id },
              data: {
                conversationState: null,
                isStaff: true, // Preserve staff status for future edit requests
                contextData: uploadResult.success ? {
                  lastUploadedVehicleId: uploadResult.vehicleId,
                  lastUploadedAt: new Date().toISOString(),
                  verifiedStaffPhone: currentContext.verifiedStaffPhone || incoming.from,
                } : {},
              },
            });

            if (uploadResult.success) {
              const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://primamobil.id';
              const vehicleUrl = `${baseUrl}/dashboard/vehicles/${uploadResult.vehicleId}`;
              const successMessage = uploadResult.message + `\n\n🔗 *Link Dashboard:*\n${vehicleUrl}`;

              // IMPORTANT: Send response before returning (early return skips sendResponse at end)
              await this.sendResponse(
                incoming.accountId,
                incoming.from,
                successMessage,
                conversation.id,
                "staff_upload_vehicle" as MessageIntent
              );

              return {
                success: true,
                conversationId: conversation.id,
                intent: "staff_upload_vehicle" as MessageIntent,
                responseMessage: successMessage,
                escalated: false,
              };
            } else {
              const errorMessage = `❌ Gagal upload: ${uploadResult.message}`;

              // Send error response
              await this.sendResponse(
                incoming.accountId,
                incoming.from,
                errorMessage,
                conversation.id,
                "staff_upload_vehicle" as MessageIntent
              );

              return {
                success: false,
                conversationId: conversation.id,
                intent: "staff_upload_vehicle" as MessageIntent,
                responseMessage: errorMessage,
                escalated: true,
              };
            }
          } catch (error: any) {
            console.error(`[Orchestrator] Error creating vehicle:`, error);
            const errorMessage = `❌ Terjadi kesalahan: ${error.message}`;

            // Send error response
            await this.sendResponse(
              incoming.accountId,
              incoming.from,
              errorMessage,
              conversation.id,
              "staff_upload_vehicle" as MessageIntent
            );

            return {
              success: false,
              conversationId: conversation.id,
              intent: "staff_upload_vehicle" as MessageIntent,
              responseMessage: errorMessage,
              escalated: true,
            };
          }
        }

        // Otherwise, provide status update
        let statusMessage = "";
        if (photosCollected > 0 && vehicleData) {
          statusMessage = `✅ Data sudah lengkap!\n\n` +
            `📷 ${photosCollected} foto\n` +
            `🚗 ${vehicleData.make || ''} ${vehicleData.model || ''} ${vehicleData.year || ''}\n\n` +
            `Ketik "selesai" untuk upload tanpa foto tambahan.`;
        } else if (photosCollected > 0) {
          statusMessage = `📷 ${photosCollected} foto sudah masuk!\n\n` +
            `Tinggal kirim data mobilnya ya:\n` +
            `Contoh: Brio 2020 120jt hitam matic`;
        } else if (vehicleData) {
          statusMessage = `🚗 Data mobil sudah masuk!\n\n` +
            `${vehicleData.make || ''} ${vehicleData.model || ''} ${vehicleData.year || ''}\n\n` +
            `Kirim foto atau ketik "selesai" untuk upload tanpa foto.`;
        } else {
          statusMessage = `📝 Belum ada data yang masuk.\n\n` +
            `Silakan kirim foto + detail mobil ya!\n` +
            `Contoh: upload Brio 2020 120jt hitam matic`;
        }

        // Send status update before returning
        await this.sendResponse(
          incoming.accountId,
          incoming.from,
          statusMessage,
          conversation.id,
          "staff_upload_vehicle" as MessageIntent
        );

        return {
          success: true,
          conversationId: conversation.id,
          intent: "staff_upload_vehicle" as MessageIntent,
          responseMessage: statusMessage,
          escalated: false,
        };
      } else if (conversation.conversationState === "add_photo_to_vehicle" && hasMedia && incoming.mediaUrl) {
        // 📷 PHOTO ADDITION FLOW: Vehicle was created without photos, now adding photos
        console.log(`[Orchestrator] 📷 Photo received for existing vehicle - adding to vehicle`);

        const contextData = (conversation.contextData as Record<string, any>) || {};
        const vehicleId = contextData.vehicleId;
        const vehicleName = contextData.vehicleName || 'kendaraan';
        const photosAdded = contextData.photosAdded || 0;

        if (!vehicleId) {
          console.error(`[Orchestrator] ❌ No vehicleId in context for add_photo_to_vehicle state`);
          const errorMsg = "Maaf, terjadi kesalahan. Silakan upload ulang kendaraan.";

          await this.sendResponse(
            incoming.accountId,
            incoming.from,
            errorMsg,
            conversation.id,
            "staff_upload_vehicle" as MessageIntent
          );

          return {
            success: false,
            conversationId: conversation.id,
            intent: "staff_upload_vehicle" as MessageIntent,
            responseMessage: errorMsg,
            escalated: false,
          };
        }

        try {
          // Add photo to vehicle using the photo upload API
          const result = await this.addPhotoToVehicle(vehicleId, incoming.mediaUrl, incoming.tenantId);

          if (result.success) {
            const newPhotosAdded = photosAdded + 1;

            // Update context with new photo count
            await prisma.whatsAppConversation.update({
              where: { id: conversation.id },
              data: {
                contextData: {
                  ...contextData,
                  photosAdded: newPhotosAdded,
                },
              },
            });

            const successMsg = `📷 Foto ${newPhotosAdded} berhasil ditambahkan ke ${vehicleName}! ✅\n\n` +
              `Kirim foto lagi atau ketik "selesai" untuk mengakhiri.`;

            await this.sendResponse(
              incoming.accountId,
              incoming.from,
              successMsg,
              conversation.id,
              "staff_upload_vehicle" as MessageIntent
            );

            return {
              success: true,
              conversationId: conversation.id,
              intent: "staff_upload_vehicle" as MessageIntent,
              responseMessage: successMsg,
              escalated: false,
            };
          } else {
            const errorMsg = `❌ Gagal menambah foto: ${result.error}\n\nCoba kirim ulang fotonya.`;

            await this.sendResponse(
              incoming.accountId,
              incoming.from,
              errorMsg,
              conversation.id,
              "staff_upload_vehicle" as MessageIntent
            );

            return {
              success: false,
              conversationId: conversation.id,
              intent: "staff_upload_vehicle" as MessageIntent,
              responseMessage: errorMsg,
              escalated: false,
            };
          }
        } catch (error: any) {
          console.error(`[Orchestrator] Error adding photo:`, error);
          const errorMsg = `❌ Gagal menambah foto. Coba kirim ulang.`;

          await this.sendResponse(
            incoming.accountId,
            incoming.from,
            errorMsg,
            conversation.id,
            "staff_upload_vehicle" as MessageIntent
          );

          return {
            success: false,
            conversationId: conversation.id,
            intent: "staff_upload_vehicle" as MessageIntent,
            responseMessage: errorMsg,
            escalated: false,
          };
        }
      } else if (conversation.conversationState === "add_photo_to_vehicle" && hasMedia && !incoming.mediaUrl) {
        // Photo detected but not downloadable - inform user
        console.log(`[Orchestrator] ⚠️ Photo detected but no mediaUrl available in add_photo_to_vehicle state`);
        const contextData = (conversation.contextData as Record<string, any>) || {};
        const vehicleName = contextData.vehicleName || 'kendaraan';
        const retryMsg = `📸 Foto diterima tapi belum bisa diproses.\n\nCoba kirim ulang fotonya ya untuk ${vehicleName}! 🙏`;

        await this.sendResponse(
          incoming.accountId,
          incoming.from,
          retryMsg,
          conversation.id,
          "staff_upload_vehicle" as MessageIntent
        );

        return {
          success: true,
          conversationId: conversation.id,
          intent: "staff_upload_vehicle" as MessageIntent,
          responseMessage: retryMsg,
          escalated: false,
        };
      } else if (conversation.conversationState === "add_photo_to_vehicle" && !hasMedia) {
        // User sent text message in add_photo state
        const contextData = (conversation.contextData as Record<string, any>) || {};
        const vehicleName = contextData.vehicleName || 'kendaraan';
        const photosAdded = contextData.photosAdded || 0;

        // Check if user wants to finish
        const finishPatterns = [/^(selesai|done|cukup|udah|sudah|beres|ok|oke)$/i];
        const wantsToFinish = finishPatterns.some(p => p.test(normalizedMessage));

        if (wantsToFinish) {
          // Clear state but preserve lastUploadedVehicleId and isStaff for edit feature
          await prisma.whatsAppConversation.update({
            where: { id: conversation.id },
            data: {
              conversationState: null,
              isStaff: true, // Preserve staff status for future edit requests
              contextData: {
                lastUploadedVehicleId: contextData.vehicleId,
                lastUploadedAt: new Date().toISOString(),
                verifiedStaffPhone: contextData.verifiedStaffPhone || incoming.from,
              },
            },
          });

          const doneMsg = `✅ Selesai! ${photosAdded} foto sudah ditambahkan ke ${vehicleName}.\n\nAda yang lain yang bisa dibantu?`;

          await this.sendResponse(
            incoming.accountId,
            incoming.from,
            doneMsg,
            conversation.id,
            "staff_upload_vehicle" as MessageIntent
          );

          return {
            success: true,
            conversationId: conversation.id,
            intent: "staff_upload_vehicle" as MessageIntent,
            responseMessage: doneMsg,
            escalated: false,
          };
        }

        // Prompt user to send photo
        const promptMsg = `📷 Silakan kirim foto untuk ${vehicleName}.\n\n` +
          `Foto sudah ditambahkan: ${photosAdded}\n` +
          `Ketik "selesai" jika sudah cukup.`;

        await this.sendResponse(
          incoming.accountId,
          incoming.from,
          promptMsg,
          conversation.id,
          "staff_upload_vehicle" as MessageIntent
        );

        return {
          success: true,
          conversationId: conversation.id,
          intent: "staff_upload_vehicle" as MessageIntent,
          responseMessage: promptMsg,
          escalated: false,
        };
      } else {
        // Normal intent classification
        // Pass hasMedia flag to help detect vehicle uploads with photos
        // IMPORTANT: Pass conversation.isStaff to avoid redundant DB queries and fix LID format issues
        console.log(`[Orchestrator] Classifying intent for message: ${incoming.message}, hasMedia: ${hasMedia}, conversationIsStaff: ${conversation.isStaff}`);
        classification = await IntentClassifierService.classify(
          incoming.message,
          incoming.from,
          incoming.tenantId,
          hasMedia,
          conversation.isStaff // Pass conversation staff status to avoid redundant check
        );
        console.log(`[Orchestrator] Intent classified: ${classification.intent}, isStaff: ${classification.isStaff}, isCustomer: ${classification.isCustomer}`);

        // IMPORTANT: If conversation is already marked as staff, trust that status
        // This handles cases where phone format changes (e.g., LID vs regular phone)
        if (conversation.isStaff && !classification.isStaff) {
          console.log(`[Orchestrator] ⚠️ Conversation is staff but classifier said customer - trusting conversation status`);
          classification.isStaff = true;
          classification.isCustomer = false;

          // Re-classify intent as staff command ONLY if it matches specific patterns
          // Otherwise, let AI handle naturally (don't force greeting menu)
          if (classification.intent.startsWith("customer_")) {
            const msg = incoming.message.toLowerCase();
            if (/upload|tambah|input|masukin/i.test(msg) || hasMedia) {
              classification.intent = "staff_upload_vehicle";
              classification.reason = "Reclassified as staff upload (conversation is staff)";
              console.log(`[Orchestrator] Reclassified intent to: ${classification.intent}`);
            }
            // NOTE: Don't force staff_greeting for all other messages!
            // Let the original customer_* intent be handled by AI for natural conversation
            // Staff can still ask questions and get helpful AI responses
          }
        }
      }

      // Update message with intent
      await prisma.whatsAppMessage.update({
        where: { id: incomingMsg.id },
        data: {
          intent: classification.intent,
          confidence: classification.confidence,
          senderType: classification.isStaff ? "staff" : "customer",
        },
      });
      console.log(`[Orchestrator] Message updated with intent: ${classification.intent}`);

      // Update conversation type and store verified staff phone for LID mapping
      if (classification.isStaff) {
        // Get current contextData to preserve existing data
        const currentContext = (conversation.contextData as Record<string, any>) || {};

        // IMPORTANT: Get the ACTUAL staff phone from User table, not the incoming phone
        // This is critical for LID format handling - we need the real phone for linking
        const actualStaffPhone = await this.getStaffPhoneFromUser(incoming.from, incoming.tenantId);
        const isLID = incoming.from.includes("@lid");

        await prisma.whatsAppConversation.update({
          where: { id: conversation.id },
          data: {
            isStaff: true,
            conversationType: "staff",
            // Store the ACTUAL staff phone for LID-to-phone mapping
            contextData: {
              ...currentContext,
              // Always use the real phone number from User table, not the LID format
              verifiedStaffPhone: actualStaffPhone || currentContext.verifiedStaffPhone || (isLID ? null : incoming.from),
              verifiedAt: new Date().toISOString(),
              // Track all LIDs that have been used by this staff
              linkedLIDs: isLID
                ? Array.from(new Set([...(currentContext.linkedLIDs || []), incoming.from]))
                : currentContext.linkedLIDs,
            },
          },
        });
        console.log(`[Orchestrator] Stored verified staff phone: ${actualStaffPhone || incoming.from}, isLID: ${isLID}`);
      }

      // 4. Route based on intent
      let responseMessage: string | undefined;
      let escalated = false;
      let responseImages: Array<{ imageUrl: string; caption?: string }> | undefined;

      // Handle /verify command specially - allows LID users to verify themselves
      if (classification.intent === "staff_verify_identity") {
        console.log(`[Orchestrator] Routing to staff verify handler`);
        const result = await this.handleStaffVerify(
          conversation,
          incoming.message,
          incoming.from,
          incoming.tenantId
        );
        responseMessage = result.message;
        escalated = result.escalated;

        // If verification successful, update conversation to staff
        if (result.verified) {
          await prisma.whatsAppConversation.update({
            where: { id: conversation.id },
            data: {
              isStaff: true,
              conversationType: "staff",
              contextData: {
                ...((conversation.contextData as Record<string, any>) || {}),
                verifiedStaffPhone: result.verifiedPhone,
                verifiedAt: new Date().toISOString(),
                verifiedVia: "verify_command",
              },
            },
          });
        }
        console.log(`[Orchestrator] Verify result: ${responseMessage?.substring(0, 50)}...`);
      } else if (classification.isStaff && classification.intent.startsWith("staff_")) {
        // Handle staff command (only for staff_* intents)
        console.log(`[Orchestrator] Routing to staff command handler`);
        const result = await this.handleStaffCommand(
          conversation,
          classification.intent,
          incoming.message,
          incoming.from,
          incoming.tenantId,
          incoming.mediaUrl
        );
        // Check if we should skip response (e.g., silent photo save during batching)
        if (result.skipResponse) {
          console.log(`[Orchestrator] Staff command returned skipResponse=true, not sending message`);
          responseMessage = undefined;
        } else {
          responseMessage = result.message;
        }
        escalated = result.escalated;
        console.log(`[Orchestrator] Staff command result: ${result.skipResponse ? '(skipped)' : responseMessage?.substring(0, 50) + '...'}`);
      } else if (classification.isStaff && classification.intent.startsWith("customer_")) {
        // Staff asking general questions - route to AI for natural response
        console.log(`[Orchestrator] Staff with customer intent - routing to AI for natural response`);
        // Get staff info for context
        const staffInfo = await this.getStaffInfo(incoming.from, incoming.tenantId);
        const result = await this.handleCustomerInquiry(
          conversation,
          classification.intent,
          incoming.message,
          true, // isStaff
          staffInfo || undefined
        );
        responseMessage = result.message;
        escalated = result.escalated;
        responseImages = result.images;
        console.log(`[Orchestrator] AI response for staff: ${responseMessage?.substring(0, 50)}...`);
      } else {
        // Handle customer inquiry dengan AI
        console.log(`[Orchestrator] Routing to AI customer inquiry handler`);

        // Check if this is actually a staff (from conversation or classification)
        const isActuallyStaff = conversation.isStaff || classification.isStaff;

        // Check AI health - if AI is disabled, send fallback message for non-staff
        if (!aiHealth.canProcess && !isActuallyStaff) {
          console.log(`[Orchestrator] AI disabled (${aiHealth.status}), sending fallback message`);
          responseMessage = this.getAIDisabledFallbackMessage(aiHealth.status, aiHealth.reason);
          escalated = true; // Mark as escalated so staff knows to check manually
        } else {
          // AI is healthy or user is staff - proceed with AI processing
          const staffInfo = isActuallyStaff ? await this.getStaffInfo(incoming.from, incoming.tenantId) : null;

          try {
            const result = await this.handleCustomerInquiry(
              conversation,
              classification.intent,
              incoming.message,
              isActuallyStaff,
              staffInfo || undefined
            );
            responseMessage = result.message;
            escalated = result.escalated;
            responseImages = result.images;
            console.log(`[Orchestrator] AI response generated: ${responseMessage?.substring(0, 50)}...`);
            if (responseImages) {
              console.log(`[Orchestrator] AI also generated ${responseImages.length} images to send`);
            }

            // Track AI success (only for customer messages)
            if (!isActuallyStaff && !result.escalated) {
              await AIHealthMonitorService.trackSuccess(incoming.tenantId);
            }

        // Check if AI detected an upload request
        if (result.uploadRequest) {
          console.log(`[Orchestrator] 🚗 AI detected upload request:`, result.uploadRequest);

          // FIXED: Trust conversation.isStaff status instead of re-checking with phone
          // This fixes LID format issues where phone format changes between messages
          const isStaff = conversation.isStaff || await this.isStaffMember(incoming.from, incoming.tenantId);

          if (isStaff) {
            console.log(`[Orchestrator] User is staff, initiating upload flow...`);

            // Get current contextData to preserve existing fields like verifiedStaffPhone, linkedLIDs
            const currentContext = (conversation.contextData as Record<string, any>) || {};

            // IMPORTANT: Get the ACTUAL staff phone from User table for LID mapping
            // This is critical when AI detects staff upload - we need to set verifiedStaffPhone here too!
            const actualStaffPhone = await this.getStaffPhoneFromUser(incoming.from, incoming.tenantId);
            const isLID = incoming.from.includes("@lid");

            // Store vehicle data in conversation context
            await prisma.whatsAppConversation.update({
              where: { id: conversation.id },
              data: {
                conversationState: "upload_vehicle",
                isStaff: true,
                conversationType: "staff",
                contextData: {
                  ...currentContext, // Preserve existing fields
                  // CRITICAL: Set verifiedStaffPhone here so LID lookup works on next message!
                  verifiedStaffPhone: actualStaffPhone || currentContext.verifiedStaffPhone || (isLID ? null : incoming.from),
                  linkedLIDs: isLID
                    ? Array.from(new Set([...(currentContext.linkedLIDs || []), incoming.from]))
                    : currentContext.linkedLIDs,
                  uploadStep: incoming.mediaUrl ? "has_photo_and_data" : "has_data_awaiting_photo",
                  vehicleData: result.uploadRequest,
                  photos: incoming.mediaUrl ? [incoming.mediaUrl] : [],
                },
              },
            });

            // Ask for photo (vehicle will be created when photo is sent)
            responseMessage = `Oke data masuk! 👍\n\n` +
              `🚗 ${result.uploadRequest.make} ${result.uploadRequest.model} ${result.uploadRequest.year}\n` +
              `💰 Rp ${this.formatPrice(result.uploadRequest.price)}\n` +
              `🎨 ${result.uploadRequest.color || '-'} | ⚙️ ${result.uploadRequest.transmission || 'Manual'}\n` +
              (result.uploadRequest.mileage ? `📍 ${result.uploadRequest.mileage.toLocaleString('id-ID')} km\n\n` : '\n') +
              `Silakan kirimkan 6 foto kendaraan:\n` +
              `• Depan, belakang, samping\n` +
              `• Dashboard, jok, bagasi`;

            // If photo provided with message, add it to context
            if (incoming.mediaUrl) {
              await prisma.whatsAppConversation.update({
                where: { id: conversation.id },
                data: {
                  contextData: {
                    ...currentContext, // Preserve existing fields
                    // CRITICAL: Must include verifiedStaffPhone & linkedLIDs here too!
                    verifiedStaffPhone: actualStaffPhone || currentContext.verifiedStaffPhone || (isLID ? null : incoming.from),
                    linkedLIDs: isLID
                      ? Array.from(new Set([...(currentContext.linkedLIDs || []), incoming.from]))
                      : currentContext.linkedLIDs,
                    uploadStep: "has_photo_and_data",
                    vehicleData: result.uploadRequest,
                    photos: [incoming.mediaUrl],
                  },
                },
              });

              responseMessage = `Nice! Data + 1 foto masuk! 👍\n\n` +
                `🚗 ${result.uploadRequest.make} ${result.uploadRequest.model} ${result.uploadRequest.year}\n` +
                `💰 Rp ${this.formatPrice(result.uploadRequest.price)}\n` +
                `🎨 ${result.uploadRequest.color || '-'} | ⚙️ ${result.uploadRequest.transmission || 'Manual'}\n` +
                `📷 Foto: 1/6\n\n` +
                `Kirim 5 foto lagi ya~`;
            }
          } else {
            console.log(`[Orchestrator] User is NOT staff, ignoring upload request`);
            responseMessage = `Maaf kak, upload cuma buat staff aja 😊\n\nAda yang bisa aku bantu?`;
          }
        }

        // Check if AI detected an edit request
        if (result.editRequest) {
          console.log(`[Orchestrator] ✏️ AI detected edit request:`, result.editRequest);

          const isStaff = conversation.isStaff || await this.isStaffMember(incoming.from, incoming.tenantId);

          if (isStaff) {
            console.log(`[Orchestrator] User is staff, processing edit request...`);

            // Import and use VehicleEditService
            const { VehicleEditService } = await import('./vehicle-edit.service');

            const editResult = await VehicleEditService.editVehicle({
              vehicleId: result.editRequest.vehicleId,
              fields: [{
                field: result.editRequest.field,
                oldValue: result.editRequest.oldValue,
                newValue: result.editRequest.newValue,
              }],
              staffPhone: incoming.from,
              tenantId: incoming.tenantId,
              conversationId: conversation.id,
            });

            responseMessage = editResult.message;
          } else {
            console.log(`[Orchestrator] User is NOT staff, ignoring edit request`);
            responseMessage = `Maaf kak, fitur edit cuma buat staff aja 😊\n\nAda yang bisa aku bantu?`;
          }
        }
          } catch (aiError: any) {
            // Track AI error for health monitoring
            console.error(`[Orchestrator] AI error caught:`, aiError.message);
            await AIHealthMonitorService.trackError(incoming.tenantId, aiError.message);

            // Send fallback message to customer
            responseMessage = this.getAIDisabledFallbackMessage("error", aiError.message);
            escalated = true;
          }
        }
      }

      // 5. Send response if generated
      if (responseMessage || responseImages) {
        console.log(`[Orchestrator] Sending response to ${incoming.from}`);
        await this.sendResponse(
          incoming.accountId,
          incoming.from,
          responseMessage || "", // Ensure message is always a string
          conversation.id,
          classification.intent,
          responseImages
        );
        console.log(`[Orchestrator] Response sent successfully`);
      } else {
        // SAFETY NET: Always send a fallback for non-staff customers
        // This prevents "typing" indicator from hanging forever
        const isCustomer = !conversation.isStaff && !classification.isStaff;
        if (isCustomer) {
          console.log(`[Orchestrator] ⚠️ No response generated for customer - sending fallback`);
          const fallbackMessage = `Halo! 👋\n\nTerima kasih sudah menghubungi kami.\n\nTim kami akan segera membalas pesan Anda.\nMohon menunggu sebentar ya 🙏`;
          await this.sendResponse(
            incoming.accountId,
            incoming.from,
            fallbackMessage,
            conversation.id,
            classification.intent
          );
          console.log(`[Orchestrator] Fallback response sent`);
        } else {
          console.log(`[Orchestrator] No response message generated (staff message)`);
        }
      }

      // 6. Update conversation status
      await prisma.whatsAppConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          lastIntent: classification.intent,
          ...(escalated && {
            escalatedTo: "human", // In production, assign to specific staff
            escalatedAt: new Date(),
          }),
        },
      });

      return {
        success: true,
        conversationId: conversation.id,
        intent: classification.intent,
        responseMessage,
        escalated,
      };
    } catch (error: any) {
      console.error("[Message Orchestrator] Error processing message:", error);
      return {
        success: false,
        conversationId: "",
        intent: "unknown",
        escalated: true,
        error: error.message,
      };
    }
  }

  /**
   * Normalize phone number for comparison
   */
  private static normalizePhoneForLookup(phone: string): string {
    if (!phone) return "";
    // Handle LID format - return as is for LID-specific lookup
    if (phone.includes("@lid")) return phone;
    // Remove all non-digit characters and normalize Indonesian format
    let digits = phone.replace(/\D/g, "");
    if (digits.startsWith("0")) digits = "62" + digits.substring(1);
    return digits;
  }

  /**
   * Get or create conversation
   * Enhanced to handle phone/LID format variations
   */
  private static async getOrCreateConversation(
    accountId: string,
    tenantId: string,
    customerPhone: string
  ) {
    console.log(`[Orchestrator] Getting/creating conversation - accountId: ${accountId}, tenantId: ${tenantId}, phone: ${customerPhone}`);

    const normalizedPhone = this.normalizePhoneForLookup(customerPhone);
    const isLID = customerPhone.includes("@lid");

    // Try to find active conversation by exact phone match first
    let conversation = await prisma.whatsAppConversation.findFirst({
      where: {
        accountId,
        customerPhone,
        status: "active",
      },
      orderBy: { lastMessageAt: "desc" },
    });

    // If not found and this is an LID, try to find conversation with matching verified phone
    if (!conversation && isLID) {
      console.log(`[Orchestrator] LID detected, searching for linked conversation...`);
      // Search for any staff conversation that might have this LID linked
      const allActiveConvos = await prisma.whatsAppConversation.findMany({
        where: {
          accountId,
          status: "active",
          isStaff: true,
        },
        orderBy: { lastMessageAt: "desc" },
        take: 50, // Check more conversations for better LID matching
      });

      console.log(`[Orchestrator] Found ${allActiveConvos.length} active staff conversations to check`);

      // Check if any conversation has this LID in linkedLIDs array
      for (const conv of allActiveConvos) {
        const contextData = conv.contextData as Record<string, any> | null;

        // Check if this LID is in the linkedLIDs array
        if (contextData?.linkedLIDs?.includes(customerPhone)) {
          console.log(`[Orchestrator] ✅ Found conversation with this LID in linkedLIDs: ${conv.id}`);
          conversation = conv;
          break;
        }

        // Legacy check for old linkedLID field (single value)
        if (contextData?.linkedLID === customerPhone) {
          console.log(`[Orchestrator] ✅ Found conversation with legacy linkedLID: ${conv.id}`);
          conversation = conv;
          // Migrate to new linkedLIDs array format
          await prisma.whatsAppConversation.update({
            where: { id: conv.id },
            data: {
              contextData: {
                ...contextData,
                linkedLIDs: [customerPhone],
                linkedLID: undefined, // Remove legacy field
              },
            },
          });
          break;
        }
      }

      // PRIORITY 1: Find conversation with active upload state (add_photo_to_vehicle or upload_vehicle)
      // This is critical for multi-step flows where photo comes from LID after data came from regular phone
      if (!conversation) {
        console.log(`[Orchestrator] Checking for conversation with active upload state...`);
        const uploadStateConvo = allActiveConvos.find(conv => {
          const state = conv.conversationState;
          const lastMessageAt = conv.lastMessageAt;
          // Must be recent (within 2 hours - photos usually come quickly after data)
          const isRecent = lastMessageAt && (Date.now() - new Date(lastMessageAt).getTime() < 2 * 60 * 60 * 1000);
          return isRecent && (state === "add_photo_to_vehicle" || state === "upload_vehicle");
        });

        if (uploadStateConvo) {
          console.log(`[Orchestrator] ✅ Found conversation with upload state: ${uploadStateConvo.id} (state: ${uploadStateConvo.conversationState})`);
          conversation = uploadStateConvo;
          const contextData = (uploadStateConvo.contextData as Record<string, any>) || {};
          // Link this LID to the conversation
          await prisma.whatsAppConversation.update({
            where: { id: uploadStateConvo.id },
            data: {
              contextData: {
                ...contextData,
                linkedLIDs: Array.from(new Set([...(contextData.linkedLIDs || []), customerPhone])),
              },
            },
          });
          console.log(`[Orchestrator] Linked LID ${customerPhone} to upload state conversation`);
        }
      }

      // PRIORITY 2: Find conversation with verifiedStaffPhone (recent)
      if (!conversation) {
        console.log(`[Orchestrator] Checking for recent staff conversation with verifiedStaffPhone...`);
        // Get the most recent staff conversation (within last 24 hours)
        const recentStaffConvo = allActiveConvos.find(conv => {
          const contextData = conv.contextData as Record<string, any> | null;
          const lastMessageAt = conv.lastMessageAt;
          const isRecent = lastMessageAt && (Date.now() - new Date(lastMessageAt).getTime() < 24 * 60 * 60 * 1000);
          // Must have a verified staff phone (not LID) to be linkable
          return isRecent && contextData?.verifiedStaffPhone && !contextData.verifiedStaffPhone.includes("@lid");
        });

        if (recentStaffConvo) {
          console.log(`[Orchestrator] ✅ Found recent staff conversation to link: ${recentStaffConvo.id}`);
          conversation = recentStaffConvo;
          const contextData = (recentStaffConvo.contextData as Record<string, any>) || {};
          // Add this LID to the linkedLIDs array
          await prisma.whatsAppConversation.update({
            where: { id: recentStaffConvo.id },
            data: {
              contextData: {
                ...contextData,
                linkedLIDs: Array.from(new Set([...(contextData.linkedLIDs || []), customerPhone])),
              },
            },
          });
          console.log(`[Orchestrator] Linked LID ${customerPhone} to conversation`);
        }
      }

      // PRIORITY 3: Find ANY recent staff conversation for this account (fallback)
      if (!conversation) {
        console.log(`[Orchestrator] Fallback: Checking for any recent staff conversation...`);
        const anyRecentStaffConvo = allActiveConvos.find(conv => {
          const lastMessageAt = conv.lastMessageAt;
          // Must be very recent (within 30 minutes) for fallback linking
          const isVeryRecent = lastMessageAt && (Date.now() - new Date(lastMessageAt).getTime() < 30 * 60 * 1000);
          return isVeryRecent;
        });

        if (anyRecentStaffConvo) {
          console.log(`[Orchestrator] ✅ Found very recent staff conversation (fallback): ${anyRecentStaffConvo.id}`);
          conversation = anyRecentStaffConvo;
          const contextData = (anyRecentStaffConvo.contextData as Record<string, any>) || {};
          // Add this LID to the linkedLIDs array
          await prisma.whatsAppConversation.update({
            where: { id: anyRecentStaffConvo.id },
            data: {
              contextData: {
                ...contextData,
                linkedLIDs: Array.from(new Set([...(contextData.linkedLIDs || []), customerPhone])),
              },
            },
          });
          console.log(`[Orchestrator] Linked LID ${customerPhone} to conversation (fallback)`);
        }
      }
    }

    // If not found and this is a phone number, try to find conversation with matching LID
    if (!conversation && !isLID) {
      console.log(`[Orchestrator] Phone detected, searching for LID-linked conversation...`);
      // First, search for staff conversations that have this phone as verifiedStaffPhone
      const allStaffConvos = await prisma.whatsAppConversation.findMany({
        where: {
          accountId,
          status: "active",
          isStaff: true,
        },
        orderBy: { lastMessageAt: "desc" },
        take: 20,
      });

      for (const conv of allStaffConvos) {
        const contextData = conv.contextData as Record<string, any> | null;
        if (contextData?.verifiedStaffPhone) {
          // Normalize both for comparison
          const verifiedPhone = this.normalizePhoneForLookup(contextData.verifiedStaffPhone);
          if (verifiedPhone === normalizedPhone) {
            console.log(`[Orchestrator] ✅ Found staff conversation with matching verifiedStaffPhone: ${conv.id}`);
            conversation = conv;
            break;
          }
        }
      }
    }

    // Create new conversation if not found
    if (!conversation) {
      console.log(`[Orchestrator] Creating new conversation for ${customerPhone}`);
      conversation = await prisma.whatsAppConversation.create({
        data: {
          accountId,
          tenantId,
          customerPhone,
          isStaff: false,
          conversationType: "customer",
          status: "active",
        },
      });
      console.log(`[Orchestrator] Created conversation: ${conversation.id}`);
    } else {
      console.log(`[Orchestrator] Found existing conversation: ${conversation.id}, isStaff: ${conversation.isStaff}, state: ${conversation.conversationState}`);
    }

    // AUTO-UPDATE: If this is a real phone (not LID), check if there are LID conversations to update
    if (!isLID && !customerPhone.includes("@lid")) {
      await this.updateLIDConversationsToRealPhone(accountId, tenantId, customerPhone);
    }

    return conversation;
  }

  /**
   * Update conversations that have LID customerPhone to real phone number
   * Called when we receive a message from a real phone number
   */
  private static async updateLIDConversationsToRealPhone(
    accountId: string,
    tenantId: string,
    realPhone: string
  ) {
    // Helper to check if a number looks like a LID
    const isLIDNumber = (num: string): boolean => {
      const digits = num.replace(/\D/g, "");
      if (digits.length < 14) return false;
      if (digits.startsWith("100") || digits.startsWith("101") || digits.startsWith("102")) return true;
      if (digits.length >= 16) return true;
      if (digits.startsWith("1") && digits.length > 11) return true;
      if (digits.startsWith("62") && digits.length > 14) return true;
      return false;
    };

    try {
      // Find conversations with LID-like customerPhone
      const lidConversations = await prisma.whatsAppConversation.findMany({
        where: {
          accountId,
          tenantId,
          status: "active",
        },
      });

      for (const conv of lidConversations) {
        const customerPhoneDigits = conv.customerPhone.replace(/\D/g, "");

        // Check if this conversation has a LID as customerPhone
        if (isLIDNumber(customerPhoneDigits) || conv.customerPhone.includes("@lid")) {
          const contextData = conv.contextData as Record<string, any> | null;

          // Check if this LID conversation is linked to the real phone via verifiedStaffPhone
          const normalizedReal = this.normalizePhoneForLookup(realPhone);
          const verifiedPhone = contextData?.verifiedStaffPhone;
          const normalizedVerified = verifiedPhone ? this.normalizePhoneForLookup(verifiedPhone) : "";

          if (normalizedVerified === normalizedReal) {
            console.log(`[Orchestrator] 🔄 Updating LID conversation ${conv.id}: ${conv.customerPhone} -> ${realPhone}`);

            await prisma.whatsAppConversation.update({
              where: { id: conv.id },
              data: {
                customerPhone: realPhone,
                contextData: {
                  ...contextData,
                  previousLID: conv.customerPhone,
                  phoneUpdatedAt: new Date().toISOString(),
                },
              },
            });

            console.log(`[Orchestrator] ✅ Successfully updated conversation phone number`);
          }
        }
      }
    } catch (error: any) {
      console.error(`[Orchestrator] Error updating LID conversations:`, error.message);
    }
  }

  /**
   * Save incoming message to database
   */
  private static async saveIncomingMessage(
    conversationId: string,
    incoming: IncomingMessage
  ) {
    console.log(`[Orchestrator] Saving incoming message - conversationId: ${conversationId}, messageId: ${incoming.messageId}`);

    const conversation = await prisma.whatsAppConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const message = await prisma.whatsAppMessage.create({
      data: {
        conversationId,
        tenantId: conversation.tenantId,
        direction: "inbound",
        sender: incoming.from,
        senderType: "customer", // Will be updated after classification
        content: incoming.message,
        mediaUrl: incoming.mediaUrl,
        mediaType: incoming.mediaType,
        aimeowMessageId: incoming.messageId,
        aimeowStatus: "delivered",
      },
    });

    console.log(`[Orchestrator] Saved message: ${message.id}`);
    return message;
  }

  /**
   * Handle staff command
   * UPDATED: Now uses StaffCommandService for full command processing
   */
  private static async handleStaffCommand(
    conversation: any,
    intent: MessageIntent,
    message: string,
    staffPhone: string,
    tenantId: string,
    mediaUrl?: string
  ): Promise<{ message: string; escalated: boolean; skipResponse?: boolean }> {
    try {
      // Determine if there's media
      const hasMedia = !!mediaUrl;
      console.log(`[Orchestrator] handleStaffCommand - message: "${message}", hasMedia: ${hasMedia}, mediaUrl: ${mediaUrl}`);

      // Parse command (now async - supports AI-powered natural language extraction)
      const parseResult = await StaffCommandService.parseCommand(message, intent, hasMedia);

      if (!parseResult.isValid) {
        return {
          message: parseResult.error || "❌ Format command tidak valid.",
          escalated: false,
        };
      }

      // Execute command
      const executionResult = await StaffCommandService.executeCommand(
        intent,
        parseResult.params,
        tenantId,
        staffPhone,
        conversation.id,
        mediaUrl
      );

      return {
        message: executionResult.message,
        escalated: !executionResult.success,
        skipResponse: executionResult.skipResponse,
      };
    } catch (error: any) {
      console.error("[Message Orchestrator] Staff command error:", error);
      return {
        message: `Mohon maaf, terjadi kesalahan:\n\n${error.message}\n\nSilakan coba lagi.`,
        escalated: true,
        skipResponse: false,
      };
    }
  }

  /**
   * Handle customer inquiry dengan AI
   */
  private static async handleCustomerInquiry(
    conversation: any,
    intent: MessageIntent,
    message: string,
    isStaff: boolean = false,
    staffInfo?: { name: string; role: string; phone: string }
  ): Promise<{
    message: string;
    escalated: boolean;
    images?: Array<{ imageUrl: string; caption?: string }>;
    uploadRequest?: any;
    editRequest?: any;
  }> {
    try {
      // Get conversation history (limit to 5 for faster response)
      const messageHistory = await WhatsAppAIChatService.getConversationHistory(
        conversation.id,
        5
      );

      // Generate AI response with staff info context
      const aiResponse = await WhatsAppAIChatService.generateResponse(
        {
          tenantId: conversation.tenantId,
          conversationId: conversation.id,
          customerPhone: conversation.customerPhone,
          customerName: conversation.customerName,
          intent,
          messageHistory,
          isStaff,
          staffInfo,
        },
        message
      );

      return {
        message: aiResponse.message,
        escalated: aiResponse.shouldEscalate,
        ...(aiResponse.images && { images: aiResponse.images }),
        ...(aiResponse.uploadRequest && { uploadRequest: aiResponse.uploadRequest }),
        ...(aiResponse.editRequest && { editRequest: aiResponse.editRequest }),
      };
    } catch (error: any) {
      console.error("[Message Orchestrator] AI response error:", error);
      return {
        message:
          "Mohon maaf, saat ini terjadi kendala teknis.\n\nTim kami akan segera menghubungi Anda. Terima kasih atas kesabaran Bapak/Ibu.",
        escalated: true,
      };
    }
  }

  /**
   * Handle staff verify command
   * Allows LID users to verify their staff identity using their phone number
   * Format: /verify 081234567890
   */
  private static async handleStaffVerify(
    conversation: any,
    message: string,
    senderPhone: string,
    tenantId: string
  ): Promise<{ message: string; escalated: boolean; verified: boolean; verifiedPhone?: string }> {
    try {
      console.log(`[Orchestrator] handleStaffVerify - message: "${message}", sender: ${senderPhone}`);

      // Extract phone number from message
      const phoneMatch = message.match(/(?:\/verify|verify|verifikasi)\s+(\+?[\d\s-]+)/i);
      if (!phoneMatch) {
        return {
          message: "❌ Format salah!\n\nCara pakai:\n/verify 081234567890\n\nGanti dengan nomor HP staff kamu ya 📱",
          escalated: false,
          verified: false,
        };
      }

      const claimedPhone = phoneMatch[1].replace(/[\s-]/g, "");
      console.log(`[Orchestrator] Claimed phone: ${claimedPhone}`);

      // Normalize the claimed phone
      const normalizedClaimed = this.normalizePhone(claimedPhone);

      // Check if this phone belongs to a staff member
      const staffUsers = await prisma.user.findMany({
        where: {
          tenantId,
          role: { in: ["ADMIN", "MANAGER", "SALES", "STAFF"] },
        },
        select: { id: true, phone: true, firstName: true, role: true },
      });

      let matchedStaff = null;
      for (const user of staffUsers) {
        if (!user.phone) continue;
        const normalizedUserPhone = this.normalizePhone(user.phone);
        if (normalizedClaimed === normalizedUserPhone) {
          matchedStaff = user;
          break;
        }
      }

      if (!matchedStaff) {
        console.log(`[Orchestrator] ❌ Phone ${claimedPhone} not found in staff list`);
        return {
          message: "❌ Nomor tidak terdaftar sebagai staff.\n\nPastikan nomor HP benar atau hubungi admin untuk menambahkan nomor kamu 📱",
          escalated: false,
          verified: false,
        };
      }

      console.log(`[Orchestrator] ✅ Verified as staff: ${matchedStaff.firstName} (${matchedStaff.role})`);

      return {
        message: `✅ Verifikasi berhasil!\n\nHalo ${matchedStaff.firstName} 👋\nKamu sudah terverifikasi sebagai ${matchedStaff.role}.\n\nSekarang kamu bisa pakai semua fitur staff!\nKetik 'halo' untuk melihat menu.`,
        escalated: false,
        verified: true,
        verifiedPhone: claimedPhone,
      };
    } catch (error: any) {
      console.error("[Orchestrator] Staff verify error:", error);
      return {
        message: "❌ Terjadi kesalahan saat verifikasi.\n\nSilakan coba lagi.",
        escalated: true,
        verified: false,
      };
    }
  }

  /**
   * Send response via Aimeow
   */
  private static async sendResponse(
    accountId: string,
    to: string,
    message: string,
    conversationId: string,
    intent: MessageIntent,
    images?: Array<{ imageUrl: string; caption?: string }>
  ) {
    console.log("=".repeat(80));
    console.log(`[Orchestrator sendResponse] Starting send...`);
    console.log(`[Orchestrator sendResponse] Account ID: ${accountId}`);
    console.log(`[Orchestrator sendResponse] To: ${to}`);
    console.log(`[Orchestrator sendResponse] Message: ${message.substring(0, 100)}`);
    console.log(`[Orchestrator sendResponse] Conversation ID: ${conversationId}`);

    try {
      // Get account - fresh from DB to get updated clientId
      const account = await prisma.aimeowAccount.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        console.error(`[Orchestrator sendResponse] ❌ Account not found: ${accountId}`);
        throw new Error("Account not found");
      }

      console.log(`[Orchestrator sendResponse] ✅ Account found`);
      console.log(`[Orchestrator sendResponse] Client ID: ${account.clientId}`);
      console.log(`[Orchestrator sendResponse] Phone: ${account.phoneNumber}`);
      console.log(`[Orchestrator sendResponse] Status: ${account.connectionStatus}`);
      console.log(`[Orchestrator sendResponse] Active: ${account.isActive}`);

      // Send text message via Aimeow
      let result: any = { success: true, messageId: null };
      if (message) {
        console.log(`[Orchestrator sendResponse] Calling AimeowClientService.sendMessage...`);
        result = await AimeowClientService.sendMessage({
          clientId: account.clientId,
          to,
          message,
        });

        console.log(`[Orchestrator sendResponse] Send result:`, JSON.stringify(result, null, 2));

        if (!result.success) {
          console.error(`[Orchestrator sendResponse] ❌ Send FAILED: ${result.error}`);
          throw new Error(result.error || "Failed to send message");
        }

        console.log(`[Orchestrator sendResponse] ✅ Text message sent SUCCESS!`);
      } else {
        console.log(`[Orchestrator sendResponse] No text message to send`);
      }

      // Send images if provided
      let imagesSent = false;
      if (images && images.length > 0) {
        console.log(`[Orchestrator sendResponse] 📸 Sending ${images.length} images...`);
        console.log(`[Orchestrator sendResponse] Image URLs:`, images.map(i => i.imageUrl));

        if (images.length === 1) {
          // Send single image
          console.log(`[Orchestrator sendResponse] Sending single image: ${images[0].imageUrl}`);
          const imageResult = await AimeowClientService.sendImage(
            account.clientId,
            to,
            images[0].imageUrl,
            images[0].caption
          );

          if (!imageResult.success) {
            console.error(`[Orchestrator sendResponse] ❌ Image send FAILED: ${imageResult.error}`);
          } else {
            console.log(`[Orchestrator sendResponse] ✅ Image sent SUCCESS!`);
            imagesSent = true;
            if (!result.messageId) result.messageId = imageResult.messageId;
          }
        } else {
          // Send multiple images one by one for better reliability
          console.log(`[Orchestrator sendResponse] Sending ${images.length} images one by one...`);
          for (let i = 0; i < images.length; i++) {
            const img = images[i];
            console.log(`[Orchestrator sendResponse] Sending image ${i + 1}/${images.length}: ${img.imageUrl}`);

            const imageResult = await AimeowClientService.sendImage(
              account.clientId,
              to,
              img.imageUrl,
              img.caption
            );

            if (!imageResult.success) {
              console.error(`[Orchestrator sendResponse] ❌ Image ${i + 1} send FAILED: ${imageResult.error}`);
            } else {
              console.log(`[Orchestrator sendResponse] ✅ Image ${i + 1} sent SUCCESS!`);
              imagesSent = true;
              if (!result.messageId) result.messageId = imageResult.messageId;
            }

            // Small delay between images to avoid rate limiting
            if (i < images.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }

        if (imagesSent) {
          console.log(`[Orchestrator sendResponse] ✅ All images sent successfully!`);
        }
      }

      // Save outbound message
      const conversation = await prisma.whatsAppConversation.findUnique({
        where: { id: conversationId },
      });

      if (conversation) {
        console.log(`[Orchestrator sendResponse] Saving outbound message to database...`);
        const contentToSave = message || (imagesSent ? `[${images?.length || 0} foto dikirim]` : '');
        const savedMsg = await prisma.whatsAppMessage.create({
          data: {
            conversationId,
            tenantId: conversation.tenantId,
            direction: "outbound",
            sender: account.phoneNumber || "AI",
            senderType: "ai",
            content: contentToSave,
            intent,
            aiResponse: true,
            aimeowMessageId: result?.messageId || `msg_${Date.now()}`,
            aimeowStatus: "sent",
          },
        });
        console.log(`[Orchestrator sendResponse] ✅ Outbound message saved: ${savedMsg.id}`);
      } else {
        console.error(`[Orchestrator sendResponse] ❌ Conversation not found: ${conversationId}`);
      }

      console.log(`[Orchestrator sendResponse] ✅✅✅ SEND COMPLETE SUCCESS ✅✅✅`);
    } catch (error: any) {
      console.error("=".repeat(80));
      console.error(`[Orchestrator sendResponse] ❌❌❌ CRITICAL ERROR ❌❌❌`);
      console.error(`[Orchestrator sendResponse] Error message: ${error.message}`);
      console.error(`[Orchestrator sendResponse] Error stack:`, error.stack);
      console.error("=".repeat(80));

      // Save failed message to database for tracking
      try {
        const conversation = await prisma.whatsAppConversation.findUnique({
          where: { id: conversationId },
        });

        if (conversation) {
          await prisma.whatsAppMessage.create({
            data: {
              conversationId,
              tenantId: conversation.tenantId,
              direction: "outbound",
              sender: "AI",
              senderType: "ai",
              content: message,
              intent,
              aiResponse: true,
              aimeowMessageId: null,
              aimeowStatus: "failed",
            },
          });
          console.log(`[Orchestrator sendResponse] Saved FAILED message to database for tracking`);
        }
      } catch (dbError) {
        console.error(`[Orchestrator sendResponse] Failed to save error to DB:`, dbError);
      }

      // Don't throw - message saved but not sent, can retry later
    }
  }

  /**
   * Get the actual staff phone from User table
   * This resolves LID format issues by looking up the real phone number
   */
  private static async getStaffPhoneFromUser(phone: string, tenantId: string): Promise<string | null> {
    // If this is an LID format, we can't match it directly - return null
    if (phone.includes("@lid")) {
      console.log(`[Orchestrator] getStaffPhoneFromUser: LID format detected, cannot lookup directly`);
      return null;
    }

    const normalizedInput = this.normalizePhone(phone);

    // Get all users in tenant with staff roles
    const users = await prisma.user.findMany({
      where: {
        tenantId,
        role: { in: ["ADMIN", "MANAGER", "SALES", "STAFF"] },
      },
      select: { id: true, phone: true },
    });

    for (const user of users) {
      if (!user.phone) continue;
      const normalizedUserPhone = this.normalizePhone(user.phone);
      if (normalizedInput === normalizedUserPhone) {
        console.log(`[Orchestrator] getStaffPhoneFromUser: Found actual phone: ${user.phone}`);
        return user.phone;
      }
    }

    console.log(`[Orchestrator] getStaffPhoneFromUser: No staff match found for ${phone}`);
    return null;
  }

  /**
   * Get full staff info (name, role, phone) for a phone number
   */
  private static async getStaffInfo(phone: string, tenantId: string): Promise<{ name: string; role: string; phone: string } | null> {
    console.log(`[Orchestrator] getStaffInfo: Looking up phone="${phone}" in tenant=${tenantId}`);

    // Handle LID format - check conversation context for verified phone
    if (phone.includes("@lid")) {
      console.log(`[Orchestrator] getStaffInfo: LID format detected, checking conversation context`);
      const conversation = await prisma.whatsAppConversation.findFirst({
        where: { tenantId, customerPhone: phone, isStaff: true },
        select: { contextData: true },
      });
      const contextData = conversation?.contextData as Record<string, any> | null;
      if (contextData?.verifiedStaffPhone) {
        console.log(`[Orchestrator] getStaffInfo: Found verified phone in context: ${contextData.verifiedStaffPhone}`);
        return this.getStaffInfo(contextData.verifiedStaffPhone, tenantId);
      }
      console.log(`[Orchestrator] getStaffInfo: No verified phone in LID conversation context`);
      return null;
    }

    const normalizedInput = this.normalizePhone(phone);
    console.log(`[Orchestrator] getStaffInfo: Normalized input: "${normalizedInput}"`);

    // Get all users in tenant with staff roles
    const users = await prisma.user.findMany({
      where: {
        tenantId,
        role: { in: ["ADMIN", "MANAGER", "SALES", "STAFF"] },
      },
      select: { id: true, phone: true, firstName: true, lastName: true, role: true },
    });

    console.log(`[Orchestrator] getStaffInfo: Found ${users.length} staff users in tenant`);

    for (const user of users) {
      if (!user.phone) {
        console.log(`[Orchestrator] getStaffInfo: User ${user.firstName} has no phone`);
        continue;
      }
      const normalizedUserPhone = this.normalizePhone(user.phone);
      console.log(`[Orchestrator] getStaffInfo: Comparing "${normalizedInput}" with user ${user.firstName} phone="${user.phone}" normalized="${normalizedUserPhone}"`);

      if (normalizedInput === normalizedUserPhone) {
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
        console.log(`[Orchestrator] getStaffInfo: ✅ MATCH! Found staff: ${fullName} (${user.role})`);
        return {
          name: fullName || "Staff",
          role: user.role,
          phone: user.phone,
        };
      }
    }

    console.log(`[Orchestrator] getStaffInfo: ❌ No staff match found for ${phone} (normalized: ${normalizedInput})`);
    return null;
  }

  /**
   * Check if phone number belongs to staff
   * Uses normalized phone comparison for flexible matching
   * Includes: ADMIN, MANAGER, SALES, STAFF roles
   */
  private static async isStaffMember(phone: string, tenantId: string): Promise<boolean> {
    const normalizedInput = this.normalizePhone(phone);
    console.log(`[Orchestrator] Checking staff - input: ${phone}, normalized: ${normalizedInput}`);

    // Get all users in tenant with staff roles and check phone match with normalization
    const users = await prisma.user.findMany({
      where: {
        tenantId,
        role: { in: ["ADMIN", "MANAGER", "SALES", "STAFF"] },
      },
      select: { id: true, phone: true, firstName: true, role: true },
    });

    for (const user of users) {
      if (!user.phone) continue;
      const normalizedUserPhone = this.normalizePhone(user.phone);
      if (normalizedInput === normalizedUserPhone) {
        console.log(`[Orchestrator] ✅ Staff match found: ${user.firstName} (${user.role})`);
        return true;
      }
    }

    console.log(`[Orchestrator] ❌ No staff match found for phone: ${phone}`);
    return false;
  }

  /**
   * Normalize phone number for comparison
   * Handles various formats: +62xxx, 62xxx, 0xxx, 08xxx
   */
  private static normalizePhone(phone: string): string {
    if (!phone) return "";

    // Handle JID format (e.g., "6281234567890@s.whatsapp.net")
    if (phone.includes("@")) {
      phone = phone.split("@")[0];
    }

    // Handle device suffix (e.g., "6281234567890:17")
    if (phone.includes(":")) {
      phone = phone.split(":")[0];
    }

    // Remove all non-digit characters
    let digits = phone.replace(/\D/g, "");

    // Convert Indonesian formats to standard 62xxx
    if (digits.startsWith("0")) {
      digits = "62" + digits.substring(1);
    }

    // Handle case where someone enters just 8xxx (missing country code)
    if (digits.startsWith("8") && digits.length >= 9 && digits.length <= 12) {
      digits = "62" + digits;
    }

    return digits;
  }

  /**
   * Format price to Indonesian format
   * Note: Database stores prices in IDR cents (Rp 250jt = 25000000000)
   * So we divide by 100 to get the actual Rupiah value
   */
  private static formatPrice(price: number): string {
    // Convert from cents to Rupiah
    const priceInRupiah = Math.round(price / 100);
    return new Intl.NumberFormat("id-ID").format(priceInRupiah);
  }

  /**
   * Get fallback message when AI is disabled or has errors
   * Used to inform customers that AI is temporarily unavailable
   */
  private static getAIDisabledFallbackMessage(status: string, reason?: string): string {
    if (status === "disabled") {
      return (
        `Halo! 👋\n\n` +
        `Mohon maaf, saat ini AI kami sedang dalam pemeliharaan.\n\n` +
        `Tim kami akan segera membalas pesan Anda.\n` +
        `Terima kasih atas kesabaran Bapak/Ibu. 🙏`
      );
    }

    // For error/degraded status
    return (
      `Halo! 👋\n\n` +
      `Mohon maaf, saat ini kami sedang mengalami kendala teknis.\n\n` +
      `Tim kami akan segera menghubungi Anda.\n` +
      `Terima kasih atas kesabaran Bapak/Ibu. 🙏`
    );
  }

  /**
   * Add a photo to an existing vehicle from WhatsApp media URL
   * Downloads the photo, processes it, and attaches to vehicle
   */
  private static async addPhotoToVehicle(
    vehicleId: string,
    mediaUrl: string,
    tenantId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[Orchestrator] Adding photo to vehicle ${vehicleId} from ${mediaUrl}`);

      // Import required services
      const { ImageProcessingService } = await import('@/lib/services/image-processing.service');
      const { StorageService } = await import('@/lib/services/storage.service');
      const { PlateDetectionService } = await import('@/lib/services/plate-detection.service');

      // Get vehicle details
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: vehicleId },
        select: { id: true, make: true, model: true, tenantId: true },
      });

      if (!vehicle) {
        return { success: false, error: 'Vehicle not found' };
      }

      // Get tenant for plate cover branding
      const tenant = await prisma.tenant.findUnique({
        where: { id: vehicle.tenantId },
        select: { name: true, logoUrl: true },
      });

      // Download photo from WhatsApp URL
      console.log(`[Orchestrator] Downloading photo from ${mediaUrl}`);
      const photoResponse = await fetch(mediaUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!photoResponse.ok) {
        return { success: false, error: `Failed to download photo: ${photoResponse.status}` };
      }

      const arrayBuffer = await photoResponse.arrayBuffer();
      const photoBuffer = Buffer.from(new Uint8Array(arrayBuffer));
      console.log(`[Orchestrator] Downloaded ${photoBuffer.length} bytes`);

      // Detect and cover license plates
      let processedBuffer: Buffer = photoBuffer;
      try {
        const plateResult = await PlateDetectionService.processImage(photoBuffer, {
          tenantName: tenant?.name || 'PRIMA MOBIL',
          tenantLogoUrl: tenant?.logoUrl || undefined,
        });
        processedBuffer = plateResult.covered;
        if (plateResult.platesDetected > 0) {
          console.log(`[Orchestrator] Covered ${plateResult.platesDetected} plate(s)`);
        }
      } catch (plateError: any) {
        console.warn(`[Orchestrator] Plate detection failed:`, plateError.message);
      }

      // Process photo (generate multiple sizes)
      const processed = await ImageProcessingService.processPhoto(processedBuffer);

      // Generate filename
      const timestamp = Date.now();
      const baseFilename = `${vehicle.make.toLowerCase()}-${vehicle.model.toLowerCase()}-${timestamp}`;

      // Ensure upload directory exists
      await StorageService.ensureUploadDir();

      // Upload all sizes to storage
      const uploadResult = await StorageService.uploadMultipleSize(
        {
          original: processed.original,
          large: processed.large,
          medium: processed.medium,
          thumbnail: processed.thumbnail,
        },
        vehicle.id,
        baseFilename
      );

      // Get the next display order
      const lastPhoto = await prisma.vehiclePhoto.findFirst({
        where: { vehicleId },
        orderBy: { displayOrder: 'desc' },
        select: { displayOrder: true },
      });
      const nextDisplayOrder = lastPhoto ? lastPhoto.displayOrder + 1 : 1;

      // Create database record
      await prisma.vehiclePhoto.create({
        data: {
          vehicleId: vehicle.id,
          tenantId: vehicle.tenantId,
          storageKey: uploadResult.storageKey,
          originalUrl: uploadResult.originalUrl,
          largeUrl: uploadResult.largeUrl,
          mediumUrl: uploadResult.mediumUrl,
          thumbnailUrl: uploadResult.thumbnailUrl,
          filename: `${baseFilename}.jpg`,
          fileSize: photoBuffer.length,
          mimeType: 'image/jpeg',
          width: processed.metadata?.width || 0,
          height: processed.metadata?.height || 0,
          displayOrder: nextDisplayOrder,
        },
      });

      console.log(`[Orchestrator] ✅ Photo added successfully (order: ${nextDisplayOrder})`);
      return { success: true };

    } catch (error: any) {
      console.error(`[Orchestrator] Error adding photo:`, error);
      return { success: false, error: error.message };
    }
  }
}

export default MessageOrchestratorService;
