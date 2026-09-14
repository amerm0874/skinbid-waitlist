"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/events",
    label: "Events",
    match: (path: string) => path === "/events" || path.startsWith("/races/"),
  },
  {
    href: "/athletes",
    label: "Athletes",
    match: (path: string) => path === "/athletes" || path.startsWith("/a/"),
  },
] as const;

export function ProductTabs() {
  const path = usePathname() ?? "";

  return (
    <nav className="product-tabs" aria-label="Browse">
      {TABS.map((tab) => {
        const current = tab.match(path);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            prefetch={false}
            className={current ? "is-active" : undefined}
            aria-current={current ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
