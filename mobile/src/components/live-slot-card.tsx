import { Image, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ThemedText } from "@/components/themed-text";
import { Tap } from "@/components/animated";
import { Colors, Radius, Shadow, Spacing } from "@/constants/theme";
import { centsToUsd } from "@/lib/money";
import type { LiveSlotCard as LiveSlotCardData } from "@/lib/queries";

export function LiveSlotCard({ card }: { card: LiveSlotCardData }) {
  return (
    <Tap haptic={false} onPress={() => router.push(`/event/${card.slug}`)} style={[styles.card, Shadow.card]}>
      {card.photoUrl ? (
        <Image source={{ uri: card.photoUrl }} style={styles.photo} />
      ) : (
        <View style={[styles.photo, styles.photoFallback]}>
          <ThemedText type="title">{card.athleteName.slice(0, 1).toUpperCase()}</ThemedText>
        </View>
      )}
      <View style={{ flex: 1, gap: Spacing.half }}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {card.athleteName}
        </ThemedText>
        <ThemedText type="small" color="textSecondary" numberOfLines={1}>
          {card.raceName}
        </ThemedText>
        <ThemedText type="small" color="accent">
          {card.zoneLabel} · {centsToUsd(card.priceCents)}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
    </Tap>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: Spacing.three,
    alignItems: "center",
    backgroundColor: Colors.backgroundElement,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.three,
  },
  photo: { width: 56, height: 56, borderRadius: Radius.sm, backgroundColor: Colors.backgroundSelected },
  photoFallback: { alignItems: "center", justifyContent: "center" },
});
