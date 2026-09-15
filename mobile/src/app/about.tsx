import { ScrollView, View } from "react-native";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";

// Ported verbatim (copy) from the web app's app/about/page.tsx.
const STEPS = [
  { title: "List the event", body: "Date, photo, slots. Any sport. You close slots you cannot sell." },
  { title: "Brand pays SkinBid", body: "Money is held. Not sent to you yet. Auction only. Floor $100." },
  { title: "Wear it on the day", body: "Temp tattoo in the bought slot. One day. Then it comes off." },
  { title: "Proof, then payout", body: "Photos. We check. You get paid. Fail the proof, brand is refunded." },
];

export default function AboutScreen() {
  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.four }}>
        <View style={{ gap: Spacing.two }}>
          <ThemedText type="display">Your next race already has ad space.</ThemedText>
          <ThemedText color="textSecondary">
            List logo slots on your body. Brands pay SkinBid. You wear a temp tattoo for one day.
          </ThemedText>
        </View>

        <View style={{ gap: Spacing.three }}>
          <ThemedText type="title">Four steps. No pitch deck.</ThemedText>
          {STEPS.map((step, index) => (
            <View key={step.title} style={{ gap: Spacing.half }}>
              <ThemedText type="code" color="accent">
                {String(index + 1).padStart(2, "0")}
              </ThemedText>
              <ThemedText type="subtitle">{step.title}</ThemedText>
              <ThemedText color="textSecondary">{step.body}</ThemedText>
            </View>
          ))}
        </View>
      </ScrollView>
    </ThemedView>
  );
}
