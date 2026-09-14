"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { parseRole, type Role } from "@/lib/config";

function posthogKey() {
  return process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ?? "";
}

function posthogHost() {
  return process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() ?? "";
}

export function isPosthogEnabled() {
  return Boolean(posthogKey());
}

function isBlockedKey(key: string) {
  const name = key.toLowerCase();
  return (
    name.includes("email") ||
    name.includes("card") ||
    name.includes("cvc") ||
    name.includes("cvv") ||
    name.includes("pan") ||
    name.startsWith("cc_") ||
    name.includes("exp_month") ||
    name.includes("exp_year")
  );
}

function withoutEmail(
  properties?: Record<string, unknown> | null,
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  if (!properties) {
    return clean;
  }
  for (const [key, value] of Object.entries(properties)) {
    if (isBlockedKey(key) || value == null) {
      continue;
    }
    clean[key] = value;
  }
  return clean;
}

export function initPosthog() {
  const key = posthogKey();
  if (typeof window === "undefined" || !key || posthog.__loaded) {
    return;
  }
  const eu = posthogHost().includes("eu.");
  posthog.init(key, {
    api_host: "/ingest",
    ui_host: eu ? "https://eu.posthog.com" : "https://us.posthog.com",
    defaults: "2026-05-30",
    autocapture: true,
    // App Router navigations. We send $pageview on each route change.
    capture_pageview: false,
    capture_pageleave: true,
    capture_exceptions: true,
    disable_session_recording: false,
    session_recording: {
      maskAllInputs: true,
      maskInputOptions: {
        password: true,
        email: true,
      },
    },
    sanitize_properties: (properties) => withoutEmail(properties),
  });
}

export function captureEvent(
  event: string,
  properties?: Record<string, string | number | boolean | null | undefined>,
) {
  if (typeof window === "undefined" || !isPosthogEnabled()) {
    return;
  }
  posthog.capture(event, withoutEmail(properties));
}

export function TrackOnce({
  event,
  slug,
}: {
  event: string;
  slug?: string;
}) {
  useEffect(() => {
    captureEvent(event, slug ? { slug } : undefined);
  }, [event, slug]);
  return null;
}

export function identifyUser(userId: string, role?: Role | string | null) {
  if (typeof window === "undefined" || !isPosthogEnabled() || !userId) {
    return;
  }
  const parsed = parseRole(role);
  if (parsed) {
    posthog.identify(userId, { role: parsed });
    return;
  }
  posthog.identify(userId);
}

export function resetUser() {
  if (typeof window === "undefined" || !isPosthogEnabled()) {
    return;
  }
  posthog.reset();
}

export function captureException(error: unknown) {
  if (typeof window === "undefined" || !isPosthogEnabled()) {
    return;
  }
  posthog.captureException(error);
}

export function PostHogIdentify({
  userId,
  role,
}: {
  userId?: string | null;
  role?: string | null;
}) {
  useEffect(() => {
    if (userId) {
      identifyUser(userId, role);
    }
  }, [userId, role]);
  return null;
}
