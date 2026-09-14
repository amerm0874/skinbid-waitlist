import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { destinationForSession } from "@/lib/auth-map";
import {
  AUTH_NEXT_COOKIE,
  AUTH_ROLE_COOKIE,
  publicAuthOrigin,
  readAuthReturn,
  supabaseCookieOptions,
} from "@/lib/auth-return";
import { loginPath, SIGNIN_AGAIN_HREF } from "@/lib/config";
import { isAuthErrorQuery, isBadOAuthState } from "@/lib/launch";
import { resolveLogoAuthNext } from "@/lib/logo";
import { reuseProfileForEmail } from "@/lib/profile-reuse";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

function neverHome(path: string) {
  const pathOnly = path.split("?")[0] ?? "";
  return pathOnly === "/" ? SIGNIN_AGAIN_HREF : path;
}

function decodeCookieValue(value: string | undefined) {
  if (!value) {
    return null;
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = publicAuthOrigin(requestUrl.hostname, requestUrl.origin);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const otpType = requestUrl.searchParams.get("type");
  const cookieNext = decodeCookieValue(
    request.cookies.get(AUTH_NEXT_COOKIE)?.value,
  );
  const cookieRole = request.cookies.get(AUTH_ROLE_COOKIE)?.value ?? null;
  const { next: rawNext, role } = readAuthReturn({
    next: requestUrl.searchParams.get("next"),
    role: requestUrl.searchParams.get("role"),
    cookieNext,
    cookieRole,
  });
  const next = resolveLogoAuthNext(
    rawNext || null,
    requestUrl.searchParams.get("bid_id"),
  );
  const attempted = Boolean(code || tokenHash);
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  const pendingCookies: {
    name: string;
    value: string;
    options: Parameters<NextResponse["cookies"]["set"]>[2];
  }[] = [];
  const pendingHeaders: Record<string, string> = {};

  const finish = (response: NextResponse, keepReturn = false) => {
    for (const cookie of pendingCookies) {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }
    for (const [header, value] of Object.entries(pendingHeaders)) {
      response.headers.set(header, value);
    }
    if (!keepReturn) {
      response.cookies.set(AUTH_NEXT_COOKIE, "", { path: "/", maxAge: 0 });
      response.cookies.set(AUTH_ROLE_COOKIE, "", { path: "/", maxAge: 0 });
      const domain = supabaseCookieOptions(requestUrl.hostname).domain;
      if (domain) {
        response.cookies.set(AUTH_NEXT_COOKIE, "", {
          path: "/",
          maxAge: 0,
          domain,
        });
        response.cookies.set(AUTH_ROLE_COOKIE, "", {
          path: "/",
          maxAge: 0,
          domain,
        });
      }
    }
    response.headers.set(
      "Cache-Control",
      "private, no-cache, no-store, must-revalidate, max-age=0",
    );
    return response;
  };

  const failedAuth = () =>
    finish(NextResponse.redirect(new URL(SIGNIN_AGAIN_HREF, origin)));

  if (
    isBadOAuthState(requestUrl.searchParams) ||
    (isAuthErrorQuery(requestUrl.searchParams) && !code && !tokenHash)
  ) {
    return failedAuth();
  }

  if (!url || !key) {
    if (attempted) {
      return failedAuth();
    }
    return finish(
      NextResponse.redirect(
        new URL(loginPath(role, next || null), origin),
      ),
    );
  }

  const supabase = createServerClient(url, key, {
    cookieOptions: supabaseCookieOptions(requestUrl.hostname),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          pendingCookies.push({ name, value, options });
        });
        Object.assign(pendingHeaders, headers);
      },
    },
  });

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.log("Auth callback code failed", error.message);
      return failedAuth();
    }
  } else if (tokenHash && otpType) {
    const { error } = await supabase.auth.verifyOtp({
      type: otpType as EmailOtpType,
      token_hash: tokenHash,
    });
    if (error) {
      console.log("Auth callback otp failed", error.message);
      return failedAuth();
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await reuseProfileForEmail(user);
    const destination = neverHome(
      await destinationForSession(supabase, user.id, role, next || null),
    );
    const toOnboarding =
      (destination.split("?")[0] ?? "") === "/onboarding";
    return finish(
      NextResponse.redirect(new URL(destination, origin)),
      toOnboarding,
    );
  }

  if (attempted) {
    return failedAuth();
  }

  return finish(
    NextResponse.redirect(
      new URL(loginPath(role, next || null), origin),
    ),
  );
}
