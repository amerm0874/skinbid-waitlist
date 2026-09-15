import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Button, Card, EmptyState, Pill } from "@/components/ui";
import { LiveSlotCard } from "@/components/live-slot-card";
import { GlassSurface } from "@/components/glass";
import { Reveal } from "@/components/animated";
import { Colors, Spacing, TAB_BAR_CLEARANCE } from "@/constants/theme";
import { useSession } from "@/lib/session";
import { fetchLiveSlotCards, fetchMyBids, fetchMyEvent, type LiveSlotCard as LiveSlotCardData } from "@/lib/queries";
import { ZONE_LABEL, type ZoneName } from "@/lib/zones";
import { centsToUsd } from "@/lib/money";
import { isAuctionClosed } from "@/lib/auction";

type MyEvent = Awaited<ReturnType<typeof fetchMyEvent>>;
type MyBid = Awaited<ReturnType<typeof fetchMyBids>>[number];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "Still up";
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}

export default function MeScreen() {
  const { user, profile } = useSession();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myEvent, setMyEvent] = useState<MyEvent>(null);
  const [myBids, setMyBids] = useState<MyBid[]>([]);
  const [suggested, setSuggested] = useState<LiveSlotCardData[]>([]);

  const load = useCallback(async () => {
    if (!user || !profile) return;
    if (profile.role === "athlete") {
      const event = await fetchMyEvent(user.id);
      setMyEvent(event);
    } else {
      const [bids, live] = await Promise.all([fetchMyBids(user.id), fetchLiveSlotCards()]);
      setMyBids(bids);
      setSuggested(live.slice(0, 6));
    }
    setLoading(false);
    setRefreshing(false);
  }, [user, profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!profile) return null;

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.four, paddingBottom: TAB_BAR_CLEARANCE, gap: Spacing.three }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accent} />}
      >
        <View style={{ gap: Spacing.half }}>
          <ThemedText type="small" color="textSecondary">
            {greeting()}
          </ThemedText>
          <ThemedText type="display">{profile.name?.split(" ")[0] || "there"}</ThemedText>
        </View>

        {profile.role === "athlete" ? (
          <AthleteDashboard event={myEvent} loading={loading} />
        ) : (
          <BrandDashboard bids={myBids} suggested={suggested} loading={loading} />
        )}
      </ScrollView>
    </ThemedView>
  );
}

function AthleteDashboard({ event, loading }: { event: MyEvent; loading: boolean }) {
  if (loading) return null;

  if (!event) {
    return (
      <EmptyState
        icon="add-circle-outline"
        title="Your body's still ad-free"
        body="Pick a date, open your slots, and brands can start bidding within minutes."
        cta={{ title: "List your race", onPress: () => router.push("/new") }}
      />
    );
  }

  const zones = (event.zones ?? []) as Array<{ id: string; name: string; status: string }>;
  const openZones = zones.filter((zone) => zone.status === "open").length;
  const closed = isAuctionClosed(event.date);

  return (
    <View style={{ gap: Spacing.three }}>
      <GlassSurface style={{ padding: Spacing.four, gap: Spacing.two }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1, gap: Spacing.half }}>
            <ThemedText type="subtitle">{event.name}</ThemedText>
            <ThemedText type="small" color="textSecondary">
              {new Date(event.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              {event.city ? ` · ${event.city}` : ""} · {openZones} of {zones.length} zones open
            </ThemedText>
          </View>
          <Pill
            label={event.status === "live" ? "Live" : event.status === "draft" ? "Draft" : event.status}
            tone={event.status === "live" ? "success" : "default"}
          />
        </View>
        <Button title="View event page" variant="outline" onPress={() => router.push(`/event/${event.slug}`)} />
        {closed && event.status === "live" ? (
          <Button title="Upload proof, get paid" onPress={() => router.push(`/proof/${event.id}`)} />
        ) : null}
      </GlassSurface>

      <ThemedText type="title">Your zones</ThemedText>
      <View style={{ gap: Spacing.two }}>
        {zones.map((zone, index) => (
          <Reveal index={index} key={zone.id}>
            <Card style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <ThemedText type="smallBold">{ZONE_LABEL[zone.name as ZoneName] ?? zone.name}</ThemedText>
              <Pill label={zone.status === "open" ? "Open" : "Closed"} tone={zone.status === "open" ? "accent" : "default"} />
            </Card>
          </Reveal>
        ))}
      </View>
    </View>
  );
}

function BrandDashboard({ bids, suggested, loading }: { bids: MyBid[]; suggested: LiveSlotCardData[]; loading: boolean }) {
  if (loading) return null;

  if (bids.length === 0) {
    return (
      <View style={{ gap: Spacing.three }}>
        <EmptyState
          icon="flash-outline"
          title="No bids on the board yet"
          body="Floor's $100. Find a slot you like and stake your claim."
        />
        {suggested.length > 0 ? (
          <View style={{ gap: Spacing.two }}>
            <ThemedText type="title">Live now</ThemedText>
            {suggested.map((card, index) => (
              <Reveal index={index} key={card.id}>
                <LiveSlotCard card={card} />
              </Reveal>
            ))}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ gap: Spacing.two }}>
      {bids.map((bid: any, index) => (
        <Reveal index={index} key={bid.id}>
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <ThemedText type="smallBold">{bid.zones?.events?.name ?? "Event"}</ThemedText>
              <Pill
                label={bid.status === "held" ? "Holding" : bid.status[0].toUpperCase() + bid.status.slice(1)}
                tone={bid.status === "won" || bid.status === "held" ? "success" : bid.status === "refunded" ? "danger" : "default"}
              />
            </View>
            <ThemedText type="small" color="textSecondary">
              {ZONE_LABEL[bid.zones?.name as ZoneName] ?? bid.zones?.name} · {centsToUsd(bid.amount_cents)}
            </ThemedText>
            {bid.zones?.events?.slug ? (
              <Button title="View event" variant="outline" onPress={() => router.push(`/event/${bid.zones.events.slug}`)} />
            ) : null}
          </Card>
        </Reveal>
      ))}
    </View>
  );
}
