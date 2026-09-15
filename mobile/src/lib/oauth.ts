// Google sign-in, matching the web app's lib/auth-client.ts continueWithGoogle
// flow but using Supabase's documented Expo OAuth pattern (in-app browser +
// deep-link redirect) instead of a `/auth/callback` HTTP route.
//
// Requires the redirect URL below to be added in the Supabase dashboard under
// Authentication → URL Configuration → Redirect URLs. See mobile/README.md.

import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);
  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) return null;
  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
  return data.session;
}

export async function signInWithGoogle() {
  const redirectTo = Linking.createURL("auth/callback");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
  });
  if (error) throw error;
  if (!data.url) throw new Error("Could not start Google sign-in.");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === "success" && result.url) {
    return createSessionFromUrl(result.url);
  }
  if (result.type === "cancel" || result.type === "dismiss") {
    return null;
  }
  throw new Error("Google sign-in did not complete.");
}
