// Receives QuickAuth delivery/reply webhook calls. IMPORTANT: the QuickAuth
// docs we have describe *that* delivery/reply webhooks exist but do not
// publish an exact payload shape or signature scheme. Every payload is
// stored raw in whatsapp_webhook_events first (nothing is ever lost), then
// this best-effort adapter tries a handful of common field names to update
// message status / conversation windows / reply-based stop conditions.
//
// TODO once the webhook URL is configured in the QuickAuth dashboard and we
// can see one real payload: replace the field-name guessing below with the
// exact shape, and add signature verification if QuickAuth provides one
// (header name + secret) - see whatsapp_settings.webhook_secret.

import { storage } from "../storage";
import { normalizePhone } from "./engine";

function pick(obj: any, ...keys: string[]): any {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return undefined;
}

async function processEvent(evt: any): Promise<void> {
  const type = String(pick(evt, "type", "event", "eventType") || "").toLowerCase();
  const status = String(pick(evt, "status") || "").toLowerCase();
  const messageId = pick(evt, "messageId", "campaignId", "id");
  const from = pick(evt, "from", "phone", "sender");
  const text = pick(evt, "text", "message", "body");

  if (messageId) {
    if (status === "delivered" || type.includes("deliver")) {
      await storage.updateWhatsappJobStatusByProviderMessageId(String(messageId), "delivered", "delivered_at");
    } else if (status === "read" || type.includes("read")) {
      await storage.updateWhatsappJobStatusByProviderMessageId(String(messageId), "read", "read_at");
    } else if (status === "failed" || type.includes("fail")) {
      const reason = pick(evt, "error", "reason", "failureReason");
      await storage.setWhatsappJobStatusByProviderMessageId(String(messageId), "failed", reason ? String(reason) : undefined);
    } else if (status === "sent" || type.includes("sent")) {
      await storage.setWhatsappJobStatusByProviderMessageId(String(messageId), "sent");
    }
  }

  // Inbound customer reply: (re)opens the 24h window and can satisfy the
  // "Lead Replies" stop condition on the next eligibility check.
  if (from && (type.includes("inbound") || type.includes("reply") || text !== undefined)) {
    const phone = normalizePhone(String(from));
    if (phone) await storage.recordInboundMessage(phone);
  }
}

export async function handleWhatsappWebhook(payload: any): Promise<void> {
  const eventId = await storage.storeWhatsappWebhookEvent(payload);
  try {
    const events: any[] = Array.isArray(payload?.events)
      ? payload.events
      : Array.isArray(payload)
        ? payload
        : [payload];
    for (const evt of events) {
      await processEvent(evt);
    }
    await storage.markWhatsappWebhookProcessed(eventId, "ok");
  } catch (err) {
    await storage.markWhatsappWebhookProcessed(eventId, `error: ${err instanceof Error ? err.message : String(err)}`);
  }
}
