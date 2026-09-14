import type { SupabaseClient } from "@supabase/supabase-js";
import { loadProfileRow } from "@/lib/profile";
import { createAdminSupabase } from "@/lib/supabase/admin";

const PROFILE_COPY_SELECT =
  "role, name, country, dob, age, gender, sport, sport_detail, social, socials, brand_category, website, logo_url, photo_url";

export async function reuseProfileForEmail(user: {
  id: string;
  email?: string | null;
}) {
  const email = user.email?.trim();
  if (!email) {
    return;
  }
  const admin = createAdminSupabase();
  if (!admin) {
    return;
  }

  const mine = await loadProfileRow(admin, user.id);
  if (mine) {
    return;
  }

  const rpc = await admin.rpc("reuse_profile_for_email", {
    p_user_id: user.id,
    p_email: email,
  });
  if (!rpc.error) {
    return;
  }
  console.log("Profile reuse rpc skipped", rpc.error.message);
  await reuseProfileFromAuthUsers(admin, user.id, email);
}

async function reuseProfileFromAuthUsers(
  admin: SupabaseClient,
  userId: string,
  email: string,
) {
  const wanted = email.toLowerCase();
  for (let page = 1; page <= 10; page += 1) {
    const listed = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (listed.error) {
      console.log("Profile reuse list failed", listed.error.message);
      return;
    }
    const users = listed.data.users ?? [];
    const match = users.find(
      (row) =>
        row.id !== userId && (row.email ?? "").toLowerCase() === wanted,
    );
    if (match) {
      await copyProfileToUser(admin, match.id, userId);
      return;
    }
    if (users.length < 200) {
      return;
    }
  }
}

async function copyProfileToUser(
  admin: SupabaseClient,
  fromId: string,
  toId: string,
) {
  if (fromId === toId) {
    return;
  }
  const already = await loadProfileRow(admin, toId);
  if (already) {
    return;
  }

  const src = await admin
    .from("profiles")
    .select(PROFILE_COPY_SELECT)
    .eq("id", fromId)
    .maybeSingle();
  if (src.error || !src.data) {
    if (src.error) {
      console.log("Profile reuse select failed", src.error.message);
    }
    return;
  }

  const inserted = await admin.from("profiles").insert({ id: toId, ...src.data });
  if (inserted.error) {
    console.log("Profile reuse insert failed", inserted.error.message);
    return;
  }

  await admin.from("events").update({ athlete_id: toId }).eq("athlete_id", fromId);
  await admin.from("bids").update({ brand_id: toId }).eq("brand_id", fromId);
  await admin.from("captures").update({ athlete_id: toId }).eq("athlete_id", fromId);
  await admin.from("avatars").update({ athlete_id: toId }).eq("athlete_id", fromId);

  const payout = await admin
    .from("athlete_payouts")
    .select("payout_rail, payout_account")
    .eq("athlete_id", fromId)
    .maybeSingle();
  if (payout.data) {
    await admin.from("athlete_payouts").upsert({
      athlete_id: toId,
      payout_rail: payout.data.payout_rail,
      payout_account: payout.data.payout_account,
    });
  }
  console.log("Reused profile for same email", toId);
}
