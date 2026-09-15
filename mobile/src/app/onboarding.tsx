import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { Screen, Button, Card, TextField } from "@/components/ui";
import { SelectField } from "@/components/select-field";
import { ThemedText } from "@/components/themed-text";
import { Tap } from "@/components/animated";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { upsertProfile } from "@/lib/queries";
import { pickImage, uploadImageAsset } from "@/lib/uploads";
import { COUNTRIES, DEFAULT_COUNTRY } from "@/lib/countries";
import {
  ATHLETE_GENDERS,
  ATHLETE_SPORTS,
  BRAND_CATEGORIES,
  COMBAT_SPORTS,
  PAYOUT_RAIL,
  ageFromDob,
  dobInputBounds,
  looksLikeEmail,
  parseAthleteSport,
  parseRole,
  type Role,
} from "@/lib/config";
import { Colors, Radius, Spacing } from "@/constants/theme";

function ymd(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function OnboardingScreen() {
  const params = useLocalSearchParams<{ role?: string }>();
  const { user, profile, refreshProfile } = useSession();
  const role: Role = (parseRole(profile?.role ?? null) ?? parseRole(params.role ?? null)) ?? "athlete";

  const [name, setName] = useState(profile?.name ?? "");
  const [country, setCountry] = useState<string>(profile?.country ?? DEFAULT_COUNTRY);
  const [dob, setDob] = useState<Date | null>(profile?.dob ? new Date(profile.dob) : null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState<string>(profile?.gender ?? "");
  const [sport, setSport] = useState<string>(profile?.sport ?? "");
  const [sportDetail, setSportDetail] = useState<string>(profile?.sport_detail ?? "");
  const [instagram, setInstagram] = useState("");
  const [payoutEmail, setPayoutEmail] = useState(profile?.payout_account ?? "");

  const [website, setWebsite] = useState(profile?.website ?? "");
  const [brandCategory, setBrandCategory] = useState<string>(profile?.brand_category ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(profile?.logo_url ?? null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { min: minDob, max: maxDob } = dobInputBounds();
  const age = dob ? ageFromDob(ymd(dob)) : null;

  async function onPickLogo() {
    if (!user) return;
    try {
      const asset = await pickImage({ allowsEditing: true, aspect: [1, 1] });
      if (!asset) return;
      setUploadingLogo(true);
      const url = await uploadImageAsset("logos", `${user.id}/logo.png`, asset);
      setLogoUrl(`${url}?t=${Date.now()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload logo.");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function onSubmit() {
    if (!user) return;
    setError(null);

    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }

    if (role === "athlete") {
      if (!dob) {
        setError("Enter your date of birth.");
        return;
      }
      if (!age || age < 18) {
        setError("You must be 18 or older to list a race.");
        return;
      }
      const parsedSport = parseAthleteSport(sport, sportDetail);
      if (!parsedSport.ok) {
        setError(parsedSport.error);
        return;
      }
      setSaving(true);
      try {
        await upsertProfile(user.id, {
          role: "athlete",
          name: name.trim(),
          country,
          dob: ymd(dob),
          age,
          gender: gender || null,
          sport: parsedSport.sport,
          sport_detail: parsedSport.sport_detail,
          social: instagram.trim() || null,
          socials: instagram.trim() ? [{ network: "Instagram", handle: instagram.trim() }] : null,
          payout_rail: payoutEmail.trim() ? PAYOUT_RAIL : null,
          payout_account: payoutEmail.trim() || null,
        });
        await refreshProfile();
        router.replace("/(tabs)/me");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save your profile.");
      } finally {
        setSaving(false);
      }
      return;
    }

    // brand
    if (!website.trim()) {
      setError("Enter your website.");
      return;
    }
    if (!brandCategory) {
      setError("Pick a category.");
      return;
    }
    setSaving(true);
    try {
      await upsertProfile(user.id, {
        role: "brand",
        name: name.trim(),
        website: website.trim(),
        brand_category: brandCategory,
        logo_url: logoUrl,
      });
      await refreshProfile();
      router.replace("/(tabs)/events");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  async function onSignOut() {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  }

  return (
    <Screen>
      <View style={{ gap: Spacing.one }}>
        <ThemedText type="display">{role === "athlete" ? "Set up your athlete profile" : "Set up your brand profile"}</ThemedText>
        <ThemedText type="small" color="textSecondary">
          {role === "athlete"
            ? "This is what brands see when they consider your slots."
            : "Name, website, and category — logo is optional."}
        </ThemedText>
      </View>

      <TextField label="Name" value={name} onChangeText={setName} placeholder={role === "athlete" ? "Your name" : "Brand name"} />

      {role === "athlete" ? (
        <>
          <SelectField label="Country" value={country} options={COUNTRIES} onChange={setCountry} searchable />

          <View style={{ gap: Spacing.one }}>
            <ThemedText type="small" color="textSecondary">
              Date of birth
            </ThemedText>
            <Pressable onPress={() => setShowDatePicker(true)} style={dateTriggerStyle}>
              <ThemedText color={dob ? "text" : "textSecondary"}>{dob ? ymd(dob) : "Select date"}</ThemedText>
            </Pressable>
            {showDatePicker ? (
              <DateTimePicker
                value={dob ?? maxDob}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                minimumDate={minDob}
                maximumDate={maxDob}
                onChange={(_event, selected) => {
                  setShowDatePicker(Platform.OS === "ios");
                  if (selected) setDob(selected);
                }}
              />
            ) : null}
          </View>

          <View style={{ flexDirection: "row", gap: Spacing.two }}>
            {ATHLETE_GENDERS.map((option) => (
              <Tap
                key={option}
                onPress={() => setGender(option)}
                style={[segmentStyle, gender === option && segmentActiveStyle]}
              >
                <ThemedText type="smallBold" color={gender === option ? "accentInk" : "text"}>
                  {option}
                </ThemedText>
              </Tap>
            ))}
          </View>

          <SelectField label="Sport" value={sport || null} options={ATHLETE_SPORTS} onChange={(value) => { setSport(value); setSportDetail(""); }} />
          {sport === "Combat" ? (
            <SelectField label="Combat sport" value={sportDetail || null} options={COMBAT_SPORTS} onChange={setSportDetail} />
          ) : null}
          {sport === "Other" ? (
            <TextField label="Your sport" value={sportDetail} onChangeText={setSportDetail} maxLength={40} placeholder="e.g. Triathlon" />
          ) : null}

          <TextField label="Instagram handle (optional)" value={instagram} onChangeText={setInstagram} autoCapitalize="none" placeholder="yourhandle" />

          <Card>
            <ThemedText type="smallBold">Payout (optional for now)</ThemedText>
            <ThemedText type="small" color="textSecondary">
              PayPal email. Required before you can go live with an event.
            </ThemedText>
            <TextField
              value={payoutEmail}
              onChangeText={setPayoutEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@paypal.com"
              error={payoutEmail && !looksLikeEmail(payoutEmail) ? "Enter a valid email." : null}
            />
          </Card>
        </>
      ) : (
        <>
          <TextField label="Website" value={website} onChangeText={setWebsite} autoCapitalize="none" keyboardType="url" placeholder="https://yourbrand.com" />
          <SelectField label="Category" value={brandCategory || null} options={BRAND_CATEGORIES} onChange={setBrandCategory} />
          <Card>
            <ThemedText type="smallBold">Logo (optional)</ThemedText>
            <Button title={logoUrl ? "Change logo" : "Upload logo"} variant="outline" onPress={onPickLogo} loading={uploadingLogo} />
          </Card>
        </>
      )}

      {error ? (
        <ThemedText type="small" color="danger">
          {error}
        </ThemedText>
      ) : null}

      <Button title="Continue" onPress={onSubmit} loading={saving} />
      <Button title="Sign out" variant="ghost" onPress={onSignOut} />
    </Screen>
  );
}

const dateTriggerStyle = {
  height: 48,
  borderRadius: Radius.sm,
  borderWidth: 1,
  borderColor: Colors.border,
  backgroundColor: Colors.backgroundElement,
  paddingHorizontal: Spacing.three,
  justifyContent: "center" as const,
};

const segmentStyle = {
  flex: 1,
  height: 44,
  borderRadius: Radius.pill,
  borderWidth: 1,
  borderColor: Colors.border,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const segmentActiveStyle = {
  backgroundColor: Colors.accent,
  borderColor: Colors.accent,
};
