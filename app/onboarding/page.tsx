import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { ProductNav } from "@/components/product/ProductNav";
import OnboardingForm from "./OnboardingForm";

export const metadata: Metadata = {
  title: "Onboarding",
};

export default async function OnboardingPage() {
  const { user, profile } = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  if (profile?.role) {
    redirect("/events");
  }

  return (
    <div className="min-h-full bg-bg">
      <ProductNav email={user.email} />
      <main className="site-wrap py-12">
        <h1 className="display text-[40px]">Set your role</h1>
        <p className="mt-2 max-w-md text-[14px] text-muted">
          Athlete lists one dated event. Brand auctions a zone. No chat.
        </p>
        <div className="mt-8">
          <OnboardingForm userId={user.id} email={user.email ?? ""} />
        </div>
      </main>
    </div>
  );
}
