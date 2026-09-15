import { View } from "react-native";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { openOnWeb } from "@/lib/webActions";

// Sending the outreach email happens server-side via Resend
// (app/api/outreach/route.ts) — no secret key belongs in this client, so this
// screen hands off to the same signed-in flow on the web.
export default function OutreachScreen() {
  return (
    <ThemedView style={{ flex: 1, padding: Spacing.four, gap: Spacing.three, justifyContent: "center" }}>
      <ThemedText type="display">Ask us to reach a brand</ThemedText>
      <ThemedText color="textSecondary">
        Tell us the brand and your event, and we'll send a cold email on your behalf. This form lives on the web for
        now.
      </ThemedText>
      <Button title="Open on skinbid.me" onPress={() => openOnWeb("/outreach")} />
    </ThemedView>
  );
}
