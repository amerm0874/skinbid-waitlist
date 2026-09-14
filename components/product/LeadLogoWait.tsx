"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { captureEvent } from "@/lib/analytics";

export function LeadLogoWait({ slug }: { slug: string }) {
  const router = useRouter();

  useEffect(() => {
    const bidId = new URLSearchParams(window.location.search).get("bid_id");
    captureEvent("checkout_returned", {
      slug,
      bid_id: bidId ?? "",
      kind: "bid",
    });
    captureEvent("bid_paid_returned", {
      slug,
      bid_id: bidId ?? "",
    });
    const tick = window.setInterval(() => {
      router.refresh();
    }, 2000);
    return () => window.clearInterval(tick);
  }, [router, slug]);

  return null;
}
