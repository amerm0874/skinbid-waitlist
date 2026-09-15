import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ThemedText } from "@/components/themed-text";
import { Tap } from "@/components/animated";
import { Colors, Radius, Shadow, Spacing } from "@/constants/theme";
import { formatOfficialDate, type OfficialEvent } from "@/lib/official-events";

export function RaceRow({ race }: { race: OfficialEvent }) {
  return (
    <Tap haptic={false} onPress={() => router.push(`/race/${race.starts_on}`)} style={[styles.row, Shadow.card]}>
      <View style={styles.date}>
        <ThemedText type="smallBold" color="accent">
          {formatOfficialDate(race.starts_on).split(" ")[0]}
        </ThemedText>
        <ThemedText type="small" color="textSecondary">
          {formatOfficialDate(race.starts_on).split(" ").slice(1).join(" ")}
        </ThemedText>
      </View>
      <View style={{ flex: 1, gap: Spacing.half }}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {race.name}
        </ThemedText>
        <ThemedText type="small" color="textSecondary" numberOfLines={1}>
          {[race.city, race.country].filter(Boolean).join(", ")} · {race.sport}
          {race.combat_subtype ? ` · ${race.combat_subtype}` : ""}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
    </Tap>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: Spacing.three,
    alignItems: "center",
    backgroundColor: Colors.backgroundElement,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.three,
  },
  date: { width: 56, alignItems: "center" },
});
