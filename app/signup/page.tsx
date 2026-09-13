import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { NO_OG_METADATA } from "@/lib/seo";
import { destinationAfterAuth, parseRole } from "@/lib/config";
import { googleAuthEnabled } from "@/lib/supabase/env";
import { ProductShell } from "@/components/product/ProductShell";
import SignupForm from "./SignupForm";

export const metadata: Metadata = {
  title: "Create account",
  ...NO_OG_METADATA,
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string | string[] }>;
}) {
  const role = parseRole((await searchParams).role);
  const { user, profile } = await getSessionUser();

  if (user) {
    redirect(destinationAfterAuth(profile, role));
  }

  return (
    <ProductShell>
      <div className="page-stack">
        <div>
          <h1 className="display page-title">Create account</h1>
          <p className="page-lead">
            Email and password.
            {role
              ? ` Next we open ${role} onboarding.`
              : " Next you pick athlete or brand."}
          </p>
        </div>
        <SignupForm role={role} showGoogle={googleAuthEnabled()} />
      </div>
    </ProductShell>
  );
}
