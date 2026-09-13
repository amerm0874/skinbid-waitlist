import { SITE, type Role } from "@/lib/config";
import { createResend, resendFrom } from "@/lib/email";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}

function copyFor(role: Role, name: string, sport?: string) {
  const greeting = firstName(name);
  const sportLine =
    role === "athlete" && sport
      ? `You listed ${sport}. `
      : "";

  if (role === "brand") {
    return {
      subject: "You’re on the SkinBid list",
      preview: "We’ll email you when brands can buy race-day slots.",
      heading: `You’re in, ${greeting}.`,
      body: "We’ll email you when brands can buy race-day body slots.",
      steps: [
        "Pick an event",
        "Bid on a zone",
        "They wear your logo for one day",
        "You get the photos",
      ],
    };
  }

  return {
    subject: "You’re on the SkinBid list",
    preview: "We’ll email you when athletes can list race-day slots.",
    heading: `You’re in, ${greeting}.`,
    body: `${sportLine}We’ll email you when athletes can list race-day slots.`,
    steps: [
      "List the event",
      "Brands bid on SkinBid",
      "You wear a temp tattoo for one day",
      "Photos checked, then you get paid",
    ],
  };
}

function textEmail(input: {
  heading: string;
  body: string;
  steps: string[];
}) {
  return [
    "SKINBID",
    "",
    input.heading,
    "",
    input.body,
    "",
    ...input.steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    SITE.url,
  ].join("\n");
}

function htmlEmail(input: {
  heading: string;
  body: string;
  preview: string;
  steps: string[];
}) {
  const steps = input.steps
    .map(
      (step, index) => `
        <tr>
          <td style="padding:0 0 10px;font:600 13px/1 Arial,Helvetica,sans-serif;color:#c8f24e;width:28px;vertical-align:top;">
            ${String(index + 1).padStart(2, "0")}
          </td>
          <td style="padding:0 0 10px;font:400 15px/1.4 Arial,Helvetica,sans-serif;color:#f2f2f0;">
            ${escapeHtml(step)}
          </td>
        </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>SkinBid</title>
</head>
<body style="margin:0;padding:0;background:#0b0b0c;color:#f2f2f0;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${escapeHtml(input.preview)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b0c;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <tr>
            <td style="padding:0 0 28px;font:700 22px/1 Arial Black,Arial,Helvetica,sans-serif;letter-spacing:0.08em;color:#c8f24e;">
              SKINBID
            </td>
          </tr>
          <tr>
            <td style="height:3px;background:#c8f24e;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 0 12px;font:700 32px/1.05 Arial,Helvetica,sans-serif;color:#f2f2f0;">
              ${escapeHtml(input.heading)}
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 24px;font:400 16px/1.45 Arial,Helvetica,sans-serif;color:#9a9a94;">
              ${escapeHtml(input.body)}
            </td>
          </tr>
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${steps}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 0 0;font:400 13px/1.4 Arial,Helvetica,sans-serif;color:#9a9a94;">
              <a href="${escapeHtml(SITE.url)}" style="color:#c8f24e;text-decoration:none;">${escapeHtml(SITE.url.replace(/^https?:\/\//, ""))}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendWaitlistWelcome(input: {
  email: string;
  name: string;
  role: Role;
  sport?: string;
  isNew: boolean;
}) {
  if (!input.isNew) {
    return;
  }

  const resend = createResend();
  if (!resend) {
    console.log("Waitlist email skipped — no RESEND_API_KEY");
    return;
  }

  const copy = copyFor(input.role, input.name, input.sport);

  try {
    const { error } = await resend.emails.send(
      {
        from: resendFrom(),
        to: input.email,
        replyTo: SITE.email,
        subject: copy.subject,
        text: textEmail(copy),
        html: htmlEmail(copy),
        tags: [
          { name: "category", value: "waitlist" },
          { name: "role", value: input.role },
        ],
      },
      { idempotencyKey: `waitlist-welcome/${input.email}` },
    );

    if (error) {
      console.log("Waitlist email failed", error.message);
      return;
    }

    console.log("Waitlist email sent", input.email);
  } catch (error) {
    console.log("Waitlist email threw", error);
  }
}
