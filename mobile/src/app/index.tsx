import { useEffect } from "react";
import { ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { useSession } from "@/lib/session";
import { Colors } from "@/constants/theme";

// Ported from the web app's lib/config.ts destinationAfterAuth(): no session
// -> login, incomplete profile -> onboarding, athlete -> Me tab, brand ->
// Events tab.
export default function IndexGate() {
  const { loading, session, destination } = useSession();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/(auth)/login");
      return;
    }
    if (destination === "onboarding") {
      router.replace("/onboarding");
      return;
    }
    router.replace(destination === "me" ? "/(tabs)/me" : "/(tabs)/events");
  }, [loading, session, destination]);

  return (
    <ThemedView style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={Colors.accent} />
    </ThemedView>
  );
}
