import { Linking, ScrollView, View } from "react-native";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { SITE } from "@/lib/config";

export default function ContactScreen() {
  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.three }}>
        <ThemedText type="display">Contact</ThemedText>
        <ThemedText color="textSecondary">
          One inbox. Athletes, brands, press, and privacy requests all go here.
        </ThemedText>
        <ThemedText type="subtitle" color="accent" onPress={() => Linking.openURL(`mailto:${SITE.email}`)}>
          {SITE.email}
        </ThemedText>
        <ThemedText type="small" color="textSecondary">
          Say if you are an athlete or a brand. Include the event name and date if you have one. We read every mail. We
          do not take phone calls yet.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}
