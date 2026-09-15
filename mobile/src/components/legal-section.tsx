import { View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";

export function LegalSection({ title, children }: { title: string; children: string }) {
  return (
    <View style={{ gap: Spacing.one }}>
      <ThemedText type="subtitle">{title}</ThemedText>
      <ThemedText color="textSecondary">{children}</ThemedText>
    </View>
  );
}
