import { cookies } from "next/headers";

export async function inboxIsOpen() {
  // On your computer, show the list right away. Live site needs the password.
  if (!process.env.VERCEL) {
    return true;
  }
  const jar = await cookies();
  return jar.get("waitlist_inbox")?.value === "1";
}

export function inboxPassword() {
  return process.env.WAITLIST_INBOX_KEY || process.env.CRON_SECRET || "";
}
