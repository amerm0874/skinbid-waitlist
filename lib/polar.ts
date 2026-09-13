import { Polar } from "@polar-sh/sdk";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { FLOOR_CENTS, SITE } from "@/lib/config";
import { polarPaymentsEnabled } from "@/lib/polar-enabled";

export { polarPaymentsEnabled };

const BID_PRODUCT_NAME = "SkinBid zone bid";
const BID_PRODUCT_META = "bid";

let cachedProductId: string | null = null;

export function createPolarClient() {
  const accessToken = process.env.POLAR_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    return null;
  }
  return new Polar({
    accessToken,
    server: "sandbox",
  });
}

function metaString(
  metadata: Record<string, string | number | boolean> | undefined,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function resolveBidProductId(polar: Polar) {
  const fromEnv = process.env.POLAR_PRODUCT_ID?.trim();
  if (fromEnv) {
    cachedProductId = fromEnv;
    return fromEnv;
  }
  if (cachedProductId) {
    return cachedProductId;
  }

  const page = await polar.products.list({
    isArchived: false,
    isRecurring: false,
    limit: 50,
  });
  const existing = page.result.items.find(
    (product) =>
      product.metadata.skinbid === BID_PRODUCT_META ||
      product.name === BID_PRODUCT_NAME,
  );
  if (existing) {
    cachedProductId = existing.id;
    return existing.id;
  }

  const created = await polar.products.create({
    name: BID_PRODUCT_NAME,
    description: "Held bid for one event-day body zone.",
    recurringInterval: null,
    metadata: { skinbid: BID_PRODUCT_META },
    prices: [
      {
        amountType: "fixed",
        priceAmount: FLOOR_CENTS,
        priceCurrency: "usd",
      },
    ],
  });
  cachedProductId = created.id;
  return created.id;
}

export async function createBidCheckout(input: {
  polar: Polar;
  productId: string;
  amountCents: number;
  bidId: string;
  zoneId: string;
  brandId: string;
  slug: string;
  customerEmail?: string | null;
  customerName?: string | null;
  customerIp?: string | null;
}) {
  const eventUrl = `${SITE.url}/e/${input.slug}`;
  return input.polar.checkouts.create({
    products: [input.productId],
    prices: {
      [input.productId]: [
        {
          amountType: "fixed",
          priceAmount: input.amountCents,
          priceCurrency: "usd",
        },
      ],
    },
    metadata: {
      bid_id: input.bidId,
      zone_id: input.zoneId,
      brand_id: input.brandId,
      slug: input.slug,
    },
    externalCustomerId: input.brandId,
    customerEmail: input.customerEmail || undefined,
    customerName: input.customerName || undefined,
    customerIpAddress: input.customerIp || undefined,
    successUrl: `${eventUrl}?checkout_id={CHECKOUT_ID}`,
    returnUrl: eventUrl,
    allowDiscountCodes: false,
  });
}

export async function refundPolarOrder(orderId: string, amountCents: number) {
  const polar = createPolarClient();
  if (!polar) {
    console.log("Polar refund skipped — no access token", orderId);
    return { skipped: true as const };
  }
  let amount = amountCents;
  try {
    const order = await polar.orders.get({ id: orderId });
    amount = Math.max(1, order.totalAmount - order.refundedAmount);
  } catch (error) {
    console.log("Polar order lookup failed", orderId, error);
  }
  if (amount < 1) {
    return { skipped: true as const };
  }
  await polar.refunds.create({
    orderId,
    reason: "customer_request",
    amount,
    comment: "Outbid on SkinBid",
    revokeBenefits: true,
  });
  return { skipped: false as const };
}

export function parsePolarWebhook(rawBody: string, request: Request) {
  const secret = process.env.POLAR_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new WebhookVerificationError("POLAR_WEBHOOK_SECRET missing");
  }
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return validateEvent(rawBody, headers, secret);
}

export function bidIdFromMetadata(
  metadata: Record<string, string | number | boolean> | undefined,
) {
  return metaString(metadata, "bid_id");
}

export { WebhookVerificationError };
