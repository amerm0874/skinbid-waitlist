import { ScrollView, View } from "react-native";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { LegalSection } from "@/components/legal-section";
import { Spacing } from "@/constants/theme";

// Ported verbatim (copy) from the web app's app/terms/page.tsx.
export default function TermsScreen() {
  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.four }}>
        <View style={{ gap: Spacing.one }}>
          <ThemedText type="display">Terms</ThemedText>
          <ThemedText type="small" color="textSecondary">
            Last updated 12 September 2026.
          </ThemedText>
        </View>
        <ThemedText color="textSecondary">
          SkinBid is an auction for a one-day temp mark on an athlete. Use the site and these rules apply.
        </ThemedText>
        <LegalSection title="Auction">Auction only. Floor is $100. Each new bid is $100 more. There is no buy-now.</LegalSection>
        <LegalSection title="Money">
          SkinBid holds the brand's payment until proof is approved. The athlete gets 80%. SkinBid keeps 20%.
        </LegalSection>
        <LegalSection title="Cancel and close">
          Cancel is blocked after a held or won bid. After close, the winner cannot walk.
        </LegalSection>
        <LegalSection title="Age">You must be 18 or older.</LegalSection>
        <LegalSection title="The mark">
          The athlete prints and wears the mark. Two brands in the same category cannot sit on one body for the same
          event.
        </LegalSection>
        <LegalSection title="Likeness">
          A win buys the mark on event day and the proof photos from that day. Reuse of the athlete's face or body in
          other ads is off unless the athlete opted in and you agree a separate price.
        </LegalSection>
        <LegalSection title="Mail">We only email you about SkinBid.</LegalSection>
      </ScrollView>
    </ThemedView>
  );
}
