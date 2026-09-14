import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { loginPath } from "@/lib/config";
import { DEMO_SLUG } from "@/lib/demo-event";
import { loadLogoDesk } from "@/lib/event-logo";
import { holdReturnedBid } from "@/lib/hold-bid";
import { logoDeskPath } from "@/lib/logo";
import { NO_OG_METADATA } from "@/lib/seo";
import { EmptyState } from "@/components/product/EmptyState";
import { LeadLogoWait } from "@/components/product/LeadLogoWait";
import { ProductShell } from "@/components/product/ProductShell";
import { WinnerLogoForm } from "@/components/product/WinnerLogoForm";
import { TrackOnce } from "@/lib/analytics";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function paymentIdFromSearch(
  params: Record<string, string | string[] | undefined>,
) {
  for (const value of Object.values(params)) {
    const raw = firstParam(value);
    if (raw.startsWith("pay_")) {
      return raw;
    }
  }
  return "";
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: "Zone mark",
    robots: { index: false, follow: false },
    ...NO_OG_METADATA,
    alternates: { canonical: logoDeskPath(slug) },
  };
}

export default async function WinnerLogoPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const bidId = firstParam(query.bid_id);
  const { supabase, user, profile } = await getSessionUser();
  const isDemo = slug === DEMO_SLUG;

  if (!isDemo && !user) {
    redirect(loginPath("brand", logoDeskPath(slug, bidId || null)));
  }

  if (!isDemo && bidId && profile?.role === "brand") {
    await holdReturnedBid({
      bidId,
      brandId: profile.id,
      paymentId: paymentIdFromSearch(query) || null,
    });
  }

  const desk = await loadLogoDesk({
    slug,
    supabase,
    brandId: profile?.role === "brand" ? profile.id : null,
  });
  if (!desk) {
    notFound();
  }

  const canUpload =
    isDemo || (profile?.role === "brand" && desk.zones.length > 0);
  const waitingOnPay =
    Boolean(bidId) && profile?.role === "brand" && desk.zones.length === 0;

  return (
    <ProductShell email={user?.email} role={profile?.role}>
      <TrackOnce event="logo_desk_opened" slug={slug} />
      <div className="page-stack">
        <div>
          <p className="slot-board-kicker">Lead logo</p>
          <h1 className="page-title">Zone mark</h1>
        </div>

        {canUpload ? (
          <WinnerLogoForm
            slug={desk.slug}
            eventName={desk.eventName}
            athleteName={desk.athleteName}
            isDemo={desk.isDemo}
            kinds={desk.kinds}
            zones={desk.zones}
          />
        ) : waitingOnPay ? (
          <LeadLogoWait slug={desk.slug} />
        ) : desk.auctionOpen && profile?.role === "brand" ? (
          <EmptyState
            line="Pay a zone first."
            href={`/e/${desk.slug}`}
            linkLabel="Event"
          />
        ) : desk.zones.length === 0 && profile?.role === "brand" ? (
          <EmptyState line="You do not lead a zone." />
        ) : (
          <EmptyState line="Lead a zone to upload the PNG." />
        )}

        <p className="fine">
          <Link href={`/e/${desk.slug}`}>Back to the event</Link>
        </p>
      </div>
    </ProductShell>
  );
}
