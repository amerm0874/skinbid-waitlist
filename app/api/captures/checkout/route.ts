import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isMissingColumn } from "@/lib/db-error";
import { takeToken } from "@/lib/rate-limit";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  athleteModelRedirectPath,
  checkoutHost,
  createAthleteModelCheckout,
  createWhopClient,
  describeWhopError,
  isMissingCaptureIdError,
  logWhopEnv,
  resolveWhopCompanyId,
  whopPaymentsEnabled,
} from "@/lib/whop";

export async function GET() {
  const { supabase, user, profile } = await getSessionUser();
  if (!supabase || !user || profile?.role !== "athlete") {
    return NextResponse.json({ error: "Log in as an athlete." }, { status: 401 });
  }

  const paid = await loadPaidCapture(supabase, user.id);
  return NextResponse.json({
    model_paid: Boolean(paid),
    capture_id: paid?.id ?? null,
  });
}

export async function POST(request: Request) {
  const { supabase, user, profile } = await getSessionUser();
  if (!supabase || !user) {
    return NextResponse.json({ error: "Log in first." }, { status: 401 });
  }
  if (profile?.role !== "athlete") {
    return NextResponse.json({ error: "Only athletes pay for a 3D model." }, { status: 403 });
  }
  if (!takeToken(`athlete-model:${user.id}`, 8, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many checkouts. Wait a minute." }, { status: 429 });
  }
  logWhopEnv();
  if (!whopPaymentsEnabled()) {
    return NextResponse.json({ error: "Payments are not ready. WHOP_API_KEY missing." }, { status: 503 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json(
      { error: "Checkout needs the service role key." },
      { status: 503 },
    );
  }

  const alreadyPaid = await loadPaidCapture(admin, user.id);
  if (alreadyPaid) {
    return NextResponse.json({
      model_paid: true,
      capture_id: alreadyPaid.id,
    });
  }

  const started = await ensureUnpaidCapture(admin, user.id);
  if ("error" in started) {
    return NextResponse.json({ error: started.error }, { status: 500 });
  }
  let captureId = started.id;

  let returnTo: unknown;
  try {
    const body = (await request.json()) as { return_to?: unknown };
    returnTo = body?.return_to;
  } catch {
    returnTo = undefined;
  }

  const whop = createWhopClient();
  const companyId = resolveWhopCompanyId();
  if (!whop || !companyId) {
    return NextResponse.json(
      { error: companyId ? "Payments are not ready. WHOP_API_KEY missing." : "Payments are not ready. WHOP_COMPANY_ID missing." },
      { status: 503 },
    );
  }

  try {
    let checkout;
    try {
      checkout = await createAthleteModelCheckout({
        whop,
        companyId,
        athleteId: user.id,
        captureId,
        redirectPath: athleteModelRedirectPath(returnTo, captureId),
      });
    } catch (error) {
      const detail = describeWhopError(error);
      if (!isMissingCaptureIdError(detail.message)) {
        throw error;
      }
      console.log("Whop athlete model checkout missing capture_id", detail.status, detail.message);
      const created = await ensureUnpaidCapture(admin, user.id);
      if ("error" in created) {
        return NextResponse.json({ error: created.error }, { status: 500 });
      }
      captureId = created.id;
      checkout = await createAthleteModelCheckout({
        whop,
        companyId,
        athleteId: user.id,
        captureId,
        redirectPath: athleteModelRedirectPath(returnTo, captureId),
      });
    }
    if (!checkout.purchase_url) {
      console.log("Whop athlete model checkout failed", null, "no checkout URL");
      return NextResponse.json({ error: "Whop returned no checkout URL." }, { status: 502 });
    }
    const redirectPath = athleteModelRedirectPath(returnTo, captureId);
    revalidatePath("/new");
    revalidatePath(redirectPath.split("?")[0] ?? "/new");
    console.log(
      "Whop athlete model checkout",
      captureId,
      checkout.id,
      checkoutHost(checkout.purchase_url),
    );
    return NextResponse.json({
      model_paid: false,
      capture_id: captureId,
      checkout_url: checkout.purchase_url,
    });
  } catch (error) {
    const detail = describeWhopError(error);
    console.log("Whop athlete model checkout failed", detail.status, detail.message);
    return NextResponse.json(
      { error: detail.message },
      { status: 502 },
    );
  }
}

async function loadPaidCapture(
  db: NonNullable<ReturnType<typeof createAdminSupabase>>,
  athleteId: string,
) {
  const { data, error } = await db
    .from("captures")
    .select("id, model_paid")
    .eq("athlete_id", athleteId)
    .eq("model_paid", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error && isMissingColumn(error, "model_paid")) {
    return null;
  }
  return data ?? null;
}

async function ensureUnpaidCapture(
  admin: NonNullable<ReturnType<typeof createAdminSupabase>>,
  athleteId: string,
): Promise<{ id: string } | { error: string }> {
  const { data: existing, error: existingError } = await admin
    .from("captures")
    .select("id")
    .eq("athlete_id", athleteId)
    .eq("model_paid", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    return { id: existing.id as string };
  }
  if (existingError && !isMissingColumn(existingError, "model_paid")) {
    console.log("Capture lookup failed", existingError.message);
  }

  const inserted = await insertCapture(admin, athleteId, true);
  if ("id" in inserted) {
    return inserted;
  }
  if (inserted.missingPaidColumn) {
    return insertCapture(admin, athleteId, false);
  }
  return { error: inserted.error };
}

async function insertCapture(
  admin: NonNullable<ReturnType<typeof createAdminSupabase>>,
  athleteId: string,
  withPaidColumn: boolean,
): Promise<{ id: string } | { error: string; missingPaidColumn?: boolean }> {
  const { data: created, error } = withPaidColumn
    ? await admin
        .from("captures")
        .insert({
          athlete_id: athleteId,
          status: "pending",
          model_paid: false,
        })
        .select("id")
        .single()
    : await admin
        .from("captures")
        .insert({ athlete_id: athleteId, status: "pending" })
        .select("id")
        .single();
  if (created?.id) {
    return { id: created.id as string };
  }
  console.log("Capture insert failed", error?.message);
  if (error && isMissingColumn(error, "model_paid")) {
    return { error: error.message, missingPaidColumn: true };
  }
  return { error: error?.message || "Could not create capture before checkout." };
}
