import Link from "next/link";
import { GuestAuthLinks } from "@/components/product/GuestAuthLinks";
import { NotificationBell } from "@/components/product/NotificationBell";
import { ProductTabs } from "@/components/product/ProductTabs";
import { SignOutButton } from "@/components/product/SignOutButton";
import type { Role } from "@/lib/config";

type Props = {
  email?: string | null;
  name?: string | null;
  role?: Role | null;
  handle?: string | null;
  imageUrl?: string | null;
  compact?: boolean;
  unread?: number;
};

function navDisplayName(name?: string | null, email?: string | null) {
  const fromName = name?.trim();
  if (fromName) {
    return fromName;
  }
  const fromEmail = email?.split("@")[0]?.trim();
  if (fromEmail) {
    return fromEmail;
  }
  return "Me";
}

function nameInitial(name: string) {
  const letter = name.trim().slice(0, 1);
  return letter ? letter.toUpperCase() : "?";
}

export function ProductNav({
  email,
  name = null,
  role,
  handle = null,
  imageUrl = null,
  compact = false,
  unread = 0,
}: Props) {
  const isAthlete = role === "athlete";
  const meLabel = navDisplayName(name, email);
  const photo = imageUrl?.trim() || null;

  return (
    <header className={compact ? "site-header site-header-cage" : "site-header site-header-board"}>
      <div className="site-header-row">
        <Link
          href="/events"
          prefetch={false}
          className="wordmark-text"
          aria-label="SkinBid home"
        >
          SKINBID
        </Link>
        <ProductTabs />
        <nav className="nav-links">
          {email ? (
            <>
              <Link
                href={isAthlete ? "/me" : "/events"}
                prefetch={false}
                className="nav-me"
                title={meLabel}
              >
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="" className="nav-face" />
                ) : (
                  <span className="nav-face nav-face-initial" aria-hidden="true">
                    {nameInitial(meLabel)}
                  </span>
                )}
                <span className="nav-me-name">{meLabel}</span>
              </Link>
              <NotificationBell unread={unread} />
              <details className="account-menu">
                <summary>Account</summary>
                <div className="account-menu-panel">
                  {isAthlete && handle ? (
                    <Link href={`/a/${handle}`} prefetch={false}>Profile</Link>
                  ) : null}
                  {isAthlete ? <Link href="/me" prefetch={false}>Account</Link> : null}
                  {role === "brand" ? <Link href="/me" prefetch={false}>Bids</Link> : null}
                  <Link href="/settings" prefetch={false}>Settings</Link>
                  <SignOutButton />
                </div>
              </details>
            </>
          ) : (
            <GuestAuthLinks compact={compact} />
          )}
        </nav>
      </div>
    </header>
  );
}
