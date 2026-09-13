import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteShell from "@/components/landing/SiteShell";
import { getSessionUser, isAdminEmail } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Waitlist inbox",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type WaitlistRow = {
  email: string;
  name: string | null;
  role: string | null;
  instagram: string | null;
  fields: Record<string, string> | null;
  created_at: string;
};

function sportFrom(row: WaitlistRow) {
  return row.fields?.sport?.trim() || "—";
}

function socialFrom(row: WaitlistRow) {
  return row.instagram?.trim() || row.fields?.social?.trim() || "—";
}

export default async function InboxPage() {
  const { user } = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  if (!isAdminEmail(user.email)) {
    redirect("/events");
  }

  const admin = createAdminSupabase();
  let rows: WaitlistRow[] = [];
  let loadError = "";

  if (!admin) {
    loadError = "Database keys are missing.";
  } else {
    const { data, error } = await admin
      .from("waitlist")
      .select("email, name, role, instagram, fields, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      loadError = error.message;
    } else {
      rows = (data ?? []) as WaitlistRow[];
    }
  }

  return (
    <SiteShell>
      <main className="site-wrap py-[var(--block-y)]">
        <h1 className="display text-[40px] md:text-[56px]">Waitlist inbox</h1>
        <p className="mt-3 max-w-lg text-[15px] text-muted">
          {rows.length} saved. Admin only. A cookie cannot open this list.
        </p>

        {loadError ? (
          <p className="mt-8 text-[15px] text-danger" role="alert">
            {loadError}
          </p>
        ) : rows.length === 0 ? (
          <p className="mt-8 text-[15px] text-muted">No emails stored yet.</p>
        ) : (
          <ul className="mt-10 divide-y divide-line border-y border-line">
            {rows.map((row) => (
              <li key={`${row.email}-${row.created_at}`} className="py-4">
                <p className="text-[18px] text-ink">{row.email}</p>
                <p className="mt-1 font-mono text-[12px] text-muted">
                  {row.role ?? "—"} · {row.name || "—"} · {sportFrom(row)} ·{" "}
                  {socialFrom(row)} ·{" "}
                  {new Date(row.created_at).toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </SiteShell>
  );
}
