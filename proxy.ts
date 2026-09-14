import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { destinationForSession } from "@/lib/auth-map";
import { supabaseCookieOptions } from "@/lib/auth-return";
import {
  isAuthGatePath,
  loginPath,
  parseRole,
  SIGNIN_AGAIN_HREF,
} from "@/lib/config";
import {
  isAuthErrorQuery,
  isHiddenWaitlistApi,
  isHiddenWaitlistPage,
  isWaitlistOnly,
  safeReturnPath,
} from "@/lib/launch";
import { resolveLogoAuthNext } from "@/lib/logo";

type PendingCookie = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

function expireAuthCookies(request: NextRequest, response: NextResponse) {
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-") || cookie.name.includes("auth-token")) {
      response.cookies.set(cookie.name, "", { path: "/", maxAge: 0 });
    }
  }
}

function applyPending(
  response: NextResponse,
  pending: PendingCookie[],
  headers: Record<string, string>,
) {
  pending.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  Object.entries(headers).forEach(([header, value]) => {
    response.headers.set(header, value);
  });
  return response;
}

export async function proxy(request: NextRequest) {
  const host = request.nextUrl.hostname.toLowerCase();
  if (host === "skinbid.me") {
    const dest = request.nextUrl.clone();
    dest.protocol = "https:";
    dest.hostname = "www.skinbid.me";
    dest.port = "";
    return NextResponse.redirect(dest, 308);
  }

  const pathname = request.nextUrl.pathname;

  if (pathname === "/waitlist") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname === "/auth/callback" || pathname === "/auth/signout") {
    return NextResponse.next({ request });
  }

  // Optional lock: send leftover marketplace URLs home so nobody finds them.
  if (isWaitlistOnly()) {
    if (isHiddenWaitlistPage(pathname)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    if (isHiddenWaitlistApi(pathname)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  if (pathname === "/" && isAuthErrorQuery(request.nextUrl.searchParams)) {
    return NextResponse.redirect(new URL(SIGNIN_AGAIN_HREF, request.url));
  }

  // Sign-out lands here. Do not restore the session or send them into the app.
  if (pathname === "/login" && request.nextUrl.searchParams.get("signedout") === "1") {
    const response = NextResponse.next({ request });
    expireAuthCookies(request, response);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY;
  const pending: PendingCookie[] = [];
  const pendingHeaders: Record<string, string> = {};
  let response = NextResponse.next({ request });

  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookieOptions: supabaseCookieOptions(request.nextUrl.hostname),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          pending.push({ name, value, options });
        });
        Object.assign(pendingHeaders, headers);
        response = NextResponse.next({ request });
        applyPending(response, pending, pendingHeaders);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = parseRole(request.nextUrl.searchParams.get("role"));
  const next = resolveLogoAuthNext(
    safeReturnPath(request.nextUrl.searchParams.get("next")) || null,
    request.nextUrl.searchParams.get("bid_id"),
  );

  if (!user && isAuthGatePath(pathname)) {
    const gateNext =
      pathname + (request.nextUrl.search ? request.nextUrl.search : "");
    return applyPending(
      NextResponse.redirect(new URL(loginPath(role, gateNext), request.url)),
      pending,
      pendingHeaders,
    );
  }

  if (user && pathname === "/login") {
    const destination = await destinationForSession(
      supabase,
      user.id,
      role,
      next || null,
    );
    if (destination && destination !== "/login") {
      const redirectResponse = NextResponse.redirect(
        new URL(destination, request.url),
      );
      redirectResponse.headers.set(
        "Cache-Control",
        "private, no-cache, no-store, must-revalidate, max-age=0",
      );
      return applyPending(redirectResponse, pending, pendingHeaders);
    }
  }

  if (user && pathname === "/") {
    const destination = await destinationForSession(supabase, user.id, role);
    if (destination && destination !== "/") {
      return applyPending(
        NextResponse.redirect(new URL(destination, request.url)),
        pending,
        pendingHeaders,
      );
    }
    return applyPending(
      NextResponse.redirect(new URL("/onboarding", request.url)),
      pending,
      pendingHeaders,
    );
  }

  return applyPending(response, pending, pendingHeaders);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb|js|css)$).*)",
  ],
};
