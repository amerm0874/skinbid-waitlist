import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { ProductNav } from "@/components/product/ProductNav";
import NewEventForm from "./NewEventForm";

export const metadata: Metadata = {
  title: "New event",
};

export default async function NewEventPage() {
  const { user, profile } = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  if (profile?.role !== "athlete") {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-full bg-bg">
      <ProductNav email={user.email} />
      <main className="site-wrap py-12">
        <h1 className="display text-[40px]">List one event</h1>
        <p className="mt-2 max-w-md text-[14px] text-muted">
          Twelve named zones. Brands start the auction. You do not type a price.
        </p>
        <div className="mt-8">
          <NewEventForm />
        </div>
      </main>
    </div>
  );
}
