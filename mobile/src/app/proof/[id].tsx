import { useState } from "react";
import { Image, ScrollView, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Button, Card, TextField } from "@/components/ui";
import { Reveal, SuccessCheck } from "@/components/animated";
import { Spacing } from "@/constants/theme";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { pickImage } from "@/lib/uploads";

const SLOTS = [
  { key: "zone-1", label: "Zone photo 1" },
  { key: "zone-2", label: "Zone photo 2" },
  { key: "venue", label: "Venue photo" },
] as const;

type SlotKey = (typeof SLOTS)[number]["key"];

export default function ProofUploadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const [assets, setAssets] = useState<Partial<Record<SlotKey, ImagePicker.ImagePickerAsset>>>({});
  const [postUrl, setPostUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function onPick(slot: SlotKey) {
    const asset = await pickImage({ allowsEditing: true });
    if (asset) setAssets((prev) => ({ ...prev, [slot]: asset }));
  }

  async function onSubmit() {
    if (!user || !id) return;
    setError(null);
    const missing = SLOTS.filter((slot) => !assets[slot.key]);
    if (missing.length > 0) {
      setError(`Add a photo for: ${missing.map((slot) => slot.label).join(", ")}.`);
      return;
    }
    setSaving(true);
    try {
      const paths: string[] = [];
      for (const slot of SLOTS) {
        const asset = assets[slot.key]!;
        const ext = asset.mimeType?.includes("png") ? "png" : "jpg";
        const path = `${user.id}/${id}/${slot.key}.${ext}`;
        const response = await fetch(asset.uri);
        const bytes = await response.arrayBuffer();
        const { error: uploadError } = await supabase.storage.from("proofs").upload(path, bytes, {
          contentType: asset.mimeType ?? "image/jpeg",
          upsert: true,
        });
        if (uploadError) throw new Error(uploadError.message);
        paths.push(path);
      }

      const { error: insertError } = await supabase.from("proofs").upsert({
        event_id: id,
        files: paths,
        post_url: postUrl.trim() || null,
        status: "pending",
      });
      if (insertError) throw new Error(insertError.message);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload proof.");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <ThemedView style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.four, gap: Spacing.three }}>
        <SuccessCheck />
        <ThemedText type="display" style={{ textAlign: "center" }}>
          Proof's in
        </ThemedText>
        <ThemedText color="textSecondary" style={{ textAlign: "center" }}>
          We'll check it and release your payout once it's approved.
        </ThemedText>
        <Button title="Back to Me" onPress={() => router.replace("/(tabs)/me")} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.three }}>
        <ThemedText type="display">Prove it happened</ThemedText>
        <ThemedText color="textSecondary">Two photos of the worn mark, one of the venue. That's it.</ThemedText>

        {SLOTS.map((slot, index) => (
          <Reveal index={index} key={slot.key}>
            <Card>
              <ThemedText type="smallBold">{slot.label}</ThemedText>
              {assets[slot.key] ? (
                <Image source={{ uri: assets[slot.key]!.uri }} style={{ width: "100%", height: 180, borderRadius: 8 }} resizeMode="cover" />
              ) : null}
              <Button title={assets[slot.key] ? "Change photo" : "Add photo"} variant="outline" onPress={() => onPick(slot.key)} />
            </Card>
          </Reveal>
        ))}

        <TextField label="Post link (optional)" value={postUrl} onChangeText={setPostUrl} autoCapitalize="none" placeholder="https://instagram.com/p/..." />

        {error ? (
          <ThemedText type="small" color="danger">
            {error}
          </ThemedText>
        ) : null}

        <Button title="Submit for payout" onPress={onSubmit} loading={saving} />
      </ScrollView>
    </ThemedView>
  );
}
