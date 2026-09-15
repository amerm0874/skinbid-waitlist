// A handful of flows are deliberately NOT reimplemented natively: placing a
// paid bid (creates a Whop checkout using a server-side secret key), admin
// proof review (triggers payouts + refunds via the service-role key), and
// outreach emails (sent via Resend from the server). Duplicating that logic
// in a mobile client would mean shipping secrets to a phone, or silently
// diverging from the site's business logic. Instead those actions open the
// same signed-in flow on the live site in an in-app browser.
//
// See mobile/README.md for the full list and the reasoning.

import * as WebBrowser from "expo-web-browser";
import { SITE } from "@/lib/config";

export async function openOnWeb(path: string) {
  const url = `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
  await WebBrowser.openBrowserAsync(url);
}
