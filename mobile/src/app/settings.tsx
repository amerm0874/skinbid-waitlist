import { useState } from "react";
import { Image, ScrollView } from "react-native";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Button, Card, TextField } from "@/components/ui";
import { SelectField } from "@/components/select-field";
import { Spacing } from "@/constants/theme";
import { useSession } from "@/lib/session";
import { upsertProfile } from "@/lib/queries";
import { pickImage, uploadImageAsset } from "@/lib/uploads";
import { COUNTRIES } from "@/lib/countries";
import { ATHLETE_SPORTS, BRAND_CATEGORIES, COMBAT_SPORTS, PAYOUT_RAIL, looksLikeEmail, parseAthleteSport } from "@/lib/config";

export default function SettingsScreen() {
  const { user, profile, refreshProfile } = useSession();
  const [name, setName] = useState(profile?.name ?? "");
  const [country, setCountry] = useState(profile?.country ?? "");
  const [sport, setSport] = useState(profile?.sport ?? "");
  const [sportDetail, setSportDetail] = useState(profile?.sport_detail ?? "");
  const [payoutEmail, setPayoutEmail] = useState(profile?.payout_account ?? "");
  const [website, setWebsite] = useState(profile?.website ?? "");
  const [brandCategory, setBrandCategory] = useState(profile?.brand_category ?? "");
  const [photoUrl, setPhotoUrl] = useState<string | null>(profile?.photo_url ?? profile?.logo_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!profile || !user) return null;
  const isAthlete = profile.role === "athlete";

  async function onPickPhoto() {
    if (!user) return;
    try {
      const asset = await pickImage({ allowsEditing: true, aspect: [1, 1] });
      if (!asset) return;
      setUploading(true);
      const bucket = isAthlete ? "photos" : "logos";
      const path = `${user.id}/${isAthlete ? "photo" : "logo"}.png`;
      const url = await uploadImageAsset(bucket, path, asset);
      setPhotoUrl(`${url}?t=${Date.now()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload photo.");
    } finally {
      setUploading(false);
    }
  }

  async function onSave() {
    if (!user) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      if (isAthlete) {
        const parsedSport = parseAthleteSport(sport, sportDetail);
        if (!parsedSport.ok) throw new Error(parsedSport.error);
        await upsertProfile(user.id, {
          name: name.trim(),
          country,
          sport: parsedSport.sport,
          sport_detail: parsedSport.sport_detail,
          photo_url: photoUrl,
          payout_rail: payoutEmail.trim() ? PAYOUT_RAIL : null,
          payout_account: payoutEmail.trim() || null,
        });
      } else {
        if (!website.trim()) throw new Error("Enter your website.");
        await upsertProfile(user.id, {
          name: name.trim(),
          website: website.trim(),
          brand_category: brandCategory,
          logo_url: photoUrl,
        });
      }
      await refreshProfile();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.three }}>
        <Card style={{ alignItems: "center" }}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={{ width: 96, height: 96, borderRadius: 48 }} />
          ) : null}
          <Button title={photoUrl ? "Change photo" : "Add photo"} variant="outline" onPress={onPickPhoto} loading={uploading} />
        </Card>

        <TextField label="Name" value={name} onChangeText={setName} />

        {isAthlete ? (
          <>
            <SelectField label="Country" value={country || null} options={COUNTRIES} onChange={setCountry} searchable />
            <SelectField label="Sport" value={sport || null} options={ATHLETE_SPORTS} onChange={(value) => { setSport(value); setSportDetail(""); }} />
            {sport === "Combat" ? (
              <SelectField label="Combat sport" value={sportDetail || null} options={COMBAT_SPORTS} onChange={setSportDetail} />
            ) : null}
            {sport === "Other" ? <TextField label="Your sport" value={sportDetail} onChangeText={setSportDetail} maxLength={40} /> : null}
            <Card>
              <ThemedText type="smallBold">Payout</ThemedText>
              <TextField
                label="PayPal email"
                value={payoutEmail}
                onChangeText={setPayoutEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                error={payoutEmail && !looksLikeEmail(payoutEmail) ? "Enter a valid email." : null}
              />
            </Card>
          </>
        ) : (
          <>
            <TextField label="Website" value={website} onChangeText={setWebsite} autoCapitalize="none" keyboardType="url" />
            <SelectField label="Category" value={brandCategory || null} options={BRAND_CATEGORIES} onChange={setBrandCategory} />
          </>
        )}

        {error ? (
          <ThemedText type="small" color="danger">
            {error}
          </ThemedText>
        ) : null}
        {saved ? (
          <ThemedText type="small" color="success">
            Saved.
          </ThemedText>
        ) : null}

        <Button title="Save changes" onPress={onSave} loading={saving} />
      </ScrollView>
    </ThemedView>
  );
}
