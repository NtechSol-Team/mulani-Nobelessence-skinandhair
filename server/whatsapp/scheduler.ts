// Single in-process interval (same pattern as server/cron.ts) that: (1) scans
// for scheduled-timing triggers (appointment reminders, birthdays, missed
// follow-ups) and starts runs for anything newly eligible, then (2) processes
// due message jobs through the business-hours and frequency-cap gates before
// handing them to the worker.

import { storage } from "../storage";
import { processJob } from "./worker";
import { startRun } from "./engine";
import type { WhatsappSettings } from "@shared/schema";

const TICK_INTERVAL_MS = 60_000;
const MAX_JOBS_PER_TICK = 25;

function log(message: string) {
  const t = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
  console.log(`${t} [whatsapp-scheduler] ${message}`);
}

// ---- Business hours ----
// Business hours must be evaluated in the *clinic's* configured IANA timezone,
// not the server process's local timezone (which may well be UTC in
// production). Uses Intl.DateTimeFormat only - no new date/timezone library
// dependency required.

function partsInTimezone(date: Date, timezone: string): { year: number; month: number; day: number; hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month) - 1,
    day: Number(parts.day),
    hour: Number(parts.hour) % 24, // some ICU implementations report midnight as "24"
    minute: Number(parts.minute),
  };
}

/** Inverse of partsInTimezone: the UTC instant at which the given timezone reads this wall-clock time. */
function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timezone: string): Date {
  let guess = new Date(Date.UTC(year, month, day, hour, minute, 0, 0));
  // Two passes converge even across DST transitions; fixed-offset zones (e.g. Asia/Kolkata) converge in one.
  for (let i = 0; i < 2; i++) {
    const got = partsInTimezone(guess, timezone);
    let diffMinutes = (hour * 60 + minute) - (got.hour * 60 + got.minute);
    if (diffMinutes > 12 * 60) diffMinutes -= 24 * 60;
    if (diffMinutes < -12 * 60) diffMinutes += 24 * 60;
    if (diffMinutes === 0) break;
    guess = new Date(guess.getTime() + diffMinutes * 60_000);
  }
  return guess;
}

function isWithinBusinessHours(now: Date, settings: WhatsappSettings): boolean {
  if (!settings.businessHoursEnabled) return true;
  const { hour, minute } = partsInTimezone(now, settings.timezone);
  const [startH, startM] = settings.businessHoursStart.split(":").map(Number);
  const [endH, endM] = settings.businessHoursEnd.split(":").map(Number);
  const minutesNow = hour * 60 + minute;
  return minutesNow >= (startH * 60 + startM) && minutesNow < (endH * 60 + endM);
}

function nextBusinessWindowStart(now: Date, settings: WhatsappSettings): Date {
  const [startH, startM] = settings.businessHoursStart.split(":").map(Number);
  const today = partsInTimezone(now, settings.timezone);
  let candidate = zonedTimeToUtc(today.year, today.month, today.day, startH || 9, startM || 0, settings.timezone);
  if (candidate.getTime() <= now.getTime()) {
    candidate = zonedTimeToUtc(today.year, today.month, today.day + 1, startH || 9, startM || 0, settings.timezone);
  }
  return candidate;
}

// ---- Due job processing (with business-hours + frequency-cap gates) ----

async function processDueJobs(settings: WhatsappSettings): Promise<void> {
  const jobs = await storage.getDueWhatsappJobs(MAX_JOBS_PER_TICK);
  for (const job of jobs) {
    const rule = job.ruleId ? await storage.getWhatsappRuleDetail(job.ruleId) : undefined;
    const businessHoursOnly = rule?.businessHoursOnly ?? true;

    if (businessHoursOnly && !isWithinBusinessHours(new Date(), settings)) {
      await storage.rescheduleWhatsappJob(job.id, nextBusinessWindowStart(new Date(), settings));
      continue;
    }

    const perContactCap = rule?.maxPerContactPerDay && rule.maxPerContactPerDay > 0 ? rule.maxPerContactPerDay : settings.maxPerContactPerDay;
    if (perContactCap > 0) {
      const sentToday = await storage.countWhatsappMessagesToday(job.phone);
      if (sentToday >= perContactCap) {
        await storage.rescheduleWhatsappJob(job.id, new Date(Date.now() + 60 * 60_000));
        continue;
      }
    }

    if (settings.minGapMinutes > 0) {
      const lastSent = await storage.getLastSentWhatsappMessage(job.phone);
      if (lastSent?.sentAt) {
        const elapsedMinutes = (Date.now() - new Date(lastSent.sentAt).getTime()) / 60_000;
        if (elapsedMinutes < settings.minGapMinutes) {
          await storage.rescheduleWhatsappJob(job.id, new Date(Date.now() + (settings.minGapMinutes - elapsedMinutes) * 60_000));
          continue;
        }
      }
    }

    await processJob(job);
  }
}

// ---- Scheduled-timing trigger scans ----

function unitMsLocal(unit: string): number {
  if (unit === "minutes") return 60_000;
  if (unit === "days") return 86_400_000;
  return 3_600_000;
}

function parseAppointmentDateTime(date: string, time: string): Date | undefined {
  if (!date) return undefined;
  const d = new Date(`${date}T${time || "09:00"}:00`);
  return isNaN(d.getTime()) ? undefined : d;
}

async function scanAppointmentReminders(): Promise<void> {
  const rules = await storage.getActiveWhatsappRulesByTrigger("appointment_reminder");
  if (rules.length === 0) return;
  const appointments = await storage.getAppointments();
  const now = Date.now();

  for (const appt of appointments) {
    if (appt.status !== "Scheduled") continue;
    const apptDateTime = parseAppointmentDateTime(appt.date, appt.time);
    if (!apptDateTime || apptDateTime.getTime() <= now) continue;

    for (const rule of rules) {
      const step0 = rule.steps[0];
      if (!step0) continue;
      // For this trigger, step 0's delay represents "how long before the
      // appointment" rather than "how long after the trigger fired".
      const leadMs = step0.delayValue * unitMsLocal(step0.delayUnit);
      if (now >= apptDateTime.getTime() - leadMs) {
        await startRun(rule, "appointment", appt.id, "appointment_reminder");
      }
    }
  }
}

async function scanPatientBirthdays(): Promise<void> {
  const rules = await storage.getActiveWhatsappRulesByTrigger("patient_birthday");
  if (rules.length === 0) return;
  const patients = await storage.getPatients();
  const today = new Date();
  const todayKey = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  for (const patient of patients) {
    if (!patient.dob) continue;
    const dob = new Date(patient.dob);
    if (isNaN(dob.getTime())) continue;
    const dobKey = `${String(dob.getMonth() + 1).padStart(2, "0")}-${String(dob.getDate()).padStart(2, "0")}`;
    if (dobKey !== todayKey) continue;

    for (const rule of rules) {
      await startRun(rule, "patient", patient.id, `patient_birthday:${today.getFullYear()}`);
    }
  }
}

async function scanLeadFollowUpMissed(): Promise<void> {
  const rules = await storage.getActiveWhatsappRulesByTrigger("lead_follow_up_missed");
  if (rules.length === 0) return;
  const leads = await storage.getLeads();
  const now = Date.now();

  for (const rule of rules) {
    const thresholdDays = Number(rule.triggerConfig?.thresholdDays) || 2;
    const thresholdMs = thresholdDays * 86_400_000;

    for (const lead of leads) {
      if (lead.status === "Converted" || lead.status === "Lost") continue;
      const created = new Date(lead.createdAt);
      if (isNaN(created.getTime()) || now - created.getTime() < thresholdMs) continue;

      const interactions = await storage.getInteractions(undefined, lead.id);
      if (interactions.length > 0) continue; // already followed up manually

      await startRun(rule, "lead", lead.id, "lead_follow_up_missed");
    }
  }
}

async function tick(): Promise<void> {
  let settings: WhatsappSettings;
  try {
    settings = await storage.getWhatsappSettings();
  } catch (err) {
    log(`Failed to load settings: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }
  if (!settings.enabled) return;

  try {
    await scanAppointmentReminders();
    await scanPatientBirthdays();
    await scanLeadFollowUpMissed();
  } catch (err) {
    log(`Scheduled-trigger scan failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    await processDueJobs(settings);
  } catch (err) {
    log(`Due-job processing failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function startWhatsappScheduler(): void {
  log(`Starting WhatsApp automation scheduler (tick every ${TICK_INTERVAL_MS / 1000}s)`);
  tick();
  const intervalId = setInterval(tick, TICK_INTERVAL_MS);
  intervalId.unref();
}
