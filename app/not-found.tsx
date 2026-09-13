import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { NO_OG_METADATA } from "@/lib/seo";
import { EmptyState } from "@/components/product/EmptyState";
import { ProductShell } from "@/components/product/ProductShell";

export const metadata: Metadata = {
  title: "Not found",
  ...NO_OG_METADATA,
};

export default async function NotFound() {
  const { user, profile } = await getSessionUser();

  return (
    <ProductShell email={user?.email} role={profile?.role}>
      <div className="page-stack">
        <h1 className="display page-title">Not found</h1>
        <EmptyState line="That page is not on SkinBid." />
      </div>
    </ProductShell>
  );
}
