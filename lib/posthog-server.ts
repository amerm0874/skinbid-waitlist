import { PostHog } from "posthog-node";

let client: PostHog | null | undefined;

function posthogKey() {
  return process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ?? "";
}

function posthogHost() {
  return (
    process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com"
  );
}

function getPostHogServer() {
  const key = posthogKey();
  if (!key) {
    return null;
  }
  if (client) {
    return client;
  }
  client = new PostHog(key, {
    host: posthogHost(),
    flushAt: 1,
    flushInterval: 0,
  });
  return client;
}

export async function captureServerEvent(input: {
  distinctId: string;
  event: string;
  properties?: Record<string, string | number | boolean | null | undefined>;
}) {
  const ph = getPostHogServer();
  if (!ph || !input.distinctId) {
    return;
  }
  const properties: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input.properties ?? {})) {
    if (key.toLowerCase() === "email" || value == null) {
      continue;
    }
    properties[key] = value;
  }
  try {
    ph.capture({
      distinctId: input.distinctId,
      event: input.event,
      properties,
    });
    await ph.flush();
  } catch (error) {
    console.log("PostHog server capture failed", error);
  }
}
