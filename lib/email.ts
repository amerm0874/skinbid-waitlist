import { Resend } from "resend";
import { adminEmails } from "@/lib/auth";
import { SITE } from "@/lib/config";
import { centsToUsd } from "@/lib/money";
import {
  insertNotification,
  isNoticeHref,
  noticeCta,
  type NoticeKind,
  type NoticeRecord,
} from "@/lib/notifications";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isZoneName, ZONE_LABEL } from "@/lib/zones";

export type EmailEventType =
  | NoticeKind
  | "proof_submitted"
  | "outreach";

type Mail = {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
};

const claimedInProcess = new Set<string>();

export const RESEND_FROM_DEFAULT = "SkinBid <notify@skinbid.me>";
export const RESEND_REPLY_TO = SITE.email;

export function resendFrom() {
  return process.env.RESEND_FROM?.trim() || RESEND_FROM_DEFAULT;
}

export function createResend() {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    return null;
  }
  return new Resend(key);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function zoneLabel(name: string) {
  return isZoneName(name) ? ZONE_LABEL[name] : name;
}

function mailOrigin() {
  const origin = SITE.url.replace(/\/$/, "");
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return "https://www.skinbid.me";
  }
  return origin;
}

function productUrl(path: string) {
  return `${mailOrigin()}${path}`;
}

function eventPath(slug: string) {
  return `/e/${slug}`;
}

function logoDeskPath(slug: string) {
  return `/e/${slug}/logo`;
}

function zoneNoticeEntity(slug: string, zoneName: string) {
  return `${slug}:${zoneLabel(zoneName).toLowerCase()}`;
}

function proofPath(eventId: string) {
  return `/proof/${eventId}`;
}

function isUnverifiedDomainError(message: string) {
  const text = message.toLowerCase();
  return (
    text.includes("not verified") ||
    text.includes("unverified domain") ||
    text.includes("domain is not verified")
  );
}

function fromAddresses() {
  const fallback = process.env.RESEND_FROM?.trim();
  const froms = [RESEND_FROM_DEFAULT];
  if (fallback && fallback !== RESEND_FROM_DEFAULT) {
    froms.push(fallback);
  }
  return froms;
}

function buttonMail(lines: string[], path: string, cta: string) {
  const href = productUrl(path);
  const text = [...lines, `${cta}: ${href}`].join("\n\n");
  const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:24px;background:#0b0b0c;color:#f2f2f0;font-family:Arial,Helvetica,sans-serif;">
${lines
  .map(
    (line) =>
      `<p style="margin:0 0 12px;font-size:16px;line-height:1.4;">${escapeHtml(line)}</p>`,
  )
  .join("\n")}
  <p style="margin:24px 0 0;">
    <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 20px;background:#c8f24e;color:#0b0b0c;text-decoration:none;font-weight:700;border-radius:4px;">${escapeHtml(cta)}</a>
  </p>
</body>
</html>`;
  return { text, html };
}

function mailContent(lines: string[], href?: string) {
  const text = [...lines, href].filter(Boolean).join("\n\n");
  const html = `<!DOCTYPE html>
<html lang="en">
<body>
${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("\n")}
${href ? `<p><a href="${escapeHtml(href)}">${escapeHtml(href)}</a></p>` : ""}
</body>
</html>`;
  return { text, html };
}

function recipientsOf(to: string | string[]) {
  return (Array.isArray(to) ? to : [to])
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function claimKey(eventType: EmailEventType, entityId: string) {
  return `${eventType}:${entityId}`;
}

async function claimSend(eventType: EmailEventType, entityId: string) {
  const key = claimKey(eventType, entityId);
  if (claimedInProcess.has(key)) {
    return false;
  }
  claimedInProcess.add(key);

  const admin = createAdminSupabase();
  if (!admin) {
    return true;
  }

  const { error } = await admin.from("email_sends").insert({
    event_type: eventType,
    entity_id: entityId,
  });
  if (!error) {
    return true;
  }
  if (error.code === "23505") {
    return false;
  }
  console.log("email_sends insert failed", error.message);
  return true;
}

async function releaseSend(eventType: EmailEventType, entityId: string) {
  claimedInProcess.delete(claimKey(eventType, entityId));
  const admin = createAdminSupabase();
  if (!admin) {
    return;
  }
  await admin
    .from("email_sends")
    .delete()
    .eq("event_type", eventType)
    .eq("entity_id", entityId);
}

async function userEmail(userId: string) {
  const admin = createAdminSupabase();
  if (!admin) {
    return null;
  }
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) {
    console.log("Auth email lookup failed", userId, error.message);
    return null;
  }
  return data.user?.email?.trim() || null;
}

async function deliver(mail: Mail, idempotencyKey: string) {
  const resend = createResend();
  if (!resend) {
    return { skipped: true as const };
  }
  const to = recipientsOf(mail.to);
  if (!to.length) {
    console.log("Email skipped — no recipient", idempotencyKey);
    return { skipped: true as const };
  }

  const froms = fromAddresses();
  for (const [index, from] of froms.entries()) {
    const key =
      index === 0
        ? idempotencyKey.slice(0, 256)
        : `${idempotencyKey}:from`.slice(0, 256);
    const { error } = await resend.emails.send(
      {
        from,
        to,
        replyTo: RESEND_REPLY_TO,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      },
      { idempotencyKey: key },
    );
    if (!error) {
      console.log("Email sent", idempotencyKey, to.join(","));
      return { skipped: false as const };
    }
    const last = index === froms.length - 1;
    if (!last && isUnverifiedDomainError(error.message)) {
      console.log(
        "Email domain unverified — using RESEND_FROM",
        idempotencyKey,
        error.message,
      );
      continue;
    }
    console.log("Email failed", idempotencyKey, error.message);
    return { skipped: false as const, error: error.message };
  }

  return { skipped: false as const, error: "Email did not send." };
}

/** Sends via Resend, or logs when RESEND_API_KEY is missing. Never throws. */
export async function sendEmail(
  eventType: EmailEventType,
  entityId: string,
  mail: Mail | Mail[],
) {
  const messages = (Array.isArray(mail) ? mail : [mail]).filter(
    (item) => recipientsOf(item.to).length > 0,
  );
  if (!messages.length) {
    console.log("Email skipped — no recipient", eventType, entityId);
    return { skipped: true as const };
  }

  const resend = createResend();
  if (!resend) {
    console.log(
      "Email skipped — no RESEND_API_KEY",
      eventType,
      entityId,
      messages.map((item) => item.subject).join(" | "),
    );
    return { skipped: true as const };
  }

  try {
    const claimed = await claimSend(eventType, entityId);
    if (!claimed) {
      console.log("Email skipped — already sent", eventType, entityId);
      return { skipped: true as const };
    }

    let failed = false;
    for (const [index, item] of messages.entries()) {
      const result = await deliver(item, `${eventType}:${entityId}:${index}`);
      if (result.error) {
        failed = true;
      }
    }
    if (failed) {
      await releaseSend(eventType, entityId);
      return { skipped: false as const, error: "Email did not send." };
    }
    return { skipped: false as const };
  } catch (error) {
    console.log("Email threw", eventType, entityId, error);
    await releaseSend(eventType, entityId);
    return { skipped: false as const, error: "Email did not send." };
  }
}

async function sendNoticeEmail(row: NoticeRecord) {
  if (!isNoticeHref(row.href) || /whop\.com/i.test(row.href)) {
    console.log("Email skipped — bad href", row.kind, row.href);
    return;
  }
  const to = await userEmail(row.user_id);
  if (!to) {
    console.log("Email skipped — no email", row.kind, row.id);
    return;
  }
  const lines = row.body.trim() ? [row.body.trim()] : [row.title];
  await sendEmail(row.kind, row.id, {
    to,
    subject: row.title,
    ...buttonMail(lines, row.href, noticeCta(row.href)),
  });
}

async function notifyUser(input: {
  userId: string;
  kind: NoticeKind;
  title: string;
  body: string;
  href: string;
  entityId: string;
}) {
  try {
    const inserted = await insertNotification(input);
    const row =
      inserted.row ??
      ({
        id: `${input.kind}:${input.entityId}`,
        user_id: input.userId,
        kind: input.kind,
        title: input.title,
        body: input.body,
        href: input.href,
        entity_id: input.entityId,
      } satisfies NoticeRecord);
    await sendNoticeEmail(row);
  } catch (error) {
    console.log("notifyUser threw", input.kind, input.entityId, error);
  }
}

export async function notifyHeldBid(input: {
  bidId: string;
  athleteId: string;
  currentBrandId: string;
  zoneName: string;
  amountCents: number;
  eventSlug: string;
  previousBid?: { id: string; brandId: string } | null;
}) {
  const zone = zoneLabel(input.zoneName);
  const amount = centsToUsd(input.amountCents);
  const href = eventPath(input.eventSlug);

  await notifyUser({
    userId: input.athleteId,
    kind: "bid_held",
    title: `Held · ${zone}`,
    body: `${amount} held on ${zone}.`,
    href,
    entityId: zoneNoticeEntity(input.eventSlug, input.zoneName),
  });
  await notifyUser({
    userId: input.currentBrandId,
    kind: "bid_held_brand",
    title: `Held · ${zone}`,
    body: `Your ${amount} bid is held on ${zone}. Upload the PNG now.`,
    href: logoDeskPath(input.eventSlug),
    entityId: zoneNoticeEntity(input.eventSlug, input.zoneName),
  });

  if (input.previousBid && input.previousBid.brandId !== input.currentBrandId) {
    await notifyOutbid({
      previousBidId: input.previousBid.id,
      brandId: input.previousBid.brandId,
      zoneName: input.zoneName,
      newAmountCents: input.amountCents,
      eventSlug: input.eventSlug,
    });
  }
}

export async function notifyOutbid(input: {
  previousBidId: string;
  brandId: string;
  zoneName: string;
  newAmountCents: number;
  eventSlug: string;
}) {
  const zone = zoneLabel(input.zoneName);
  const amount = centsToUsd(input.newAmountCents);
  await notifyUser({
    userId: input.brandId,
    kind: "outbid",
    title: `Outbid · ${zone}`,
    body: `You were outbid on ${zone}. Held now: ${amount}. Refunded. That PNG will not print.`,
    href: eventPath(input.eventSlug),
    entityId: zoneNoticeEntity(input.eventSlug, input.zoneName),
  });
}

export async function notifyAuctionWon(input: {
  bidId: string;
  athleteId: string;
  brandId: string;
  zoneName: string;
  amountCents: number;
  eventSlug: string;
}) {
  const zone = zoneLabel(input.zoneName);
  const amount = centsToUsd(input.amountCents);
  const href = eventPath(input.eventSlug);
  await notifyUser({
    userId: input.athleteId,
    kind: "auction_won_athlete",
    title: `Won · ${zone}`,
    body: `${zone} closed at ${amount}. Print the mark.`,
    href,
    entityId: input.bidId,
  });
  await notifyUser({
    userId: input.brandId,
    kind: "auction_won_brand",
    title: `Won · ${zone}`,
    body: `Your ${amount} bid won ${zone}. Open the logo desk. Upload a transparent PNG. No chat.`,
    href: logoDeskPath(input.eventSlug),
    entityId: input.bidId,
  });
}

export async function notifyAuctionClosed(input: {
  bidId: string;
  athleteId: string;
  brandId: string;
  zoneName: string;
  amountCents: number;
  eventSlug: string;
  eventName: string;
}) {
  await notifyAuctionWon(input);
}

export async function notifyRefundDone(input: {
  bidId: string;
  brandId: string;
  zoneName: string;
  amountCents: number;
  eventSlug: string;
}) {
  const zone = zoneLabel(input.zoneName);
  const amount = centsToUsd(input.amountCents);
  await notifyUser({
    userId: input.brandId,
    kind: "refund_done",
    title: `Refunded · ${zone}`,
    body: `Your ${amount} bid on ${zone} was refunded. That PNG will not print.`,
    href: eventPath(input.eventSlug),
    entityId: zoneNoticeEntity(input.eventSlug, input.zoneName),
  });
}

export async function notifyProofDue(input: {
  eventId: string;
  athleteId: string;
  eventName: string;
}) {
  await notifyUser({
    userId: input.athleteId,
    kind: "proof_due",
    title: "Proof due",
    body: `Wear the mark. Upload proof for ${input.eventName}.`,
    href: proofPath(input.eventId),
    entityId: input.eventId,
  });
}

export async function sendProofDueReminders(now = new Date()) {
  const admin = createAdminSupabase();
  if (!admin) {
    console.log("Proof due skipped — no service role key");
    return { sent: 0, error: "No service role key" as const };
  }

  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const { data: events, error } = await admin
    .from("events")
    .select("id, name, athlete_id")
    .eq("status", "closed")
    .gte("date", dayStart.toISOString())
    .lte("date", dayEnd.toISOString());

  if (error) {
    console.log("Proof due query failed", error.message);
    return { sent: 0, error: error.message };
  }

  let sent = 0;
  for (const event of events ?? []) {
    const { data: zones } = await admin
      .from("zones")
      .select("id")
      .eq("event_id", event.id);
    const zoneIds = (zones ?? []).map((zone) => zone.id);
    if (!zoneIds.length) {
      continue;
    }
    const { data: won } = await admin
      .from("bids")
      .select("id")
      .in("zone_id", zoneIds)
      .eq("status", "won")
      .limit(1);
    if (!won?.length) {
      continue;
    }
    const { data: proof } = await admin
      .from("proofs")
      .select("id")
      .eq("event_id", event.id)
      .limit(1)
      .maybeSingle();
    if (proof) {
      continue;
    }
    await notifyProofDue({
      eventId: event.id,
      athleteId: event.athlete_id,
      eventName: event.name,
    });
    sent += 1;
  }

  console.log("Proof due job", { sent, events: events?.length ?? 0 });
  return { sent };
}

export async function notifyProofSubmitted(input: {
  proofId: string;
  eventName: string;
  athleteName?: string | null;
}) {
  try {
    const to = adminEmails();
    const who = input.athleteName?.trim() || "An athlete";
    await sendEmail("proof_submitted", input.proofId, {
      to,
      subject: `Proof submitted — ${input.eventName}`,
      ...mailContent(
        [`${who} submitted proof for ${input.eventName}.`],
        productUrl("/admin"),
      ),
    });
  } catch (error) {
    console.log("notifyProofSubmitted threw", error);
  }
}

export async function notifyProofReviewed(input: {
  proofId: string;
  athleteId: string;
  eventId: string;
  eventName: string;
  eventSlug?: string;
  approved: boolean;
}) {
  const href =
    input.approved && input.eventSlug
      ? eventPath(input.eventSlug)
      : proofPath(input.eventId);
  await notifyUser({
    userId: input.athleteId,
    kind: input.approved ? "proof_approved" : "proof_rejected",
    title: input.approved ? "Proof approved" : "Proof rejected",
    body: input.approved
      ? `Proof approved for ${input.eventName}.`
      : `Proof rejected for ${input.eventName}. No payout.`,
    href,
    entityId: input.proofId,
  });
}
