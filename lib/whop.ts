import { WhopClient, WhopError } from "@whop/sdk";
import { unwrapWebhook, WebhookVerificationError } from "@whop/sdk/helpers";
import { loginPath, SITE } from "@/lib/config";
import { logoDeskPath } from "@/lib/logo";

const BID_PLAN_TITLE = "SkinBid zone bid";
const ATHLETE_MODEL_PLAN_TITLE = "SkinBid 3D model";
const SECRET_LIKE = /apik_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|ws_[A-Za-z0-9]+|Bearer\s+\S+/gi;

export const ATHLETE_MODEL_KIND = "athlete_model";
export const ATHLETE_MODEL_CENTS = 5000;

export function whopPaymentsEnabled() {
  return Boolean(process.env.WHOP_API_KEY?.trim());
}

// SANDBOX_ONLY — delete with the flag, host rewrite, and every SANDBOX_ONLY block.
const WHOP_SANDBOX_API_BASE = "https://sandbox-api.whop.com/api/v1";
// SANDBOX_ONLY
const WHOP_SANDBOX_CHECKOUT_HOST = "sandbox.whop.com";

// SANDBOX_ONLY — WHOP_SANDBOX=1 in local .env.local only. Missing/off = live.
export function isWhopSandbox() {
  return process.env.WHOP_SANDBOX?.trim() === "1";
}

export function createWhopClient() {
  const token = process.env.WHOP_API_KEY?.trim();
  if (!token) {
    return null;
  }
  // SANDBOX_ONLY
  if (isWhopSandbox()) {
    return new WhopClient({ token, baseUrl: WHOP_SANDBOX_API_BASE });
  }
  return new WhopClient({ token });
}

export function resolveWhopCompanyId() {
  return process.env.WHOP_COMPANY_ID?.trim() || null;
}

export function checkoutHost(url: string | null | undefined) {
  if (!url?.trim()) {
    return "missing";
  }
  try {
    return new URL(url).hostname;
  } catch {
    return "invalid";
  }
}

export function publicCheckoutUrl(purchaseUrl: string | null | undefined) {
  const raw = purchaseUrl?.trim() ?? "";
  if (!raw) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  // SANDBOX_ONLY — sandbox API still returns whop.com; send buyers to sandbox.whop.com.
  if (isWhopSandbox()) {
    const host = parsed.hostname.toLowerCase();
    if (host === WHOP_SANDBOX_CHECKOUT_HOST) {
      return parsed.toString();
    }
    if (host === "whop.com" || host.endsWith(".whop.com")) {
      parsed.protocol = "https:";
      parsed.hostname = WHOP_SANDBOX_CHECKOUT_HOST;
      return parsed.toString();
    }
    return null;
  }
  return parsed.toString();
}

function redactSecrets(text: string) {
  return text.replace(SECRET_LIKE, "[redacted]").trim();
}

function messageFromWhopBody(body: unknown): string | null {
  if (typeof body === "string" && body.trim()) {
    return body.trim();
  }
  if (!body || typeof body !== "object") {
    return null;
  }
  const row = body as {
    error?: { message?: unknown } | string;
    message?: unknown;
  };
  if (typeof row.error === "string" && row.error.trim()) {
    return row.error.trim();
  }
  if (
    row.error &&
    typeof row.error === "object" &&
    typeof row.error.message === "string" &&
    row.error.message.trim()
  ) {
    return row.error.message.trim();
  }
  if (typeof row.message === "string" && row.message.trim()) {
    return row.message.trim();
  }
  return null;
}

export function describeWhopError(error: unknown): {
  status: number | null;
  message: string;
} {
  if (error instanceof WhopError) {
    const fromBody = messageFromWhopBody(error.body);
    const fallback = error.message.split("\n")[0]?.trim() || "Whop request failed.";
    return {
      status: error.statusCode ?? null,
      message: redactSecrets(fromBody || fallback),
    };
  }
  if (error instanceof Error && error.message.trim()) {
    return {
      status: null,
      message: redactSecrets(error.message.split("\n")[0] ?? error.message),
    };
  }
  return { status: null, message: "Whop request failed." };
}

export function isMissingCaptureIdError(message: string) {
  const text = message.toLowerCase();
  return (
    text.includes("capture_id") &&
    (text.includes("missing") ||
      text.includes("required") ||
      text.includes("blank") ||
      text.includes("empty"))
  );
}

function prefixLabel(value: string, expected: string, name: string) {
  if (!value) {
    return `${name}=missing`;
  }
  return value.startsWith(expected) ? `${name}=${expected}` : `${name}=unexpected-prefix`;
}

// Prefixes and API host only. Never log apik_ / biz_ / ws_ values.
export function logWhopEnv() {
  const key = process.env.WHOP_API_KEY?.trim() ?? "";
  const company = process.env.WHOP_COMPANY_ID?.trim() ?? "";
  const webhook = process.env.WHOP_WEBHOOK_SECRET?.trim() ?? "";
  console.log(
    "Whop env",
    prefixLabel(key, "apik_", "WHOP_API_KEY"),
    prefixLabel(company, "biz_", "WHOP_COMPANY_ID"),
    prefixLabel(webhook, "ws_", "WHOP_WEBHOOK_SECRET"),
    // SANDBOX_ONLY
    isWhopSandbox() ? "WHOP_SANDBOX=1" : "WHOP_SANDBOX=off",
  );
}

function whopRedirectUrl(path: string) {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  const origin = SITE.url.replace(/\/$/, "");
  if (/localhost|127\.0\.0\.1/i.test(origin)) {
    return `https://www.skinbid.me${suffix}`;
  }
  if (/skinbid\.me$/i.test(origin.replace(/^https:\/\//i, "").split("/")[0] ?? "")) {
    return `https://www.skinbid.me${suffix}`;
  }
  if (/^https:\/\//i.test(origin)) {
    return `${origin}${suffix}`;
  }
  return `https://www.skinbid.me${suffix}`;
}

// SANDBOX_ONLY — Whop cannot return to localhost. Login on www, then logo desk.
function bidCheckoutReturnPath(slug: string, bidId: string) {
  const logo = logoDeskPath(slug, bidId);
  // SANDBOX_ONLY
  if (isWhopSandbox()) {
    return loginPath("brand", logo);
  }
  return logo;
}

function metaString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function bidIdFromMetadata(metadata: Record<string, unknown> | null | undefined) {
  return metaString(metadata, "bid_id");
}

export function kindFromMetadata(metadata: Record<string, unknown> | null | undefined) {
  return metaString(metadata, "kind");
}

export function captureIdFromMetadata(metadata: Record<string, unknown> | null | undefined) {
  return metaString(metadata, "capture_id");
}

export function athleteIdFromMetadata(metadata: Record<string, unknown> | null | undefined) {
  return metaString(metadata, "athlete_id");
}

export function isAthleteModelPayment(metadata: Record<string, unknown> | null | undefined) {
  if (kindFromMetadata(metadata) === ATHLETE_MODEL_KIND) {
    return true;
  }
  return Boolean(captureIdFromMetadata(metadata) && !bidIdFromMetadata(metadata));
}

export function athleteModelRedirectPath(returnTo: unknown, captureId: string) {
  const query = `capture_id=${encodeURIComponent(captureId)}`;
  const fallback = `/new?${query}`;
  if (typeof returnTo !== "string") {
    return fallback;
  }
  const path = returnTo.trim().split("?")[0];
  if (path === "/new" || /^\/a\/[a-z0-9._]{1,48}$/.test(path)) {
    return `${path}?${query}`;
  }
  return fallback;
}

const WHOP_CURRENCY = "usd" as const;

// Card/wallet buttons only. No crypto, bank transfer, or local-currency rails.
const USD_BUTTON_METHODS = {
  enabled: ["card", "apple_pay", "google_pay"],
  disabled: [] as string[],
  include_platform_defaults: false,
};

// Auction is USD. Adaptive/local currency (EGP, etc.) is off on every checkout.
function usdOneTimePlan(companyId: string, initialPrice: number, title: string) {
  return {
    account_id: companyId,
    plan_type: "one_time" as const,
    currency: WHOP_CURRENCY,
    initial_price: initialPrice,
    title,
    visibility: "hidden" as const,
    force_create_new_plan: true,
    adaptive_pricing_enabled: false,
    payment_method_configuration: USD_BUTTON_METHODS,
  };
}

function withPublicCheckoutUrl<T extends { purchase_url?: string | null }>(
  checkout: T,
): T {
  return {
    ...checkout,
    purchase_url: publicCheckoutUrl(checkout.purchase_url),
  };
}

export async function createAthleteModelCheckout(input: {
  whop: WhopClient;
  companyId: string;
  athleteId: string;
  captureId: string;
  redirectPath?: string;
}) {
  const captureId = input.captureId.trim();
  if (!captureId) {
    throw new Error("capture_id is missing");
  }
  const redirectPath =
    input.redirectPath ?? athleteModelRedirectPath("/new", captureId);
  const plan = usdOneTimePlan(
    input.companyId,
    ATHLETE_MODEL_CENTS / 100,
    ATHLETE_MODEL_PLAN_TITLE,
  );
  const checkout = await input.whop.checkoutConfigurations.create({
    account_id: input.companyId,
    currency: WHOP_CURRENCY,
    mode: "payment",
    plan,
    metadata: {
      kind: ATHLETE_MODEL_KIND,
      athlete_id: input.athleteId,
      capture_id: captureId,
    },
    redirect_url: whopRedirectUrl(redirectPath),
  });
  return withPublicCheckoutUrl(checkout);
}

export async function createBidCheckout(input: {
  whop: WhopClient;
  companyId: string;
  amountCents: number;
  bidId: string;
  zoneId: string;
  brandId: string;
  slug: string;
}) {
  const plan = usdOneTimePlan(
    input.companyId,
    input.amountCents / 100,
    BID_PLAN_TITLE,
  );
  const checkout = await input.whop.checkoutConfigurations.create({
    account_id: input.companyId,
    currency: WHOP_CURRENCY,
    mode: "payment",
    plan,
    metadata: {
      bid_id: input.bidId,
      zone_id: input.zoneId,
      brand_id: input.brandId,
      amount_cents: input.amountCents,
    },
    redirect_url: whopRedirectUrl(bidCheckoutReturnPath(input.slug, input.bidId)),
  });
  return withPublicCheckoutUrl(checkout);
}

// Always a full refund — SkinBid never issues partial refunds.
export async function refundWhopPayment(paymentId: string) {
  const whop = createWhopClient();
  if (!whop) {
    console.log("Whop refund skipped — no API key", paymentId);
    return { skipped: true as const };
  }
  await whop.payments.refund({ id: paymentId });
  return { skipped: false as const };
}

export function parseWhopWebhook(rawBody: string, request: Request) {
  const key = process.env.WHOP_WEBHOOK_SECRET?.trim();
  if (!key) {
    throw new WebhookVerificationError("WHOP_WEBHOOK_SECRET missing");
  }
  const headers: Record<string, string> = {};
  request.headers.forEach((value, name) => {
    headers[name] = value;
  });
  return unwrapWebhook<{
    type?: string;
    data?: {
      id?: string;
      metadata?: Record<string, unknown> | null;
      checkout_configuration_id?: string | null;
      total?: { amount: string } | null;
    };
  }>(rawBody, { headers, key });
}

export { WebhookVerificationError };
