import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { NO_OG_METADATA } from "@/lib/seo";
import {
  homeForCompleteProfile,
  loginPath,
  parseRole,
  pathAfterProfile,
  sessionGateRedirect,
} from "@/lib/config";
import { ProductShell } from "@/components/product/ProductShell";
import OnboardingForm from "./OnboardingForm";

export const metadata: Metadata = {
  title: "Onboarding",
  ...NO_OG_METADATA,
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string | string[] }>;
}) {
  const intendedRole = parseRole((await searchParams).role);
  const { user, profile } = await getSessionUser();
  const gate = sessionGateRedirect(user, profile, "/onboarding", intendedRole);
  if (gate) {
    redirect(gate);
  }
  if (!user) {
    redirect(loginPath(intendedRole, "/onboarding"));
  }

  const next = pathAfterProfile(profile);
  if (next !== "/onboarding") {
    redirect(homeForCompleteProfile(profile));
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
              : "Athlete lists one event. Brand browses live events. You cannot switch later."}
          </p>
        </div>
        <OnboardingForm
          userId={user.id}
          email={user.email ?? ""}
          profile={profile}
          intendedRole={intendedRole}
        />
      </div>
    </ProductShell>
  );
}
