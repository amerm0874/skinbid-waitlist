"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { inboxPassword } from "@/lib/waitlist-inbox";

export async function unlockInbox(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const expected = inboxPassword();
  if (!expected || password !== expected) {
    redirect("/inbox?error=1");
  }
  const jar = await cookies();
  jar.set("waitlist_inbox", "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/inbox");
}
