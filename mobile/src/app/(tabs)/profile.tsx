import { Image, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Divider } from "@/components/ui";
import { GlassSurface } from "@/components/glass";
import { Tap } from "@/components/animated";
import { Colors, Radius, Spacing, TAB_BAR_CLEARANCE } from "@/constants/theme";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

function Row({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Tap
      haptic={false}
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: Spacing.three, paddingVertical: Spacing.three }}
    >
      <Ionicons name={icon} size={20} color={Colors.textSecondary} />
      <ThemedText style={{ flex: 1 }}>{label}</ThemedText>
      <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
    </Tap>
  );
}

export default function ProfileScreen() {
  const { user, profile } = useSession();

  async function onSignOut() {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  }

  const avatarUrl = profile?.photo_url || profile?.logo_url;

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.four, paddingBottom: TAB_BAR_CLEARANCE, gap: Spacing.four }}>
        <GlassSurface style={{ flexDirection: "row", alignItems: "center", gap: Spacing.three, padding: Spacing.four }}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={{ width: 64, height: 64, borderRadius: Radius.lg }} />
          ) : (
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: Radius.lg,
                backgroundColor: Colors.backgroundSelected,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ThemedText type="title">{(profile?.name ?? "?").slice(0, 1).toUpperCase()}</ThemedText>
            </View>
          )}
          <View style={{ gap: Spacing.half, flex: 1 }}>
            <ThemedText type="subtitle" numberOfLines={1}>
              {profile?.name || "Your profile"}
            </ThemedText>
            <ThemedText type="small" color="textSecondary" numberOfLines={1}>
              {user?.email} · {profile?.role === "athlete" ? "Athlete" : "Brand"}
            </ThemedText>
          </View>
        </GlassSurface>

        <View style={{ backgroundColor: Colors.backgroundElement, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border }}>
          <View style={{ paddingHorizontal: Spacing.three }}>
            <Row icon="person" label="Edit profile" onPress={() => router.push("/settings")} />
            <Divider />
            {profile?.role === "athlete" ? (
              <>
                <Row icon="mail" label="Get us to pitch a brand for you" onPress={() => router.push("/outreach")} />
                <Divider />
              </>
            ) : null}
            <Row icon="shield-checkmark" label="Admin tools" onPress={() => router.push("/admin")} />
            <Divider />
            <Row icon="information-circle" label="About SkinBid" onPress={() => router.push("/about")} />
            <Divider />
            <Row icon="call" label="Contact" onPress={() => router.push("/contact")} />
            <Divider />
            <Row icon="document-text" label="Privacy" onPress={() => router.push("/privacy")} />
            <Divider />
            <Row icon="document" label="Terms" onPress={() => router.push("/terms")} />
          </View>
        </View>

        <Tap onPress={onSignOut} style={{ alignItems: "center", padding: Spacing.three }}>
          <ThemedText type="smallBold" color="danger">
            Sign out
          </ThemedText>
        </Tap>
      </ScrollView>
    </ThemedView>
  );
}
