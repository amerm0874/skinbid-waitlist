import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Button, Card, EmptyState, TextField } from "@/components/ui";
import { SelectField } from "@/components/select-field";
import { SuccessCheck, Switch, Tap } from "@/components/animated";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { eventDateWindowError, eventSlugError, normalizeEventSlug } from "@/lib/auction";
import { athleteSportComplete } from "@/lib/config";
import { COUNTRIES } from "@/lib/countries";
import { fetchOfficialEvents } from "@/lib/queries";
import { ZONE_LABEL, ZONE_NAMES, type ZoneName } from "@/lib/zones";
import type { OfficialEvent } from "@/lib/official-events";
import { openOnWeb } from "@/lib/webActions";

function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function NewEventScreen() {
  const { user, profile } = useSession();
  const [races, setRaces] = useState<OfficialEvent[]>([]);
  const [selectedRace, setSelectedRace] = useState<OfficialEvent | null>(null);

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState(profile?.country ?? "");
  const [date, setDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [closedZones, setClosedZones] = useState<Set<ZoneName>>(new Set());
  const [offerTattoo, setOfferTattoo] = useState(true);
  const [offerSticker, setOfferSticker] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ slug: string } | null>(null);

  useEffect(() => {
    if (profile?.sport) {
      fetchOfficialEvents(profile.sport).then(setRaces);
    }
  }, [profile?.sport]);

  const sportReady = athleteSportComplete(profile);

  function onPickRace(race: OfficialEvent) {
    setSelectedRace(race);
    setName(race.name);
    setCity(race.city);
    setCountry(race.country ?? country);
    setDate(new Date(`${race.starts_on}T09:00`));
  }

  function toggleZone(zone: ZoneName) {
    setClosedZones((prev) => {
      const next = new Set(prev);
      if (next.has(zone)) next.delete(zone);
      else next.add(zone);
      return next;
    });
  }

  const slugPreview = useMemo(() => normalizeEventSlug(name), [name]);

  async function onSubmit() {
    if (!user) return;
    setError(null);

    if (!name.trim()) return setError("Enter the event name.");
    if (!country.trim()) return setError("Pick the country.");
    if (!city.trim()) return setError("Enter the city.");
    const dateError = eventDateWindowError(date.toISOString());
    if (dateError) return setError(dateError);
    const slug = normalizeEventSlug(name);
    const slugError = eventSlugError(slug);
    if (slugError) return setError(slugError);
    if (closedZones.size === ZONE_NAMES.length) return setError("Leave at least one zone open.");
    if (!offerTattoo && !offerSticker) return setError("Offer a tattoo, a sticker, or both.");

    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("events")
        .select("id, slug, status")
        .eq("athlete_id", user.id)
        .in("status", ["draft", "live"]);
      if ((existing ?? []).length > 0) {
        setError("You already have an active event. Finish or cancel it on the web dashboard first.");
        setSaving(false);
        return;
      }

      const { data: event, error: insertError } = await supabase
        .from("events")
        .insert({
          athlete_id: user.id,
          name: name.trim(),
          date: date.toISOString(),
          city: city.trim(),
          country: country.trim(),
          sport: profile?.sport ?? null,
          sport_detail: profile?.sport_detail ?? null,
          slug,
          status: "draft",
          likeness_opt_in: true,
          offer_tattoo: offerTattoo,
          offer_sticker: offerSticker,
        })
        .select("id, slug")
        .single();
      if (insertError || !event) {
        throw new Error(insertError?.code === "23505" ? "That URL is taken, or you already have an active event." : "Could not create the event.");
      }

      const zoneRows = ZONE_NAMES.map((zoneName) => ({
        event_id: event.id,
        name: zoneName,
        status: closedZones.has(zoneName) ? "closed" : "open",
      }));
      const { error: zonesError } = await supabase.from("zones").insert(zoneRows);
      if (zonesError) throw new Error("Event created, but zones failed to save. Finish setup on the web.");

      setCreated({ slug: event.slug });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the event.");
    } finally {
      setSaving(false);
    }
  }

  if (!sportReady) {
    return (
      <ThemedView style={{ flex: 1 }}>
        <EmptyState title="Finish your profile first" body="Add your sport in Settings before listing a race." />
      </ThemedView>
    );
  }

  if (created) {
    return (
      <ThemedView style={{ flex: 1, alignItems: "center", padding: Spacing.four, gap: Spacing.three, justifyContent: "center" }}>
        <SuccessCheck />
        <ThemedText type="display" style={{ textAlign: "center" }}>
          Draft's live
        </ThemedText>
        <ThemedText color="textSecondary" style={{ textAlign: "center" }}>
          One step left: your 3D body scan. That's a web-only flow for now — finish it there to go live and start taking
          bids.
        </ThemedText>
        <Button title="Finish setup on skinbid.me" onPress={() => openOnWeb(`/e/${created.slug}`)} />
        <Button title="Back to Me" variant="outline" onPress={() => router.replace("/(tabs)/me")} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.three }}>
        <ThemedText type="display">List your race</ThemedText>

        {races.length > 0 ? (
          <Card>
            <ThemedText type="smallBold">Pick from upcoming {profile?.sport} races</ThemedText>
            <View style={{ gap: Spacing.one }}>
              {races.slice(0, 8).map((race) => (
                <Tap
                  key={race.starts_on}
                  onPress={() => onPickRace(race)}
                  style={{
                    padding: Spacing.two,
                    borderRadius: Radius.sm,
                    backgroundColor: selectedRace?.starts_on === race.starts_on ? Colors.backgroundSelected : "transparent",
                  }}
                >
                  <ThemedText type="small">
                    {race.name} · {race.city}
                  </ThemedText>
                </Tap>
              ))}
            </View>
          </Card>
        ) : null}

        <TextField label="Event name" value={name} onChangeText={setName} placeholder="e.g. HYROX Rome" />
        {slugPreview ? (
          <ThemedText type="small" color="textSecondary">
            skinbid.me/e/{slugPreview}
          </ThemedText>
        ) : null}
        <SelectField label="Country" value={country || null} options={COUNTRIES} onChange={setCountry} searchable />
        <TextField label="City" value={city} onChangeText={setCity} placeholder="e.g. Rome" />

        <View style={{ gap: Spacing.one }}>
          <ThemedText type="small" color="textSecondary">
            Event date
          </ThemedText>
          <Pressable onPress={() => setShowDatePicker(true)} style={dateTriggerStyle}>
            <ThemedText>{ymd(date)}</ThemedText>
          </Pressable>
          {showDatePicker ? (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(_event, selected) => {
                setShowDatePicker(Platform.OS === "ios");
                if (selected) setDate(selected);
              }}
            />
          ) : null}
        </View>

        <Card>
          <ThemedText type="smallBold">Offer</ThemedText>
          <ToggleRow label="Temp tattoo" value={offerTattoo} onChange={setOfferTattoo} />
          <ToggleRow label="Sticker" value={offerSticker} onChange={setOfferSticker} />
        </Card>

        <Card>
          <ThemedText type="smallBold">Zones — tap to close a slot you don't want to sell</ThemedText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.two }}>
            {ZONE_NAMES.map((zoneName) => {
              const isClosed = closedZones.has(zoneName);
              return (
                <Tap
                  key={zoneName}
                  onPress={() => toggleZone(zoneName)}
                  style={{
                    paddingHorizontal: Spacing.two,
                    paddingVertical: Spacing.one,
                    borderRadius: Radius.pill,
                    borderWidth: 1,
                    borderColor: isClosed ? Colors.border : Colors.accent,
                    backgroundColor: isClosed ? "transparent" : "rgba(200,242,78,0.12)",
                  }}
                >
                  <ThemedText type="small" color={isClosed ? "textSecondary" : "accent"}>
                    {ZONE_LABEL[zoneName]}
                  </ThemedText>
                </Tap>
              );
            })}
          </View>
        </Card>

        {error ? (
          <ThemedText type="small" color="danger">
            {error}
          </ThemedText>
        ) : null}

        <Button title="Create draft" onPress={onSubmit} loading={saving} />
      </ScrollView>
    </ThemedView>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <Tap
      haptic={false}
      onPress={() => onChange(!value)}
      style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: Spacing.one }}
    >
      <ThemedText type="small">{label}</ThemedText>
      <Switch value={value} />
    </Tap>
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
