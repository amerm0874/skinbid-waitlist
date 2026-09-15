import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type ViewProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Shadow, Spacing } from "@/constants/theme";
import { ThemedText } from "@/components/themed-text";
import { Tap } from "@/components/animated";

export function Screen({ children, scroll = true, style }: { children: React.ReactNode; scroll?: boolean; style?: ViewProps["style"] }) {
  const Container = scroll ? ScrollView : View;
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <Container
        style={scroll ? undefined : [styles.body, style]}
        contentContainerStyle={scroll ? [styles.body, style] : undefined}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </Container>
    </SafeAreaView>
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled,
  style,
  ...rest
}: PressableProps & { title: string; variant?: "primary" | "outline" | "ghost"; loading?: boolean }) {
  const isDisabled = disabled || loading;
  return (
    <Tap
      onPress={onPress}
      disabled={isDisabled}
      haptic={variant === "primary"}
      style={[
        styles.button,
        variant === "primary" && styles.buttonPrimary,
        variant === "outline" && styles.buttonOutline,
        variant === "ghost" && styles.buttonGhost,
        isDisabled && styles.buttonDisabled,
        style as object,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? Colors.accentInk : Colors.accent} />
      ) : (
        <ThemedText
          type="smallBold"
          color={variant === "primary" ? "accentInk" : "accent"}
          style={variant === "ghost" ? { color: Colors.text } : undefined}
        >
          {title}
        </ThemedText>
      )}
    </Tap>
  );
}

export function Card({ style, ...rest }: ViewProps) {
  return <View style={[styles.card, Shadow.card, style]} {...rest} />;
}

export function TextField({
  label,
  error,
  style,
  ...rest
}: TextInputProps & { label?: string; error?: string | null }) {
  return (
    <View style={styles.fieldGroup}>
      {label ? (
        <ThemedText type="small" color="textSecondary" style={styles.fieldLabel}>
          {label}
        </ThemedText>
      ) : null}
      <TextInput
        placeholderTextColor={Colors.textSecondary}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
      />
      {error ? (
        <ThemedText type="small" color="danger" style={{ marginTop: Spacing.one }}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

export function Pill({ label, tone = "default" }: { label: string; tone?: "default" | "accent" | "danger" | "success" }) {
  return (
    <View
      style={[
        styles.pill,
        tone === "accent" && { backgroundColor: Colors.accent, borderColor: Colors.accent },
        tone === "danger" && { backgroundColor: "rgba(255,107,94,0.14)", borderColor: "rgba(255,107,94,0.4)" },
        tone === "success" && { backgroundColor: "rgba(127,224,168,0.14)", borderColor: "rgba(127,224,168,0.4)" },
      ]}
    >
      <ThemedText
        type="small"
        color={tone === "accent" ? "accentInk" : tone === "danger" ? "danger" : tone === "success" ? "success" : "textSecondary"}
      >
        {label}
      </ThemedText>
    </View>
  );
}

export function EmptyState({
  title,
  body,
  icon = "sparkles-outline",
  cta,
}: {
  title: string;
  body?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  cta?: { title: string; onPress: () => void };
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={28} color={Colors.accent} />
      </View>
      <ThemedText type="subtitle" style={{ textAlign: "center" }}>
        {title}
      </ThemedText>
      {body ? (
        <ThemedText type="small" color="textSecondary" style={{ textAlign: "center", maxWidth: 280 }}>
          {body}
        </ThemedText>
      ) : null}
      {cta ? (
        <View style={{ marginTop: Spacing.two }}>
          <Button title={cta.title} onPress={cta.onPress} />
        </View>
      ) : null}
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  body: { padding: Spacing.four, gap: Spacing.four, flexGrow: 1 },
  button: {
    height: 50,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.four,
  },
  buttonPrimary: { backgroundColor: Colors.accent, ...Shadow.accentGlow },
  buttonOutline: { borderWidth: 1, borderColor: Colors.border, backgroundColor: "transparent" },
  buttonGhost: { backgroundColor: "transparent" },
  buttonDisabled: { opacity: 0.5 },
  card: {
    backgroundColor: Colors.backgroundElement,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  fieldGroup: { gap: Spacing.one },
  fieldLabel: { marginBottom: Spacing.half },
  input: {
    height: 50,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundElement,
    paddingHorizontal: Spacing.three,
    color: Colors.text,
    fontSize: 16,
  },
  inputError: { borderColor: Colors.danger },
  pill: {
    alignSelf: "flex-start",
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.five, gap: Spacing.two },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(200,242,78,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.one,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
});
