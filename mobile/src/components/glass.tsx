import { Platform, StyleSheet, View, type ViewProps } from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { Colors, Radius } from "@/constants/theme";

/**
 * A translucent surface: real iOS 26 Liquid Glass where the OS supports it,
 * a blur everywhere else on iOS/Android, and a tinted solid as the final
 * fallback (old Android, web). Used sparingly — headers, tab bar, and a
 * couple of hero cards — per the "don't overuse blur" rule.
 */
export function GlassSurface({ children, style, tint = "dark", ...rest }: ViewProps & { tint?: "dark" | "light" }) {
  if (Platform.OS === "ios" && isLiquidGlassAvailable()) {
    return (
      <GlassView glassEffectStyle="regular" style={[styles.base, style]} {...rest}>
        {children}
      </GlassView>
    );
  }
  if (Platform.OS === "ios" || Platform.OS === "android") {
    return (
      <View style={[styles.base, styles.fallbackTint, style]} {...rest}>
        <BlurView intensity={40} tint={tint} style={StyleSheet.absoluteFill} />
        {children}
      </View>
    );
  }
  return (
    <View style={[styles.base, styles.fallbackTint, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: Radius.lg, overflow: "hidden" },
  fallbackTint: { backgroundColor: "rgba(21,21,22,0.72)", borderWidth: 1, borderColor: Colors.border },
});
