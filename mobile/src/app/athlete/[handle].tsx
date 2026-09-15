import { useEffect, useState } from "react";
import { Image, Linking, ScrollView, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Button, Card, EmptyState } from "@/components/ui";
import { GlassSurface } from "@/components/glass";
import { Colors, Spacing } from "@/constants/theme";
import { fetchAthleteByHandle, type PublicAthlete } from "@/lib/queries";
import { centsToUsd } from "@/lib/money";
import { publicSocialLinks } from "@/lib/socials";

export default function AthletePublicProfile() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const [athlete, setAthlete] = useState<PublicAthlete | null | undefined>(undefined);

  useEffect(() => {
    if (!handle) return;
    fetchAthleteByHandle(handle).then(setAthlete);
  }, [handle]);

  if (athlete === undefined) return null;
  if (athlete === null) {
    return (
      <ThemedView style={{ flex: 1 }}>
        <EmptyState icon="person-outline" title="Can't find that athlete" body="The link might be off, or the profile's gone private." />
      </ThemedView>
    );
  }

  const socials = publicSocialLinks(athlete.socials, athlete.social);

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: athlete.name }} />
      <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.three }}>
        <Animated.View entering={FadeIn.duration(350)} style={{ alignItems: "center", gap: Spacing.two }}>
          {athlete.photoUrl ? (
            <Animated.Image
              entering={ZoomIn.duration(400)}
              source={{ uri: athlete.photoUrl }}
              style={{ width: 96, height: 96, borderRadius: 48 }}
            />
          ) : (
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                backgroundColor: Colors.backgroundElement,
                borderWidth: 1,
                borderColor: Colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ThemedText type="display">{athlete.name.slice(0, 1).toUpperCase()}</ThemedText>
            </View>
          )}
          <ThemedText type="display">{athlete.name}</ThemedText>
          <ThemedText type="small" color="textSecondary">
            {[athlete.sport, athlete.country].filter(Boolean).join(" · ")}
          </ThemedText>
        </Animated.View>

        {socials.length > 0 ? (
          <View style={{ flexDirection: "row", gap: Spacing.three, justifyContent: "center", flexWrap: "wrap" }}>
            {socials.map((social) => (
              <Button key={social.href} title={social.label} variant="outline" onPress={() => Linking.openURL(social.href)} />
            ))}
          </View>
        ) : null}

        {athlete.liveEvent ? (
          <GlassSurface style={{ padding: Spacing.four, gap: Spacing.two }}>
            <ThemedText type="subtitle">{athlete.liveEvent.name}</ThemedText>
            <ThemedText type="small" color="textSecondary">
              {new Date(athlete.liveEvent.date).toLocaleDateString()} {athlete.liveEvent.city ? `· ${athlete.liveEvent.city}` : ""}
            </ThemedText>
            <ThemedText type="small" color="accent">
              {athlete.liveEvent.slotLabel} from {centsToUsd(athlete.liveEvent.slotCents)} · {athlete.liveEvent.openCount} open
            </ThemedText>
            <Button title="View event" onPress={() => router.push(`/event/${athlete.liveEvent!.slug}`)} />
          </GlassSurface>
        ) : (
          <EmptyState icon="calendar-outline" title="Nothing live right now" body="Check back when this athlete lists their next race." />
        )}
      </ScrollView>
    </ThemedView>
  );
}
