import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

type Props = {
  email?: string | null;
};

export function ProductNav({ email }: Props) {
  return (
    <header className="site-header">
      <Wordmark href="/events" />
      <nav className="nav-links">
        <Link href="/events">Events</Link>
        <Link href="/new">New</Link>
        <Link href="/outreach">Outreach</Link>
        {email ? (
          <span className="hidden max-w-[140px] truncate px-2 text-[12px] text-muted sm:inline">
            {email}
          </span>
        ) : (
          <Link href="/login">Log in</Link>
        )}
      </nav>
    </header>
  );
}
