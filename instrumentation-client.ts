import { initPosthog } from "@/lib/analytics";

try {
  initPosthog();
} catch (error) {
  console.log("PostHog client init failed", error);
}
