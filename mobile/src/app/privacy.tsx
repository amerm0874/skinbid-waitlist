import { ScrollView, View } from "react-native";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { LegalSection } from "@/components/legal-section";
import { Spacing } from "@/constants/theme";

// Ported verbatim (copy) from the web app's app/privacy/page.tsx.
export default function PrivacyScreen() {
  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.four }}>
        <View style={{ gap: Spacing.one }}>
          <ThemedText type="display">Privacy</ThemedText>
          <ThemedText type="small" color="textSecondary">
            Last updated 12 September 2026.
          </ThemedText>
        </View>
        <ThemedText color="textSecondary">We keep what we need to run the auction. We do not sell your data.</ThemedText>
        <LegalSection title="Account">
          Name, email, role, and the other fields you give us when you sign up or edit your profile.
        </LegalSection>
        <LegalSection title="Captures and 3D body">
          Photos you upload so we can build the 3D body, and the body file we show on the event page.
        </LegalSection>
        <LegalSection title="Bids">Who bid, how much, and whether the bid was held, won, or refunded.</LegalSection>
        <LegalSection title="Pay">If you are an athlete, we store your PayPal email so we can pay you.</LegalSection>
      </ScrollView>
    </ThemedView>
  );
}
