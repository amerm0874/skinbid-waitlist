import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { ThemedText } from "@/components/themed-text";
import { TextField } from "@/components/ui";

export function SelectField({
  label,
  value,
  placeholder = "Select...",
  options,
  onChange,
  searchable = false,
  error,
}: {
  label?: string;
  value: string | null;
  placeholder?: string;
  options: readonly string[];
  onChange: (value: string) => void;
  searchable?: boolean;
  error?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((option) => option.toLowerCase().includes(q));
  }, [options, query, searchable]);

  return (
    <View style={styles.fieldGroup}>
      {label ? (
        <ThemedText type="small" color="textSecondary">
          {label}
        </ThemedText>
      ) : null}
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.trigger, error ? { borderColor: Colors.danger } : null]}
      >
        <ThemedText color={value ? "text" : "textSecondary"}>{value || placeholder}</ThemedText>
      </Pressable>
      {error ? (
        <ThemedText type="small" color="danger">
          {error}
        </ThemedText>
      ) : null}

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <ThemedText type="title">{label ?? "Select"}</ThemedText>
            <Pressable onPress={() => setOpen(false)}>
              <ThemedText type="link">Done</ThemedText>
            </Pressable>
          </View>
          {searchable ? (
            <View style={{ paddingHorizontal: Spacing.four }}>
              <TextField placeholder="Search..." value={query} onChangeText={setQuery} autoFocus />
            </View>
          ) : null}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item}
            contentContainerStyle={{ padding: Spacing.four, gap: Spacing.one }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange(item);
                  setOpen(false);
                  setQuery("");
                }}
                style={[styles.option, item === value && { backgroundColor: Colors.backgroundSelected }]}
              >
                <ThemedText color={item === value ? "accent" : "text"}>{item}</ThemedText>
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldGroup: { gap: Spacing.one },
  trigger: {
    height: 48,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundElement,
    paddingHorizontal: Spacing.three,
    justifyContent: "center",
  },
  modal: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.four,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  option: { paddingVertical: Spacing.three, paddingHorizontal: Spacing.three, borderRadius: Radius.sm },
});
