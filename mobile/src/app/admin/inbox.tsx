import { View } from "react-native";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { openOnWeb } from "@/lib/webActions";

export default function AdminInboxScreen() {
  return (
    <ThemedView style={{ flex: 1, padding: Spacing.four, gap: Spacing.three, justifyContent: "center" }}>
      <ThemedText type="display">Waitlist inbox</ThemedText>
      <ThemedText color="textSecondary">Raw waitlist signups, viewable on the web (admin-only).</ThemedText>
      <Button title="Open on skinbid.me" onPress={() => openOnWeb("/inbox")} />
    </ThemedView>
  );
}
