import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { NO_OG_METADATA } from "@/lib/seo";
import { destinationAfterAuth, parseRole } from "@/lib/config";
import { safeReturnPath } from "@/lib/launch";
import { ProductShell } from "@/components/product/ProductShell";
import SignupForm from "./SignupForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create account",
  ...NO_OG_METADATA,
};

function firstQuery(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{
    role?: string | string[];
    next?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const role = parseRole(params.role);
  const next = safeReturnPath(firstQuery(params.next) ?? null) || null;
  const { user, profile } = await getSessionUser();

  if (user) {
    redirect(destinationAfterAuth(profile, role, next));
  }

  return (
    <ProductShell>
      <div className="page-stack auth-stack">
        <div>
          <h1 className="display page-title">Create account</h1>
          <p className="page-lead">
            {role === "athlete"
              ? "List a race."
              : role === "brand"
                ? "Advertise your brand."
                : "List a race, or advertise your brand."}
          </p>
        </div>
        <SignupForm role={role} next={next} />
      </div>
    </ProductShell>
  );
}
