// Sends a single due message job. Business-hours gating and frequency capping
// happen upstream in scheduler.ts (a job only reaches here once it's actually
// allowed to go out); this module owns the final stop-condition recheck, the
// template-vs-session decision, the provider call, and retry/backoff.

import { storage } from "../storage";
import * as quickauth from "./quickauthClient";
import { QuickAuthApiError } from "./quickauthClient";
import { advanceRunAfterSend, isRunStillEligible } from "./engine";
import type { WhatsappMessageJob } from "@shared/schema";

// Capped backoff (minutes) - transient failures (timeout/429/5xx) only.
const RETRY_BACKOFF_MINUTES = [2, 10, 30, 60];

export async function processJob(job: WhatsappMessageJob): Promise<void> {
  const run = await storage.getWhatsappRun(job.runId);
  if (!run) {
    await storage.markWhatsappJobResult(job.id, { status: "cancelled", lastError: "Run no longer exists" });
    return;
  }
  const rule = await storage.getWhatsappRuleDetail(job.ruleId);
  if (!rule) {
    await storage.markWhatsappJobResult(job.id, { status: "cancelled", lastError: "Rule no longer exists" });
    return;
  }

  if (run.status !== "active") {
    await storage.markWhatsappJobResult(job.id, { status: "skipped", lastError: `Automation run is ${run.status}` });
    return;
  }

  // Final compliance gate: re-verify stop conditions right before the send,
  // even though they were already checked when this job was queued (spec
  // section 10: a reply/booking/opt-out that happens while queued must win).
  if (!(await isRunStillEligible(run, rule))) {
    await storage.markWhatsappJobResult(job.id, { status: "skipped", lastError: "Stop condition met before send" });
    return;
  }

  const attemptNumber = job.attempts + 1;
  if (attemptNumber > job.maxAttempts) {
    await storage.markWhatsappJobResult(job.id, { status: "failed", lastError: "Max retry attempts reached" });
    await advanceRunAfterSend(job.runId);
    return;
  }

  await storage.markWhatsappJobSending(job.id);

  const useSession = job.messageType === "auto" && (await storage.isConversationWindowOpen(job.phone));

  try {
    if (useSession) {
      const text = job.renderedPreview || "(automation message)";
      const result = await quickauth.sendSessionMessage({ to: job.phone, text });
      await storage.markWhatsappJobResult(job.id, { status: "sent", campaignId: result.campaignId, sentAt: new Date() });
    } else {
      const result = await quickauth.sendTemplateMessage({
        templateId: job.templateId,
        to: job.phone,
        variables: job.variables,
      });
      await storage.markWhatsappJobResult(job.id, { status: "sent", campaignId: result.campaignId, sentAt: new Date() });
    }
    await storage.recordOutboundMessage(job.phone);
    await advanceRunAfterSend(job.runId);
  } catch (err) {
    const apiErr = err instanceof QuickAuthApiError ? err : undefined;
    const retryable = apiErr ? apiErr.retryable : true;
    const message = apiErr?.message || (err instanceof Error ? err.message : String(err));

    if (retryable && attemptNumber < job.maxAttempts) {
      const backoffMinutes = RETRY_BACKOFF_MINUTES[Math.min(attemptNumber - 1, RETRY_BACKOFF_MINUTES.length - 1)];
      await storage.rescheduleWhatsappJob(job.id, new Date(Date.now() + backoffMinutes * 60_000), "queued");
      await storage.markWhatsappJobResult(job.id, { status: "queued", lastError: message });
    } else {
      // Permanent failure (bad template/number/opt-out/credits) or retries
      // exhausted - do not retry blindly, and move the sequence forward
      // rather than leaving the run stuck.
      await storage.markWhatsappJobResult(job.id, { status: "failed", lastError: message });
      await advanceRunAfterSend(job.runId);
    }
  }
}
