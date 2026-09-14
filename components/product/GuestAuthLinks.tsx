"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { loginPath } from "@/lib/config";

export function GuestAuthLinks({ compact = false }: { compact?: boolean }) {
  const path = usePathname() ?? "";
  const onEvent = path.startsWith("/e/");
  const next = onEvent ? path : null;
  const loginHref = loginPath(onEvent ? "brand" : null, next);

  if (compact) {
    return (
      <Link href={loginHref} prefetch={false}>
        Log in
      </Link>
    );
  }

  return (
    <>
      <Link href="/signup?role=athlete" prefetch={false}>
        List a race
      </Link>
      <Link href={loginHref} prefetch={false}>
        Log in
      </Link>
    </>
  );
}
