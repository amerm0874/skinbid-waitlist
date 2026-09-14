import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { AUTH_NEXT_COOKIE } from "@/lib/auth-return";
import { NO_OG_METADATA } from "@/lib/seo";
import {
  destinationAfterAuth,
  parseRole,
  pathAfterProfile,
  sessionGateRedirect,
} from "@/lib/config";
import { safeReturnPath } from "@/lib/launch";
import { ProductShell } from "@/components/product/ProductShell";
import OnboardingAuth from "./OnboardingAuth";
import OnboardingForm from "./OnboardingForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Onboarding",
  ...NO_OG_METADATA,
};

function firstQuery(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function decodeCookieValue(value: string | undefined) {
  if (!value) {
    return null;
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{
    role?: string | string[];
    next?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const intendedRole = parseRole(params.role);
  const cookieStore = await cookies();
  const returnTo =
    safeReturnPath(firstQuery(params.next) ?? null) ||
    safeReturnPath(decodeCookieValue(cookieStore.get(AUTH_NEXT_COOKIE)?.value)) ||
    null;
  const { user, profile } = await getSessionUser();
  const gate = sessionGateRedirect(user, profile, "/onboarding", intendedRole);
  if (gate) {
    redirect(gate);
  }

  if (!user) {
    return (
      <ProductShell>
        <div className="page-stack auth-stack">
          <div>
            <h1 className="display page-title">Set your role</h1>
            <p className="page-lead">
              Athlete lists one race. Brand browses races. You cannot switch
              later.
            </p>
          </div>
          <OnboardingAuth role={intendedRole} next={returnTo} />
        </div>
      </ProductShell>
    );
  }

  if (pathAfterProfile(profile) !== "/onboarding") {
    redirect(destinationAfterAuth(profile, intendedRole, returnTo));
  }

  const brandFirstRun = profile?.role === "brand";

  return (
    <ProductShell email={user.email} role={profile?.role}>
      <div className="page-stack">
        <div>
          <h1 className="display page-title">
            {brandFirstRun ? "Brand details" : "Set your role"}
          </h1>
          <p className="page-lead">
            {brandFirstRun
              ? "Brand name, website, and one category. Logo is optional. You pay SkinBid later."
              : "Athlete lists one race. Brand browses races. You cannot switch later."}
          </p>
        </div>
        <OnboardingForm
          userId={user.id}
          email={user.email ?? ""}
          profile={profile}
          intendedRole={intendedRole}
          next={returnTo}
        />
      </div>
    </ProductShell>
  );
}
