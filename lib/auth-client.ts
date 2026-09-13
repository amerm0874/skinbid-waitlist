"use client";

import {
  INTENDED_ROLE_KEY,
  type Role,
} from "@/lib/config";
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
    return "Confirm your email first, or use the login link below.";
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
  rememberIntendedRole(role);
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: authCallbackHref(window.location.origin, role, next),
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
  rememberIntendedRole(role);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: authCallbackHref(window.location.origin, role, next),
    },
  });
  if (error) {
    console.log("Login link failed", error.message);
    return "Could not send the link. Try again.";
  }
  return "";
}

export function goThroughAuthCallback(role?: Role | null, next?: string | null) {
  window.location.assign(authCallbackHref(window.location.origin, role, next));
}
