import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Colors } from "@/constants/theme";
import { SessionProvider } from "@/lib/session";

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
          headerTitleStyle: { color: Colors.text },
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ title: "Set up your profile", headerBackVisible: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="event/[slug]/index" options={{ title: "Event" }} />
        <Stack.Screen name="event/[slug]/logo" options={{ title: "Your mark" }} />
        <Stack.Screen name="athlete/[handle]" options={{ title: "Athlete" }} />
        <Stack.Screen name="race/[id]" options={{ title: "Race" }} />
        <Stack.Screen name="new" options={{ title: "List your race" }} />
        <Stack.Screen name="proof/[id]" options={{ title: "Upload proof" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
        <Stack.Screen name="outreach" options={{ title: "Outreach" }} />
        <Stack.Screen name="admin/index" options={{ title: "Admin" }} />
        <Stack.Screen name="admin/inbox" options={{ title: "Waitlist" }} />
        <Stack.Screen name="about" options={{ title: "About" }} />
        <Stack.Screen name="contact" options={{ title: "Contact" }} />
        <Stack.Screen name="privacy" options={{ title: "Privacy" }} />
        <Stack.Screen name="terms" options={{ title: "Terms" }} />
      </Stack>
    </SessionProvider>
  );
}
