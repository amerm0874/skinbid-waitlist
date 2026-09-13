import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { destinationForSession } from "@/lib/auth-map";
import { loginPath, parseRole, SIGNIN_AGAIN_HREF } from "@/lib/config";
import {
  isAuthErrorQuery,
  isBadOAuthState,
  safeReturnPath,
} from "@/lib/launch";
import { createServerSupabase } from "@/lib/supabase/server";

function neverHome(path: string) {
  const pathOnly = path.split("?")[0] ?? "";
  return pathOnly === "/" ? SIGNIN_AGAIN_HREF : path;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const otpType = requestUrl.searchParams.get("type");
  const role = parseRole(requestUrl.searchParams.get("role"));
  const next = safeReturnPath(requestUrl.searchParams.get("next"));
  const supabase = await createServerSupabase();
  const attempted = Boolean(code || tokenHash);
  const failedAuth = () =>
    NextResponse.redirect(new URL(SIGNIN_AGAIN_HREF, requestUrl.origin));

  if (
    isBadOAuthState(requestUrl.searchParams) ||
    (isAuthErrorQuery(requestUrl.searchParams) && !code && !tokenHash)
  ) {
    return failedAuth();
  }

  if (supabase) {
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
      const destination = neverHome(
        await destinationForSession(supabase, user.id, role, next || null),
      );
      return NextResponse.redirect(new URL(destination, requestUrl.origin));
    }
  }

  if (attempted) {
    return failedAuth();
  }

  return NextResponse.redirect(
    new URL(loginPath(role, next || null), requestUrl.origin),
  );
}
