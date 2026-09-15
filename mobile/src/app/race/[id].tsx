import { useEffect, useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Stack, useLocalSearchParams } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Button, EmptyState } from "@/components/ui";
import { LiveSlotCard } from "@/components/live-slot-card";
import { Reveal } from "@/components/animated";
import { Spacing } from "@/constants/theme";
import { fetchLiveSlotCards, fetchOfficialEventByStartsOn, type LiveSlotCard as LiveSlotCardData } from "@/lib/queries";
import { formatOfficialDate, raceForListing, type OfficialEvent } from "@/lib/official-events";

export default function RaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [race, setRace] = useState<OfficialEvent | null | undefined>(undefined);
  const [listings, setListings] = useState<LiveSlotCardData[]>([]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [raceRow, live] = await Promise.all([fetchOfficialEventByStartsOn(id), fetchLiveSlotCards()]);
      setRace(raceRow);
      if (raceRow) {
        setListings(live.filter((card) => raceForListing(card, [raceRow])));
      }
    })();
  }, [id]);

  if (race === undefined) return null;
  if (race === null) {
    return (
      <ThemedView style={{ flex: 1 }}>
        <EmptyState icon="flag-outline" title="Can't find that race" body="It may not be in the catalog yet." />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: race.name }} />
      <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.three }}>
        <Animated.View entering={FadeInDown.duration(350)} style={{ gap: Spacing.one }}>
          <ThemedText type="display">{race.name}</ThemedText>
          <ThemedText type="small" color="textSecondary">
            {formatOfficialDate(race.starts_on)} · {[race.city, race.country].filter(Boolean).join(", ")}
          </ThemedText>
          {race.combat_subtype ? (
            <ThemedText type="small" color="textSecondary">
              {race.combat_subtype}
            </ThemedText>
          ) : null}
        </Animated.View>

        <Button title="Official race page ↗" variant="outline" onPress={() => Linking.openURL(race.official_url)} />

        <ThemedText type="title">Athletes racing here</ThemedText>
        {listings.length === 0 ? (
          <EmptyState icon="body-outline" title="No one's listed yet" body="Be the first athlete to put a slot up for this race." />
        ) : (
          <View style={{ gap: Spacing.two }}>
            {listings.map((card, index) => (
              <Reveal index={index} key={card.id}>
                <LiveSlotCard card={card} />
              </Reveal>
            ))}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}
