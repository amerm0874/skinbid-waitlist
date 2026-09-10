import type { Metadata } from "next";
import SiteShell from "@/components/landing/SiteShell";
import WaitlistForm from "@/components/waitlist/WaitlistForm";
import type { Role } from "@/lib/config";

export const metadata: Metadata = {
  title: "Waitlist",
  description: "Request early access to SkinBid.",
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

  return (
    <SiteShell>
      <main className="site-wrap flex flex-col items-center py-12 md:py-16">
        <h1 className="display text-center text-[40px] md:text-[56px]">
          Join the waitlist
        </h1>
        <p className="mt-3 max-w-md text-center text-[15px] text-muted">
          Pick athlete or brand. We email when we open.
        </p>
        <div className="mt-10 w-full">
          <WaitlistForm slot={slot} from={from} />
        </div>
      </main>
    </SiteShell>
  );
}
