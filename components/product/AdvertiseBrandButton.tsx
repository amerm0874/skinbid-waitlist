import { EventLink } from "@/components/product/EventLink";

export const ADVERTISE_LABEL = "Advertise your brand";

export function AdvertiseBrandButton({
  slug,
  full = false,
}: {
  slug: string;
  full?: boolean;
}) {
  return (
    <EventLink
      href={`/e/${slug}`}
      className={full ? "cta-press cta-press-full" : "cta-press"}
    >
      <span className="cta-press-plate" aria-hidden="true" />
      <span className="cta-press-face">{ADVERTISE_LABEL}</span>
    </EventLink>
  );
}
