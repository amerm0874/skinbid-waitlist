"use client";

import {
  INTENDED_ROLE_KEY,
  type Role,
} from "@/lib/config";
import {
  authReturnCookieHeader,
  googleCallbackUrl,
  publicAuthOrigin,
} from "@/lib/auth-return";
import { safeReturnPath } from "@/lib/launch";
import { createBrowserSupabase } from "@/lib/supabase/client";

export const PASSWORD_MIN = 6;

export function rememberIntendedRole(role?: Role | null) {
  if (role) {
    window.localStorage.setItem(INTENDED_ROLE_KEY, role);
  } else {
    window.localStorage.removeItem(INTENDED_ROLE_KEY);
  }
}

function oauthOrigin() {
  return publicAuthOrigin(window.location.hostname, window.location.origin);
}

export function rememberAuthReturn(role?: Role | null, next?: string | null) {
  rememberIntendedRole(role);
  for (const line of authReturnCookieHeader(
    role,
    next,
    window.location.hostname,
  )) {
    document.cookie = line;
  }
}

export function authCallbackHref(
  origin: string,
  role?: Role | null,
  next?: string | null,
) {
  const callback = new URL("/auth/callback", origin);
  const returnTo = safeReturnPath(next ?? null);
  if (returnTo) {
    callback.searchParams.set("next", returnTo);
  }
  if (role) {
    callback.searchParams.set("role", role);
  }
  return callback.toString();
}

export function authErrorCopy(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login") || lower.includes("invalid credentials")) {
    return "Wrong email or password.";
  }
  if (lower.includes("email not confirmed")) {
    return "Confirm your email first.";
  }
  if (
    lower.includes("already registered") ||
    lower.includes("already been registered")
  ) {
    return "That email already has an account. Log in.";
  }
  if (lower.includes("password")) {
    return `Use a password with at least ${PASSWORD_MIN} characters.`;
  }
  return "Could not continue. Try again.";
}

export async function continueWithGoogle(
  role?: Role | null,
  next?: string | null,
) {
  const supabase = createBrowserSupabase();
  if (!supabase) {
    return "Auth is not configured yet.";
  }
  rememberAuthReturn(role, next);
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: googleCallbackUrl(oauthOrigin()),
      queryParams: {
        prompt: "select_account",
        access_type: "offline",
      },
    },
  });
  if (error) {
    console.log("Google sign-in failed", error.message);
    return "Google sign-in is not available.";
  }
  return "";
}

export async function sendLoginLink(
  email: string,
  role?: Role | null,
  next?: string | null,
) {
  const supabase = createBrowserSupabase();
  if (!supabase) {
    return "Auth is not configured yet.";
  }
  rememberAuthReturn(role, next);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: authCallbackHref(oauthOrigin(), role, next),
    },
  });
  if (error) {
    console.log("Login link failed", error.message);
    return "Could not send the link. Try again.";
  }
  return "";
}

export function goThroughAuthCallback(role?: Role | null, next?: string | null) {
  rememberAuthReturn(role, next);
  window.location.assign(authCallbackHref(oauthOrigin(), role, next));
}

export function clearAuthReturn() {
  rememberAuthReturn(null, null);
}

export function clearBrowserAuth() {
  try {
    window.localStorage.removeItem(INTENDED_ROLE_KEY);
    for (const store of [window.localStorage, window.sessionStorage]) {
      const keys = [];
      for (let index = 0; index < store.length; index += 1) {
        const key = store.key(index);
        if (key) {
          keys.push(key);
        }
      }
      for (const key of keys) {
        if (key.startsWith("sb-") || key.toLowerCase().includes("supabase")) {
          store.removeItem(key);
        }
      }
    }
  } catch {
    // Private browsing. Cookies below still drop the session.
  }

  const cookies = document.cookie.split(";");
  for (const raw of cookies) {
    const name = raw.split("=")[0]?.trim();
    if (!name) {
      continue;
    }
    if (
      name.startsWith("sb-") ||
      name.includes("auth-token") ||
      name === "skinbid_auth_next" ||
      name === "skinbid_auth_role"
    ) {
      document.cookie = `${name}=; Max-Age=0; path=/`;
      document.cookie = `${name}=; Max-Age=0; path=/; domain=.skinbid.me`;
    }
  }
}
