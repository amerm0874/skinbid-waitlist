import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { NO_OG_METADATA } from "@/lib/seo";
import WaitlistForm from "@/components/waitlist/WaitlistForm";
import { ProductShell } from "@/components/product/ProductShell";
import type { Role } from "@/lib/config";

export const metadata: Metadata = {
  title: "Waitlist",
  description: "Email when events open.",
  ...NO_OG_METADATA,
};

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default async function WaitlistPage({
  searchParams,
}: {
  searchParams: Promise<{ slot?: string | string[]; from?: string | string[] }>;
}) {
  const params = await searchParams;
  const slot = firstParam(params.slot);
  const fromParam = firstParam(params.from);
  const from: Role | undefined =
    fromParam === "brand" ? "brand" : fromParam === "athlete" ? "athlete" : undefined;
  const { user, profile } = await getSessionUser();

  return (
    <ProductShell email={user?.email} role={profile?.role}>
      <div className="page-stack">
        <div>
          <h1 className="display page-title">Waitlist</h1>
          <p className="page-lead">
            Pick athlete or brand. We email you when events open.
          </p>
        </div>
        <WaitlistForm slot={slot} from={from} />
      </div>
    </ProductShell>
  );
}
