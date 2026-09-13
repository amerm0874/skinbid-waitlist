import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { SignOutButton } from "@/components/product/SignOutButton";
import type { Role } from "@/lib/config";

type Props = {
  email?: string | null;
  name?: string | null;
  role?: Role | null;
  handle?: string | null;
  compact?: boolean;
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

export function ProductNav({
  email,
  name = null,
  role,
  handle = null,
  compact = false,
}: Props) {
  const isAthlete = role === "athlete";
  const meLabel = navDisplayName(name, email);

  return (
    <header className={compact ? "site-header site-header-cage" : "site-header"}>
      <Wordmark href="/events" />
      <nav className="nav-links">
        <Link href="/events">Events</Link>
        {email ? (
          <>
            <Link href="/me" className="nav-me" title={meLabel}>
              {meLabel}
            </Link>
            <details className="account-menu">
              <summary>Account</summary>
              <div className="account-menu-panel">
                {isAthlete && handle ? (
                  <Link href={`/a/${handle}`}>Profile</Link>
                ) : null}
                <Link href="/settings">Settings</Link>
                <SignOutButton />
              </div>
            </details>
          </>
        ) : (
          <Link href="/login">Log in</Link>
        )}
      </nav>
    </header>
  );
}
