import { StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { GlassSurface } from "@/components/glass";
import { Colors } from "@/constants/theme";

// A floating, translucent tab bar (real Liquid Glass on iOS 26, a blur
// elsewhere) instead of an opaque bottom bar — the current native pattern.
// Screens add bottom padding (see TAB_BAR_CLEARANCE) so content never sits
// under the glass.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        headerShadowVisible: false,
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => <GlassSurface style={StyleSheet.absoluteFill} />,
        tabBarItemStyle: { borderRadius: 999 },
      }}
    >
      <Tabs.Screen
        name="events"
        options={{
          title: "Browse",
          headerTitle: "SkinBid",
          tabBarIcon: ({ color, size }) => <Ionicons name="flash" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: "Me",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Alerts",
          tabBarIcon: ({ color, size }) => <Ionicons name="notifications" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    height: 64,
    borderRadius: 32,
    borderTopWidth: 0,
    backgroundColor: "transparent",
    elevation: 0,
  },
});
