import { EarlyAccessBanner } from "@/components/product/EarlyAccessBanner";
import { ProductFooter } from "@/components/product/ProductFooter";
import { ProductNav } from "@/components/product/ProductNav";
import { getSessionUser } from "@/lib/auth";
import type { Role } from "@/lib/config";
import { publicAthleteHandle } from "@/lib/handle";

export async function ProductShell({
  email,
  role,
  children,
  flush = false,
}: {
  email?: string | null;
  role?: Role | null;
  children: React.ReactNode;
  flush?: boolean;
}) {
  const session = await getSessionUser();
  const resolvedEmail = session.user?.email ?? email;
  const resolvedRole = session.profile?.role ?? role;
  const handle =
    resolvedRole === "athlete" && session.profile
      ? publicAthleteHandle(session.profile)
      : null;

  return (
    <div className={flush ? "product product-cage min-h-full bg-bg" : "product min-h-full bg-bg"}>
      {flush ? null : <EarlyAccessBanner />}
      <ProductNav
        email={resolvedEmail}
        name={session.profile?.name}
        role={resolvedRole}
        handle={handle}
        compact={flush}
      />
      {flush ? (
        children
      ) : (
        <div className="product-body">
          <main className="site-wrap py-[var(--block-y)]">{children}</main>
          <ProductFooter />
        </div>
      )}
    </div>
  );
}
