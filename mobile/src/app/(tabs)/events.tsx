import { useCallback, useState } from "react";
import { RefreshControl, SectionList, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { LiveSlotCard } from "@/components/live-slot-card";
import { RaceRow } from "@/components/race-row";
import { EmptyState } from "@/components/ui";
import { Reveal } from "@/components/animated";
import { Colors, Spacing, TAB_BAR_CLEARANCE } from "@/constants/theme";
import { fetchLiveSlotCards, fetchOfficialEvents, type LiveSlotCard as LiveSlotCardData } from "@/lib/queries";
import type { OfficialEvent } from "@/lib/official-events";

type Row = { kind: "live"; id: string; card: LiveSlotCardData } | { kind: "race"; id: string; race: OfficialEvent };
type Section = { title: string; data: Row[] };

export default function EventsScreen() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [live, races] = await Promise.all([fetchLiveSlotCards(), fetchOfficialEvents()]);
    setSections([
      { title: "Live now", data: live.map((card) => ({ kind: "live" as const, id: card.id, card })) },
      {
        title: "Upcoming races",
        data: races.slice(0, 20).map((race) => ({ kind: "race" as const, id: race.starts_on, race })),
      },
    ]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const hasAnyData = sections.some((section) => section.data.length > 0);
  let rowIndex = -1;

  return (
    <ThemedView style={{ flex: 1 }}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: Spacing.four, paddingBottom: TAB_BAR_CLEARANCE, gap: Spacing.two, flexGrow: 1 }}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accent} />}
        renderSectionHeader={({ section }) =>
          section.data.length > 0 ? (
            <ThemedText type="title" style={{ marginTop: Spacing.three, marginBottom: Spacing.two }}>
              {section.title}
            </ThemedText>
          ) : null
        }
        renderItem={({ item }) => {
          rowIndex += 1;
          return (
            <Reveal index={rowIndex} style={{ marginBottom: Spacing.two }}>
              {item.kind === "live" ? <LiveSlotCard card={item.card} /> : <RaceRow race={item.race} />}
            </Reveal>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="flash-outline"
              title={hasAnyData ? "Nothing here yet" : "Nothing's live right now"}
              body="New listings show up here the second an athlete goes live. Pull down to check again."
            />
          ) : null
        }
      />
    </ThemedView>
  );
}
