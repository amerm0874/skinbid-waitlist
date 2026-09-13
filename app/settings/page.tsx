import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { loginPath, sessionGateRedirect } from "@/lib/config";
import { NO_OG_METADATA } from "@/lib/seo";
import { ProductShell } from "@/components/product/ProductShell";
import SettingsForm from "./SettingsForm";

export const metadata: Metadata = {
  title: "Settings",
  ...NO_OG_METADATA,
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { user, profile } = await getSessionUser();
  const gate = sessionGateRedirect(user, profile, "/settings");
  if (gate) {
    redirect(gate);
  }
  if (!user || !profile?.role) {
    redirect(loginPath(null, "/settings"));
  }

  return (
    <ProductShell email={user.email} role={profile.role}>
      <div className="page-stack">
        <div>
          <h1 className="display page-title">Settings</h1>
          <p className="page-lead">
            {profile.role === "brand"
              ? "Brand name, website, category, and logo."
              : "Photo, name, country, sport, socials, and PayPal."}
          </p>
        </div>
        <SettingsForm userId={user.id} profile={profile} />
      </div>
    </ProductShell>
  );
}
