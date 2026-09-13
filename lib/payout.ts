import type { SupabaseClient } from "@supabase/supabase-js";
import { PAYOUT_RAIL } from "@/lib/config";
import { dbErrorMessage, isMissingRelation } from "@/lib/db-error";

function isMissingPayoutTable(
  error: { message?: string; code?: string } | null | undefined,
) {
  return isMissingRelation(error, "athlete_payouts");
}

export async function loadOwnPayout(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ payout_rail: string | null; payout_account: string | null }> {
  const { data, error } = await supabase
    .from("athlete_payouts")
    .select("payout_rail, payout_account")
    .eq("athlete_id", userId)
    .maybeSingle();
  if (error && !isMissingPayoutTable(error)) {
    console.log("Payout load failed", error.message);
  }
  return {
    payout_rail: data?.payout_rail ?? null,
    payout_account: data?.payout_account ?? null,
  };
}

export async function saveAthletePayout(
  supabase: SupabaseClient,
  userId: string,
  paypalEmail: string,
) {
  const { error } = await supabase.from("athlete_payouts").upsert({
    athlete_id: userId,
    payout_rail: PAYOUT_RAIL,
    payout_account: paypalEmail.trim(),
  });
  if (error) {
    throw new Error(dbErrorMessage(error));
  }
}

export async function clearAthletePayout(supabase: SupabaseClient, userId: string) {
  const { error } = await supabase
    .from("athlete_payouts")
    .delete()
    .eq("athlete_id", userId);
  if (!error || isMissingPayoutTable(error)) {
    return;
  }
  throw new Error(dbErrorMessage(error));
}
