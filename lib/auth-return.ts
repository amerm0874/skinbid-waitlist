import type { CookieOptions } from "@supabase/ssr";
import { parseRole, type Role } from "@/lib/config";
import { safeReturnPath } from "@/lib/launch";

export const AUTH_NEXT_COOKIE = "skinbid_auth_next";
export const AUTH_ROLE_COOKIE = "skinbid_auth_role";

export function authCookieDomain(hostname: string) {
  const host = hostname.split(":")[0]?.toLowerCase() ?? "";
  if (host === "www.skinbid.me" || host === "skinbid.me") {
    return ".skinbid.me";
  }
  return undefined;
}

export function supabaseCookieOptions(_hostname: string): CookieOptions {
  return {
    path: "/",
    sameSite: "lax",
  };
}

export function publicAuthOrigin(hostname: string, fallbackOrigin: string) {
  const host = hostname.split(":")[0]?.toLowerCase() ?? "";
  if (host === "localhost" || host === "127.0.0.1") {
    return fallbackOrigin;
  }
  if (host === "skinbid.me" || host === "www.skinbid.me") {
    return "https://www.skinbid.me";
  }
  return fallbackOrigin;
}

export function googleCallbackUrl(origin: string) {
  return new URL("/auth/callback", origin).toString();
}

export function readAuthReturn(input: {
  next?: string | null;
  role?: string | null;
  cookieNext?: string | null;
  cookieRole?: string | null;
}) {
  const next =
    safeReturnPath(input.next ?? null) ||
    safeReturnPath(input.cookieNext ?? null);
  const role = parseRole(input.role) ?? parseRole(input.cookieRole);
  return { next, role };
}

export function authReturnCookieHeader(
  role?: Role | null,
  next?: string | null,
  hostname?: string,
) {
  const returnTo = safeReturnPath(next ?? null);
  const domain = hostname ? authCookieDomain(hostname) : undefined;
  const secure =
    typeof window !== "undefined"
      ? window.location.protocol === "https:"
      : true;
  const parts = (name: string, value: string, maxAge: number) => {
    const bits = [
      `${name}=${value}`,
      "Path=/",
      `Max-Age=${maxAge}`,
      "SameSite=Lax",
    ];
    if (secure) {
      bits.push("Secure");
    }
    if (domain) {
      bits.push(`Domain=${domain}`);
    }
    return bits.join("; ");
  };
  return [
    parts(
      AUTH_NEXT_COOKIE,
      returnTo ? encodeURIComponent(returnTo) : "",
      returnTo ? 1800 : 0,
    ),
    parts(AUTH_ROLE_COOKIE, role ?? "", role ? 1800 : 0),
  ];
}
