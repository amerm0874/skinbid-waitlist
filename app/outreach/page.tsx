import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { homeForCompleteProfile, sessionGateRedirect } from "@/lib/config";
import { ProductShell } from "@/components/product/ProductShell";
import OutreachForm from "./OutreachForm";

export const metadata: Metadata = {
  title: "Outreach",
};

export default async function OutreachPage() {
  const { supabase, user, profile } = await getSessionUser();
  const gate = sessionGateRedirect(user, profile, "/outreach");
  if (gate) {
    redirect(gate);
  }
  if (!user) {
    redirect("/login");
  }
  if (profile?.role !== "athlete") {
    redirect(homeForCompleteProfile(profile));
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
    <ProductShell email={user.email} role={profile.role}>
      <h1 className="display text-[40px] md:text-[56px]">
        Ask us to email a brand
      </h1>
      <p className="page-lead">
        No in-app chat. We send the email from SkinBid. They come here and bid
        if they want the slot.
      </p>
      <div className="mt-10">
        {brands.length === 0 ? (
          <p className="text-[14px] text-muted">No brands on the roster yet.</p>
        ) : (
          <OutreachForm brands={brands} />
        )}
      </div>
    </ProductShell>
  );
}
