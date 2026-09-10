import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { ProductNav } from "@/components/product/ProductNav";
import OutreachForm from "./OutreachForm";

export const metadata: Metadata = {
  title: "Outreach",
};

export default async function OutreachPage() {
  const { supabase, user, profile } = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  if (profile?.role !== "athlete") {
    redirect("/onboarding");
  }

  let brands: Array<{
    id: string;
    name: string | null;
    website: string | null;
    brand_category: string | null;
  }> = [];
  if (supabase) {
    const { data } = await supabase
      .from("profiles")
      .select("id, name, website, brand_category")
      .eq("role", "brand")
      .order("name");
    brands = data ?? [];
  }

  return (
    <div className="min-h-full bg-bg">
      <ProductNav email={user.email} />
      <main className="site-wrap py-12">
        <h1 className="display text-[40px]">Ask us to email a brand</h1>
        <p className="mt-2 max-w-md text-[14px] text-muted">
          No in-app chat. We send the email from SkinBid. They come here and
          bid if they want the slot.
        </p>
        <div className="mt-8">
          {brands.length === 0 ? (
            <p className="text-[14px] text-muted">No brands on the roster yet.</p>
          ) : (
            <OutreachForm brands={brands} />
          )}
        </div>
      </main>
    </div>
  );
}
