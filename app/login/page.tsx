import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { NO_OG_METADATA } from "@/lib/seo";
import { destinationAfterAuth, parseRole } from "@/lib/config";
import { googleAuthEnabled } from "@/lib/supabase/env";
import { ProductShell } from "@/components/product/ProductShell";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Log in",
  ...NO_OG_METADATA,
};

function firstQuery(
  value: string | string[] | undefined,
) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    role?: string | string[];
    next?: string | string[];
    error?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const role = parseRole(params.role);
  const next = firstQuery(params.next) ?? null;
  const error = firstQuery(params.error);
  const { user, profile } = await getSessionUser();

  if (user) {
    redirect(destinationAfterAuth(profile, role, next));
  }

  return (
    <ProductShell>
      <div className="page-stack">
        <div>
          <h1 className="display page-title">Log in</h1>
          <p className="page-lead">
            Email and password.
            {role
              ? ` After that we open ${role} onboarding.`
              : " After that you pick athlete or brand."}
          </p>
        </div>
        <LoginForm
          role={role}
          next={next}
          errorNotice={error === "signin" ? "Sign in again." : undefined}
          showGoogle={googleAuthEnabled()}
        />
      </div>
    </ProductShell>
  );
}
