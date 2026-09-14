import { PostHogIdentify } from "@/lib/analytics";
import { ProductFooter } from "@/components/product/ProductFooter";
import { ProductNav } from "@/components/product/ProductNav";
import { getSessionUser } from "@/lib/auth";
import type { Role } from "@/lib/config";
import { publicAthleteHandle } from "@/lib/handle";
import { countUnreadNotices } from "@/lib/notifications";

export async function ProductShell({
  email,
  role,
  children,
  flush = false,
  signedOut = false,
}: {
  email?: string | null;
  role?: Role | null;
  children: React.ReactNode;
  flush?: boolean;
  signedOut?: boolean;
}) {
  const session = signedOut
    ? { supabase: null, user: null, profile: null }
    : await getSessionUser();
  const resolvedEmail = signedOut
    ? null
    : (session.user?.email ?? email);
  const resolvedRole = signedOut
    ? null
    : (session.profile?.role ?? role);
  const handle =
    resolvedRole === "athlete" && session.profile
      ? publicAthleteHandle(session.profile)
      : null;
  const unread =
    !signedOut && session.supabase && session.user
      ? await countUnreadNotices(session.supabase, session.user.id)
      : 0;

  return (
    <div className={flush ? "product product-cage min-h-full bg-bg" : "product min-h-full bg-bg"}>
      <PostHogIdentify userId={session.user?.id} role={resolvedRole} />
      <ProductNav
        email={resolvedEmail}
        name={session.profile?.name}
        role={resolvedRole}
        handle={handle}
        imageUrl={
          resolvedRole === "brand"
            ? session.profile?.logo_url
            : session.profile?.photo_url
        }
        compact={flush}
        unread={unread}
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
