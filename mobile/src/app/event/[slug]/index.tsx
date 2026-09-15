import { useCallback, useEffect, useState } from "react";
import { Image, RefreshControl, ScrollView, View } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Button, Card, Pill } from "@/components/ui";
import { GlassSurface } from "@/components/glass";
import { Reveal, Tap } from "@/components/animated";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import { useSession } from "@/lib/session";
import { fetchEventBySlug, fetchZoneBids, type EventDetail, type ZoneBidItem } from "@/lib/queries";
import { ZONE_LABEL, type ZoneName } from "@/lib/zones";
import { centsToUsd, nextBidCents } from "@/lib/money";
import { auctionClosesAt, isAuctionClosed } from "@/lib/auction";
import { openOnWeb } from "@/lib/webActions";

function useCountdown(target: Date | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  if (!target) return null;
  const diff = target.getTime() - now;
  if (diff <= 0) return "00:00:00";
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export default function EventDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { user } = useSession();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedZone, setExpandedZone] = useState<string | null>(null);
  const [zoneBids, setZoneBids] = useState<Record<string, ZoneBidItem[]>>({});

  const load = useCallback(async () => {
    if (!slug) return;
    const data = await fetchEventBySlug(slug);
    setEvent(data);
    setLoading(false);
    setRefreshing(false);
  }, [slug]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const closesAt = event ? auctionClosesAt(event.date) : null;
  const countdown = useCountdown(closesAt);
  const closed = event ? isAuctionClosed(event.date) : false;
  const isOwner = event && user && event.athleteId === user.id;

  async function onExpandZone(zoneId: string) {
    if (expandedZone === zoneId) {
      setExpandedZone(null);
      return;
    }
    setExpandedZone(zoneId);
    if (!zoneBids[zoneId]) {
      const bids = await fetchZoneBids(zoneId);
      setZoneBids((prev) => ({ ...prev, [zoneId]: bids }));
    }
  }

  if (loading) return null;
  if (!event) {
    return (
      <ThemedView style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.four }}>
        <ThemedText type="subtitle">Can't find that event</ThemedText>
        <ThemedText type="small" color="textSecondary" style={{ marginTop: Spacing.one }}>
          It may have been taken down, or the link's off.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: event.name }} />
      <ScrollView
        contentContainerStyle={{ padding: Spacing.four, gap: Spacing.three }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accent} />}
      >
        <View style={{ flexDirection: "row", gap: Spacing.three, alignItems: "center" }}>
          {event.photoUrl ? (
            <Image source={{ uri: event.photoUrl }} style={{ width: 64, height: 64, borderRadius: 14 }} />
          ) : null}
          <View style={{ flex: 1, gap: Spacing.half }}>
            <ThemedText type="title">{event.athleteName}</ThemedText>
            <ThemedText type="small" color="textSecondary">
              {event.name} · {new Date(event.date).toLocaleDateString()} {event.city ? `· ${event.city}` : ""}
            </ThemedText>
          </View>
        </View>

        <GlassSurface style={{ padding: Spacing.four, gap: Spacing.one, alignItems: closed ? "flex-start" : "center" }}>
          <ThemedText type="small" color={closed ? "danger" : "textSecondary"} style={{ textTransform: "uppercase", letterSpacing: 1 }}>
            {closed ? "Bidding closed" : "Closes in"}
          </ThemedText>
          {!closed ? (
            <ThemedText style={{ fontFamily: Fonts?.mono, fontSize: 40, fontWeight: "700", color: Colors.accent, letterSpacing: 1 }}>
              {countdown}
            </ThemedText>
          ) : null}
          <ThemedText type="small" color="textSecondary" style={{ marginTop: Spacing.one }}>
            Floor $100. Held until proof's approved. Athlete keeps 80%.
          </ThemedText>
        </GlassSurface>

        <ThemedText type="title">Zones</ThemedText>
        <View style={{ gap: Spacing.two }}>
          {event.zones.map((zone, index) => {
            const expanded = expandedZone === zone.id;
            return (
              <Reveal index={index} key={zone.id}>
                <Animated.View layout={LinearTransition.duration(220)}>
                  <Card>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <ThemedText type="smallBold">{ZONE_LABEL[zone.name as ZoneName] ?? zone.name}</ThemedText>
                      <Pill label={zone.status === "closed" ? "Closed" : "Open"} tone={zone.status === "closed" ? "default" : "accent"} />
                    </View>
                    <ThemedText type="subtitle" style={{ fontFamily: Fonts?.mono }}>
                      {zone.leadCents ? centsToUsd(zone.leadCents) : "No bids yet"}
                    </ThemedText>
                    {zone.leadStatus === "won" ? (
                      <Pill label="Placement awarded" tone="success" />
                    ) : zone.leadStatus === "held" ? (
                      <Pill label="Leading bid" tone="accent" />
                    ) : null}
                    <Tap
                      haptic={false}
                      onPress={() => onExpandZone(zone.id)}
                      style={{ flexDirection: "row", alignItems: "center", gap: Spacing.one, paddingVertical: Spacing.one }}
                    >
                      <ThemedText type="small" color="accent">
                        {expanded ? "Hide bid history" : "Bid history"}
                      </ThemedText>
                      <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={Colors.accent} />
                    </Tap>
                    {expanded ? (
                      <View style={{ gap: Spacing.one }}>
                        {(zoneBids[zone.id] ?? []).length === 0 ? (
                          <ThemedText type="small" color="textSecondary">
                            No bids yet — be the first.
                          </ThemedText>
                        ) : (
                          zoneBids[zone.id].map((bid) => (
                            <View key={bid.id} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                              <ThemedText type="small">{bid.brandName}</ThemedText>
                              <ThemedText type="small" color="textSecondary">
                                {centsToUsd(bid.amountCents)} · {bid.status}
                              </ThemedText>
                            </View>
                          ))
                        )}
                      </View>
                    ) : null}
                    {!closed && zone.status === "open" && !isOwner ? (
                      <Button
                        title={`Bid ${centsToUsd(nextBidCents(zone.leadCents))} →`}
                        onPress={() => openOnWeb(`/e/${event.slug}`)}
                      />
                    ) : null}
                  </Card>
                </Animated.View>
              </Reveal>
            );
          })}
        </View>

        {isOwner ? (
          <Card>
            <ThemedText type="smallBold">This one's yours</ThemedText>
            <ThemedText type="small" color="textSecondary">
              Open or close zones, check bids, and handle proof from the web dashboard.
            </ThemedText>
            <Button title="Manage on skinbid.me" variant="outline" onPress={() => openOnWeb(`/e/${event.slug}`)} />
          </Card>
        ) : (
          <Button title="Open on skinbid.me" variant="ghost" onPress={() => openOnWeb(`/e/${event.slug}`)} />
        )}
      </ScrollView>
    </ThemedView>
  );
}
