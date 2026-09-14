import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { destinationAfterAuth, parseRole } from "@/lib/config";
import { isLogoDeskNext, resolveLogoAuthNext } from "@/lib/logo";
import { NO_OG_METADATA } from "@/lib/seo";
import { ProductShell } from "@/components/product/ProductShell";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

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
    bid_id?: string | string[];
    error?: string | string[];
    signedout?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const role = parseRole(params.role);
  const next =
    resolveLogoAuthNext(firstQuery(params.next), firstQuery(params.bid_id)) ||
    null;
  const error = firstQuery(params.error);
  const signedOut = firstQuery(params.signedout) === "1";
  const { user, profile } = await getSessionUser();

  if (user && !signedOut) {
    if (next && isLogoDeskNext(next)) {
      redirect(next);
    }
    redirect(destinationAfterAuth(profile, role, next));
  }

  return (
    <ProductShell signedOut={signedOut}>
      <div className="page-stack auth-stack">
        <div>
          <h1 className="display page-title">Log in</h1>
          <p className="page-lead">
            {role === "brand" && isLogoDeskNext(next)
              ? "Log in to upload your logo."
              : role === "athlete"
                ? "List a race."
                : role === "brand"
                  ? "Advertise your brand."
                  : "List a race, or advertise your brand."}
          </p>
        </div>
        <LoginForm
          role={role}
          next={next}
          errorNotice={error === "signin" ? "Sign in again." : undefined}
        />
      </div>
    </ProductShell>
  );
}
