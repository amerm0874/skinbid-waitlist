import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { EmptyState } from "@/components/ui";
import { Tap, Reveal } from "@/components/animated";
import { Colors, Radius, Spacing, TAB_BAR_CLEARANCE } from "@/constants/theme";
import { useSession } from "@/lib/session";
import { fetchNotifications, markNotificationRead } from "@/lib/queries";
import type { NoticeRow } from "@/lib/types";

export default function NotificationsScreen() {
  const { user } = useSession();
  const [items, setItems] = useState<NoticeRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const rows = await fetchNotifications(user.id);
    setItems(rows);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onPress(item: NoticeRow) {
    if (!item.read_at) {
      await markNotificationRead(item.id);
      setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row)));
    }
    if (item.href.startsWith("/e/")) {
      router.push(`/event/${item.href.replace("/e/", "")}`);
    } else if (item.href.startsWith("/proof/")) {
      router.push(item.href as never);
    }
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: Spacing.four, paddingBottom: TAB_BAR_CLEARANCE, gap: Spacing.two, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accent} />}
        ListEmptyComponent={
          <EmptyState
            icon="notifications-outline"
            title="All quiet"
            body="Bids, outbids, and wins land here the moment they happen."
          />
        }
        renderItem={({ item, index }) => (
          <Reveal index={index}>
            <Tap
              haptic={false}
              onPress={() => onPress(item)}
              style={[styles.row, { backgroundColor: item.read_at ? "transparent" : Colors.backgroundElement }]}
            >
              {!item.read_at ? <View style={styles.dot} /> : null}
              <View style={{ flex: 1, gap: Spacing.half }}>
                <ThemedText type="smallBold">{item.title}</ThemedText>
                <ThemedText type="small" color="textSecondary">
                  {item.body}
                </ThemedText>
              </View>
            </Tap>
          </Reveal>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent, marginTop: 6 },
});
