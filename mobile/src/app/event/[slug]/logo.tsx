import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Button, Card, EmptyState } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { openOnWeb } from "@/lib/webActions";
import { MARK_KIND_LABEL, isMarkKind } from "@/lib/logo";
import { ZONE_LABEL, type ZoneName } from "@/lib/zones";

type WonBid = {
  id: string;
  amount_cents: number;
  logo_url: string | null;
  mark_kind: string | null;
  post_rules: string | null;
  zones: { name: string } | null;
};

export default function EventLogoScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { user } = useSession();
  const [bids, setBids] = useState<WonBid[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user || !slug) return;
      const { data: event } = await supabase.from("events").select("id").eq("slug", slug).maybeSingle();
      if (!event) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("bids")
        .select("id, amount_cents, logo_url, mark_kind, post_rules, zones!inner(name, event_id)")
        .eq("brand_id", user.id)
        .eq("zones.event_id", event.id)
        .in("status", ["held", "won"]);
      setBids((data ?? []) as unknown as WonBid[]);
      setLoading(false);
    })();
  }, [user, slug]);

  if (loading) return null;

  if (bids.length === 0) {
    return <EmptyState title="No won zones here" body="This screen is for a zone you've won on this event." />;
  }

  return (
    <ThemedView style={{ flex: 1, padding: Spacing.four, gap: Spacing.three }}>
      <ThemedText type="small" color="textSecondary">
        Uploading your PNG mark and post rules is done on the web for now — the upload and moderation checks live there.
      </ThemedText>
      <View style={{ gap: Spacing.two }}>
        {bids.map((bid) => (
          <Card key={bid.id}>
            <ThemedText type="smallBold">{ZONE_LABEL[bid.zones?.name as ZoneName] ?? bid.zones?.name}</ThemedText>
            {bid.logo_url ? (
              <Image source={{ uri: bid.logo_url }} style={{ width: 96, height: 96, borderRadius: 8 }} resizeMode="contain" />
            ) : (
              <ThemedText type="small" color="textSecondary">
                No logo uploaded yet.
              </ThemedText>
            )}
            <ThemedText type="small" color="textSecondary">
              {isMarkKind(bid.mark_kind) ? MARK_KIND_LABEL[bid.mark_kind] : "Not chosen"}
              {bid.post_rules ? ` · "${bid.post_rules}"` : ""}
            </ThemedText>
            <Button title="Upload / edit on skinbid.me" onPress={() => openOnWeb(`/e/${slug}/logo`)} />
          </Card>
        ))}
      </View>
    </ThemedView>
  );
}
