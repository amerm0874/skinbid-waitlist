import { Resend } from "resend";
import { adminEmails } from "@/lib/auth";
import { SITE } from "@/lib/config";
import { centsToUsd } from "@/lib/money";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isZoneName, ZONE_LABEL } from "@/lib/zones";

export type EmailEventType =
  | "bid_placed"
  | "bid_outbid"
  | "auction_closed"
  | "event_morning"
  | "proof_submitted"
  | "proof_approved"
  | "proof_rejected"
  | "outreach";

type Mail = {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
};

const claimedInProcess = new Set<string>();

export function resendFrom() {
  return process.env.RESEND_FROM?.trim() || `SkinBid <${SITE.email}>`;
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

function eventUrl(slug: string) {
  return `${SITE.url}/e/${slug}`;
}

function proofUrl(eventId: string) {
  return `${SITE.url}/proof/${eventId}`;
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
  const { error } = await resend.emails.send(
    {
      from: resendFrom(),
      to,
      replyTo: SITE.email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    },
    { idempotencyKey: idempotencyKey.slice(0, 256) },
  );
  if (error) {
    console.log("Email failed", idempotencyKey, error.message);
    return { skipped: false as const, error: error.message };
  }
  console.log("Email sent", idempotencyKey, to.join(","));
  return { skipped: false as const };
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

export async function notifyBidPlaced(input: {
  bidId: string;
  athleteId: string;
  zoneName: string;
  amountCents: number;
  eventSlug: string;
}) {
  try {
    const to = await userEmail(input.athleteId);
    const zone = zoneLabel(input.zoneName);
    const amount = centsToUsd(input.amountCents);
    const href = eventUrl(input.eventSlug);
    const copy = mailContent(
      [`A brand placed a bid on ${zone}.`, `Amount: ${amount}`],
      href,
    );
    await sendEmail("bid_placed", input.bidId, {
      to: to ?? "",
      subject: `Bid on ${zone}`,
      ...copy,
    });
  } catch (error) {
    console.log("notifyBidPlaced threw", error);
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
  await notifyBidPlaced({
    bidId: input.bidId,
    athleteId: input.athleteId,
    zoneName: input.zoneName,
    amountCents: input.amountCents,
    eventSlug: input.eventSlug,
  });
  if (input.previousBid && input.previousBid.brandId !== input.currentBrandId) {
    await notifyOutbid({
      previousBidId: input.previousBid.id,
      brandId: input.previousBid.brandId,
      zoneName: input.zoneName,
      newAmountCents: input.amountCents,
    });
  }
}

export async function notifyOutbid(input: {
  previousBidId: string;
  brandId: string;
  zoneName: string;
  newAmountCents: number;
}) {
  try {
    const to = await userEmail(input.brandId);
    const zone = zoneLabel(input.zoneName);
    const amount = centsToUsd(input.newAmountCents);
    const copy = mailContent([
      `You were outbid on ${zone}.`,
      `The new bid is ${amount}.`,
    ]);
    await sendEmail("bid_outbid", input.previousBidId, {
      to: to ?? "",
      subject: `Outbid on ${zone}`,
      ...copy,
    });
  } catch (error) {
    console.log("notifyOutbid threw", error);
  }
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
  try {
    const [athleteTo, brandTo] = await Promise.all([
      userEmail(input.athleteId),
      userEmail(input.brandId),
    ]);
    const zone = zoneLabel(input.zoneName);
    const amount = centsToUsd(input.amountCents);
    const href = eventUrl(input.eventSlug);
    const messages: Mail[] = [];

    if (athleteTo) {
      messages.push({
        to: athleteTo,
        subject: `Auction closed — ${zone}`,
        ...mailContent(
          [
            "Auction closed. Print the mark.",
            `${input.eventName}: ${zone} closed at ${amount}.`,
          ],
          href,
        ),
      });
    }
    if (brandTo) {
      messages.push({
        to: brandTo,
        subject: `You won ${zone}`,
        ...mailContent(
          [
            `Your ${amount} bid won ${zone} on ${input.eventName}.`,
            "The athlete wears your logo on event day.",
          ],
          href,
        ),
      });
    }

    await sendEmail("auction_closed", input.bidId, messages);
  } catch (error) {
    console.log("notifyAuctionClosed threw", error);
  }
}

export async function notifyEventMorning(input: {
  eventId: string;
  athleteId: string;
  eventName: string;
}) {
  try {
    const to = await userEmail(input.athleteId);
    const href = proofUrl(input.eventId);
    await sendEmail("event_morning", input.eventId, {
      to: to ?? "",
      subject: `Wear it — ${input.eventName}`,
      ...mailContent(
        ["Wear it, then upload proof.", input.eventName],
        href,
      ),
    });
  } catch (error) {
    console.log("notifyEventMorning threw", error);
  }
}

/**
 * Event-morning athlete mail. Call from cron later
 * (GET/POST /api/cron/event-morning with CRON_SECRET).
 * Not scheduled yet. Close mail already fires from settleEvent
 * — the same path that flips held bids to won.
 */
export async function sendEventMorningReminders(now = new Date()) {
  const admin = createAdminSupabase();
  if (!admin) {
    console.log("Event morning skipped — no service role key");
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
    console.log("Event morning query failed", error.message);
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
    await notifyEventMorning({
      eventId: event.id,
      athleteId: event.athlete_id,
      eventName: event.name,
    });
    sent += 1;
  }

  console.log("Event morning job", { sent, events: events?.length ?? 0 });
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
    const href = `${SITE.url}/admin`;
    await sendEmail("proof_submitted", input.proofId, {
      to,
      subject: `Proof submitted — ${input.eventName}`,
      ...mailContent(
        [`${who} submitted proof for ${input.eventName}.`],
        href,
      ),
    });
  } catch (error) {
    console.log("notifyProofSubmitted threw", error);
  }
}

export async function notifyProofReviewed(input: {
  proofId: string;
  athleteId: string;
  eventName: string;
  approved: boolean;
}) {
  try {
    const to = await userEmail(input.athleteId);
    const eventType = input.approved ? "proof_approved" : "proof_rejected";
    const copy = input.approved
      ? mailContent([`Your proof for ${input.eventName} was approved.`])
      : mailContent([
          `Your proof for ${input.eventName} was rejected.`,
          "The winning bid is marked refunded. No payout.",
        ]);
    await sendEmail(eventType, input.proofId, {
      to: to ?? "",
      subject: input.approved
        ? `Proof approved — ${input.eventName}`
        : `Proof rejected — ${input.eventName}`,
      ...copy,
    });
  } catch (error) {
    console.log("notifyProofReviewed threw", error);
  }
}
