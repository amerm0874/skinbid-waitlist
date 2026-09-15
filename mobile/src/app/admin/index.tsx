import { View } from "react-native";
import { router } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { openOnWeb } from "@/lib/webActions";

// Proof approval/rejection triggers payouts and refunds via the service-role
// key (app/api/admin/route.ts) — that logic stays server-side, so this hands
// off to the web dashboard, which the site still gates by ADMIN_EMAILS.
export default function AdminScreen() {
  return (
    <ThemedView style={{ flex: 1, padding: Spacing.four, gap: Spacing.three, justifyContent: "center" }}>
      <ThemedText type="display">Admin tools</ThemedText>
      <ThemedText color="textSecondary">
        Proof review, payouts, and the waitlist inbox live on the web dashboard, which checks your email against the
        admin list.
      </ThemedText>
      <Button title="Open admin dashboard" onPress={() => openOnWeb("/admin")} />
      <Button title="Waitlist inbox" variant="outline" onPress={() => router.push("/admin/inbox")} />
    </ThemedView>
  );
}
