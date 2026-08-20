// Thin wrapper over the QuickAuth WhatsApp API (https://api.quickauth.in/v1/whatsapp).
// Credentials come from env only (QUICKAUTH_CLIENT_ID / QUICKAUTH_CLIENT_SECRET) and are
// never sent to the frontend. Response shapes beyond what the docs explicitly show are
// parsed defensively (multiple possible wrapper keys) rather than assumed.

const BASE_URL = "https://api.quickauth.in/v1/whatsapp";
const REQUEST_TIMEOUT_MS = 20_000;

export class QuickAuthApiError extends Error {
  status: number;
  code?: string;
  /** Timeouts, network errors, 429, and 5xx are safe to retry. Everything else is permanent. */
  retryable: boolean;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "QuickAuthApiError";
    this.status = status;
    this.code = code;
    this.retryable = status === 0 || status === 429 || status >= 500;
  }
}

export function isQuickAuthConfigured(): boolean {
  return !!(process.env.QUICKAUTH_CLIENT_ID && process.env.QUICKAUTH_CLIENT_SECRET);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const clientId = process.env.QUICKAUTH_CLIENT_ID;
  const clientSecret = process.env.QUICKAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new QuickAuthApiError(
      401,
      "WhatsApp API credentials are not configured. Set QUICKAUTH_CLIENT_ID and QUICKAUTH_CLIENT_SECRET.",
      "NOT_CONFIGURED",
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        "X-Client-Id": clientId,
        "X-Client-Secret": clientSecret,
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new QuickAuthApiError(0, "Request to QuickAuth timed out", "TIMEOUT");
    }
    throw new QuickAuthApiError(0, err?.message || "Network error contacting QuickAuth", "NETWORK_ERROR");
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await res.text();
  let data: any = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const message = data?.error?.message || (typeof data === "string" ? data : undefined) || res.statusText;
    const code = data?.error?.code;
    throw new QuickAuthApiError(res.status, message, code);
  }

  return data as T;
}

/** Pulls a list out of a response whose exact wrapper key isn't guaranteed by the docs. */
function unwrapList(data: any, ...keys: string[]): any[] {
  if (Array.isArray(data)) return data;
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
}

function pickId(data: any): string {
  return data?.templateId ?? data?.id ?? data?.template_id ?? "";
}

export interface QuickAuthTemplateInput {
  name: string;
  language: string;
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  body: string;
  footer?: string;
  variables: { name: string; example?: string }[];
  headerType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  headerText?: string;
  headerMediaUrl?: string;
  buttons?: any[];
}

export interface QuickAuthTemplate {
  templateId: string;
  name: string;
  language: string;
  category: string;
  status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | string;
  body: string;
  footer?: string;
  variables: { name: string; example?: string }[];
  buttons?: any[];
  [key: string]: any;
}

export async function createTemplate(input: QuickAuthTemplateInput): Promise<QuickAuthTemplate> {
  const data = await request<any>("POST", "/templates", input);
  return { ...data, templateId: pickId(data) };
}

export async function listTemplates(): Promise<QuickAuthTemplate[]> {
  const data = await request<any>("GET", "/templates");
  return unwrapList(data, "templates", "data").map((t) => ({ ...t, templateId: pickId(t) }));
}

export async function getTemplate(templateId: string): Promise<QuickAuthTemplate> {
  const data = await request<any>("GET", `/templates/${encodeURIComponent(templateId)}`);
  return { ...data, templateId: pickId(data) || templateId };
}

export interface SendMessageResult {
  campaignId: string;
  status: string;
  [key: string]: any;
}

export async function sendTemplateMessage(params: {
  templateId: string;
  to: string;
  variables?: Record<string, string>;
}): Promise<SendMessageResult> {
  const data = await request<any>("POST", "/messages", params);
  return { ...data, campaignId: data?.campaignId ?? data?.id ?? "" };
}

export interface CampaignRecipient {
  phoneNumber: string;
  variables?: Record<string, string>;
}

/** QuickAuth caps a single call at 100 recipients; larger lists are paged automatically. */
export async function sendCampaign(params: {
  templateId: string;
  campaignName: string;
  recipients: CampaignRecipient[];
}): Promise<SendMessageResult[]> {
  const chunks: CampaignRecipient[][] = [];
  for (let i = 0; i < params.recipients.length; i += 100) {
    chunks.push(params.recipients.slice(i, i + 100));
  }
  const results: SendMessageResult[] = [];
  for (const chunk of chunks) {
    const data = await request<any>("POST", "/campaigns", {
      templateId: params.templateId,
      campaignName: params.campaignName,
      recipients: chunk,
    });
    results.push({ ...data, campaignId: data?.campaignId ?? data?.id ?? "" });
  }
  return results;
}

export async function sendSessionMessage(params: { to: string; text: string }): Promise<SendMessageResult> {
  const data = await request<any>("POST", "/messages/session", params);
  return { ...data, campaignId: data?.campaignId ?? data?.id ?? "" };
}

export interface QuickAuthHealth {
  [key: string]: any;
}

export async function getHealth(): Promise<QuickAuthHealth> {
  return request<QuickAuthHealth>("GET", "/health");
}
