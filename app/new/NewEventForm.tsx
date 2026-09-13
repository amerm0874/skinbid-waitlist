"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CAPTURE_STEPS,
  CAPTURE_TITLE,
  CAPTURE_VIDEO_ACCEPT,
  captureFilesError,
  nameClipFileError,
  orbitFileError,
  uploadCapture,
} from "@/lib/capture";
import { onboardingPath, parseAthleteSport } from "@/lib/config";
import { isCountry } from "@/lib/countries";
import {
  eventDateWindowError,
  eventSlugError,
  normalizeEventSlug,
} from "@/lib/auction";
import {
  dateBounds,
  formatEventDate,
  uploadGlb,
  type ListedEvent,
} from "@/lib/event-form";
import {
  catalogDateToLocal,
  formatOfficialOption,
  type OfficialEvent,
} from "@/lib/official-events";
import { ZONE_NAMES, type ZoneName } from "@/lib/zones";
import CountrySelect from "@/components/product/CountrySelect";
import ZoneBodyPicker from "@/components/product/ZoneBodyPicker";

const initialZones = Object.fromEntries(
  ZONE_NAMES.map((name) => [name, "open"]),
) as Record<ZoneName, "open" | "closed">;

export type { ListedEvent };

export default function NewEventForm({
  userId,
  avatarReady,
  scanUploaded,
  existing,
  profileCountry,
  profileCity,
  profileSport,
  profileSportDetail,
  officialEvents,
  prefillRace,
}: {
  userId: string;
  avatarReady: boolean;
  scanUploaded: boolean;
  existing: ListedEvent | null;
  profileCountry?: string | null;
  profileCity?: string | null;
  profileSport?: string | null;
  profileSportDetail?: string | null;
  officialEvents?: OfficialEvent[];
  prefillRace?: OfficialEvent | null;
}) {
  const [savedDraft, setSavedDraft] = useState<ListedEvent | null>(null);
  const [justUploadedScan, setJustUploadedScan] = useState(false);
  const draft = existing?.status === "draft" ? existing : savedDraft;

  if (existing?.status === "live") {
    return <LiveNotice event={existing} />;
  }
  if (draft) {
    return (
      <DraftPublishForm
        userId={userId}
        avatarReady={avatarReady}
        scanUploaded={scanUploaded || justUploadedScan}
        event={draft}
      />
    );
  }
  return (
    <CreateEventForm
      userId={userId}
      avatarReady={avatarReady}
      profileCountry={profileCountry}
      profileCity={profileCity}
      profileSport={profileSport}
      profileSportDetail={profileSportDetail}
      officialEvents={officialEvents ?? []}
      prefillRace={prefillRace ?? null}
      onDraftSaved={setSavedDraft}
      onScanUploaded={() => setJustUploadedScan(true)}
    />
  );
}

function LiveNotice({ event }: { event: ListedEvent }) {
  return (
    <div className="form-shell max-w-lg">
      <p className="font-mono text-[11px] tracking-[0.14em] text-accent">LIVE</p>
      <h2 className="mt-2 text-[22px] font-semibold">{event.name}</h2>
      <p className="mt-2 text-[14px] text-muted">
        One live event at a time. List the next after this one closes.
      </p>
      <p className="mt-3 font-mono text-[12px] text-muted">
        {event.city ?? "-"} · {event.sport ?? "-"} · {formatEventDate(event.date)}
      </p>
      <Link href={`/e/${event.slug}`} className="btn btn-solid mt-6">
        Open /e/{event.slug}
      </Link>
      <Link href="/me" className="btn btn-ghost mt-3">
        Skip
      </Link>
    </div>
  );
}

function DraftPublishForm({
  userId,
  avatarReady,
  scanUploaded,
  event,
}: {
  userId: string;
  avatarReady: boolean;
  scanUploaded: boolean;
  event: ListedEvent;
}) {
  const router = useRouter();
  const capture = useCaptureFiles();
  const [glbFile, setGlbFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [scanSaved, setScanSaved] = useState(scanUploaded);
  const canPublish = avatarReady || Boolean(glbFile);
  const canUploadScan =
    capture.orbitFiles.length > 0 && Boolean(capture.nameClip);

  async function saveCaptureIfNeeded() {
    const reason = await captureFilesError(capture.orbitFiles, capture.nameClip);
    if (reason) {
      throw new Error(reason);
    }
    if (capture.orbitFiles.length === 0 || !capture.nameClip) {
      return false;
    }
    await uploadCapture(userId, capture.orbitFiles, capture.nameClip);
    setScanSaved(true);
    capture.clear();
    return true;
  }

  async function handleUploadScan() {
    setBusy(true);
    setErrorMessage("");
    try {
      const saved = await saveCaptureIfNeeded();
      if (!saved) {
        setErrorMessage("Add the orbit and the 10s name clip.");
      }
    } catch (error) {
      console.log("Capture upload failed", error);
      setErrorMessage(error instanceof Error ? error.message : "Could not upload.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish() {
    setBusy(true);
    setErrorMessage("");
    try {
      await saveCaptureIfNeeded();
      if (glbFile) {
        await uploadGlb(userId, glbFile);
      }
      const response = await fetch("/api/events", { method: "PATCH" });
      const payload = (await response.json()) as {
        error?: string;
        slug?: string;
        status?: string;
      };
      if (!response.ok || payload.status !== "live" || !payload.slug) {
        setErrorMessage(payload.error || "Scan required.");
        return;
      }
      console.log("Event published", payload.slug);
      router.push(`/e/${payload.slug}`);
    } catch (error) {
      console.log("Event publish failed", error);
      setErrorMessage(error instanceof Error ? error.message : "Could not publish.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-shell max-w-lg">
      <p className="font-mono text-[11px] tracking-[0.14em] text-accent">
        Scan required
      </p>
      <h2 className="mt-2 text-[22px] font-semibold">{event.name}</h2>
      <p className="mt-2 text-[14px] text-muted">
        No .glb yet, so this stays draft. It is not listed on /events or /e/
        {event.slug}.
      </p>
      <p className="mt-3 font-mono text-[12px] text-muted">
        {event.city ?? "-"} · {event.sport ?? "-"} · {formatEventDate(event.date)}
      </p>

      <CaptureFields
        key={capture.resetKey}
        scanUploaded={scanSaved}
        orbitError={capture.orbitError}
        nameClipError={capture.nameClipError}
        onOrbitChange={capture.setOrbitFiles}
        onNameClipChange={capture.setNameClip}
      />
      <GlbFileField
        label="Body file (.glb), optional"
        onChange={setGlbFile}
      />
      <p className="mt-2 text-[13px] text-muted">
        {avatarReady
          ? "A body file is already marked ready. Publish to open the event page."
          : "Videos do not mark the body ready. Only a .glb does."}
      </p>

      {errorMessage ? <p className="mt-4 text-[13px] text-danger">{errorMessage}</p> : null}
      <button
        type="button"
        disabled={busy || !canUploadScan || Boolean(capture.orbitError) || Boolean(capture.nameClipError)}
        className="btn btn-ghost mt-6 w-full"
        onClick={() => void handleUploadScan()}
      >
        {busy && !canPublish ? "Uploading…" : "Upload scan files"}
      </button>
      <button
        type="button"
        disabled={busy || !canPublish}
        className="btn btn-solid mt-3"
        onClick={() => void handlePublish()}
      >
        {busy && canPublish ? "Publishing…" : "Publish event"}
      </button>
      <Link href="/me" className="btn btn-ghost mt-3">
        Skip
      </Link>
    </div>
  );
}

function sportFromProfile(
  sport?: string | null,
  detail?: string | null,
) {
  const parsed = parseAthleteSport(sport, detail);
  if (!parsed.ok) {
    return sport?.trim() || "—";
  }
  if (parsed.sport_detail) {
    return `${parsed.sport} · ${parsed.sport_detail}`;
  }
  return parsed.sport;
}

function CreateEventForm({
  userId,
  avatarReady,
  profileCountry,
  profileCity,
  profileSport,
  profileSportDetail,
  officialEvents,
  prefillRace,
  onDraftSaved,
  onScanUploaded,
}: {
  userId: string;
  avatarReady: boolean;
  profileCountry?: string | null;
  profileCity?: string | null;
  profileSport?: string | null;
  profileSportDetail?: string | null;
  officialEvents: OfficialEvent[];
  prefillRace: OfficialEvent | null;
  onDraftSaved: (event: ListedEvent) => void;
  onScanUploaded: () => void;
}) {
  const router = useRouter();
  const bounds = useMemo(() => dateBounds(), []);
  const capture = useCaptureFiles();
  const prefillInList = Boolean(
    prefillRace &&
      officialEvents.some((row) => row.starts_on === prefillRace.starts_on),
  );
  const [pickedStartsOn, setPickedStartsOn] = useState(
    prefillInList && prefillRace ? prefillRace.starts_on : "",
  );
  const [officialUrl, setOfficialUrl] = useState(
    prefillRace?.official_url ?? "",
  );
  const [parseBusy, setParseBusy] = useState(false);
  const [name, setName] = useState(prefillRace?.name ?? "");
  const [slug, setSlug] = useState(
    prefillRace ? normalizeEventSlug(prefillRace.name) : "",
  );
  const [slugTouched, setSlugTouched] = useState(false);
  const [date, setDate] = useState(
    prefillRace ? catalogDateToLocal(prefillRace.starts_on) : bounds.min,
  );
  const [country, setCountry] = useState(
    () => prefillRace?.country?.trim() || profileCountry?.trim() || "",
  );
  const [city, setCity] = useState(
    () => prefillRace?.city?.trim() || profileCity?.trim() || "",
  );
  const [likeness, setLikeness] = useState(false);
  const [zones, setZones] = useState(initialZones);
  const [glbFile, setGlbFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const sportLabel = sportFromProfile(profileSport, profileSportDetail);
  const pickedOfficial = officialEvents.find(
    (row) => row.starts_on === pickedStartsOn,
  );

  const willPublish = avatarReady || Boolean(glbFile);
  const slugPreview = normalizeEventSlug(slug || name) || "your-event";

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) {
      setSlug(normalizeEventSlug(value));
    }
  }

  function applyOfficialEvent(startsOn: string) {
    if (!startsOn) {
      setPickedStartsOn("");
      return;
    }
    const row = officialEvents.find((item) => item.starts_on === startsOn);
    if (!row) {
      setPickedStartsOn("");
      return;
    }
    setPickedStartsOn(row.starts_on);
    setOfficialUrl(row.official_url);
    setSlugTouched(false);
    setName(row.name);
    setSlug(normalizeEventSlug(row.name));
    setDate(catalogDateToLocal(row.starts_on));
    setCity(row.city);
    setCountry(row.country ?? "");
  }

  async function fillFromOfficialUrl(raw: string) {
    const url = raw.trim();
    if (!/^https?:\/\//i.test(url)) {
      return;
    }
    if (pickedOfficial?.official_url === url) {
      return;
    }
    setParseBusy(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/official-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = (await response.json()) as {
        error?: string;
        name?: string | null;
        date?: string | null;
        city?: string | null;
        country?: string | null;
      };
      if (!response.ok) {
        setErrorMessage(payload.error || "Could not read that official page.");
        return;
      }
      if (payload.name) {
        handleNameChange(payload.name);
      }
      if (payload.date) {
        setDate(catalogDateToLocal(payload.date));
      }
      if (payload.city) {
        setCity(payload.city);
      }
      if (payload.country) {
        setCountry(payload.country);
      }
    } catch (error) {
      console.log("Official URL parse failed", error);
      setErrorMessage("Could not read that official page.");
    } finally {
      setParseBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const nextSlug = normalizeEventSlug(slug || name);
    const slugError = eventSlugError(nextSlug);
    if (slugError) {
      setErrorMessage(slugError);
      return;
    }
    const dateError = eventDateWindowError(date);
    if (dateError) {
      setErrorMessage(dateError);
      return;
    }
    if (!country.trim() || (!isCountry(country) && country !== (profileCountry ?? "").trim())) {
      setErrorMessage("Pick the country.");
      return;
    }
    if (!city.trim()) {
      setErrorMessage("Enter the city.");
      return;
    }
    const parsedSport = parseAthleteSport(profileSport, profileSportDetail);
    if (!parsedSport.ok) {
      router.push(onboardingPath("athlete"));
      return;
    }
    if (ZONE_NAMES.every((zone) => zones[zone] === "closed")) {
      setErrorMessage("Leave at least one zone open.");
      return;
    }
    if (capture.orbitError) {
      setErrorMessage(capture.orbitError);
      return;
    }
    if (capture.nameClipError) {
      setErrorMessage(capture.nameClipError);
      return;
    }
    const captureReason = await captureFilesError(
      capture.orbitFiles,
      capture.nameClip,
    );
    if (captureReason) {
      setErrorMessage(captureReason);
      return;
    }

    setBusy(true);
    try {
      if (capture.orbitFiles.length > 0 && capture.nameClip) {
        await uploadCapture(userId, capture.orbitFiles, capture.nameClip);
        onScanUploaded();
      }
      if (glbFile) {
        await uploadGlb(userId, glbFile);
      }
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          date,
          country,
          city,
          slug: nextSlug,
          likeness_opt_in: likeness,
          zones,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        id?: string;
        slug?: string;
        status?: string;
      };
      if (!response.ok || !payload.slug) {
        setErrorMessage(payload.error || "Could not create the event.");
        return;
      }
      console.log("Event created", payload.slug, payload.status);
      if (payload.status === "live") {
        router.push(`/e/${payload.slug}`);
        return;
      }
      onDraftSaved({
        id: payload.id ?? "",
        name,
        slug: payload.slug,
        status: "draft",
        date,
        city,
        sport: parsedSport.sport,
        sport_detail: parsedSport.sport_detail,
      });
      router.refresh();
    } catch (error) {
      console.log("Event create failed", error);
      setErrorMessage(error instanceof Error ? error.message : "Could not create the event.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="new-event">
      <div className="form-shell">
        <label className="block">
          <span className="field-label">Sport</span>
          <input
            className="field"
            name="profile_sport"
            value={sportLabel}
            readOnly
            tabIndex={-1}
          />
        </label>
        {officialEvents.length > 0 ? (
          <div className="mt-4">
            <label className="block">
              <span className="field-label">Official event</span>
              <select
                className="field"
                name="official_event"
                autoComplete="off"
                value={pickedStartsOn}
                onChange={(event) => applyOfficialEvent(event.target.value)}
              >
                <option value="">Type a custom event</option>
                {officialEvents.map((row) => (
                  <option key={row.starts_on} value={row.starts_on}>
                    {formatOfficialOption(row)}
                  </option>
                ))}
              </select>
            </label>
            {pickedOfficial?.official_url ? (
              <a
                href={pickedOfficial.official_url}
                className="mt-2 block text-[12px] text-muted"
                target="_blank"
                rel="noreferrer"
              >
                Official page
              </a>
            ) : (
              <p className="mt-2 text-[12px] text-muted">
                Pick one to fill name, date, city, and country.
              </p>
            )}
          </div>
        ) : null}
        <label className="mt-4 block">
          <span className="field-label">Official page</span>
          <input
            className="field font-mono text-[14px]"
            name="official_url"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://"
            value={officialUrl}
            disabled={parseBusy}
            onChange={(event) => {
              const next = event.target.value;
              setOfficialUrl(next);
              if (
                pickedOfficial &&
                next.trim() !== pickedOfficial.official_url
              ) {
                setPickedStartsOn("");
              }
            }}
            onBlur={(event) => {
              void fillFromOfficialUrl(event.target.value);
            }}
          />
          <span className="mt-2 block text-[12px] text-muted">
            Paste a race URL to fill name, date, city, and country if the page
            has them.
          </span>
        </label>
        <label className="mt-4 block">
          <span className="field-label">Event name</span>
          <input
            className="field"
            name="event_name"
            autoComplete="off"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            required
          />
        </label>
        <label className="mt-4 block">
          <span className="field-label">Event link</span>
          <input
            className="field font-mono text-[14px]"
            name="event_slug"
            autoComplete="off"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(normalizeEventSlug(e.target.value));
            }}
            required
          />
          <span className="mt-2 block text-[12px] text-muted">
            This is the link to your event page.
          </span>
        </label>
        <p className="mt-1 font-mono text-[12px] text-muted">/e/{slugPreview}</p>

        <label className="mt-4 block">
          <span className="field-label">Date (4 days to 12 months out)</span>
          <input
            className="field"
            type="datetime-local"
            name="event_date"
            autoComplete="off"
            min={bounds.min}
            max={bounds.max}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
        <label className="mt-4 block">
          <span className="field-label">Country</span>
          <CountrySelect
            required
            value={country}
            onChange={setCountry}
          />
        </label>
        <label className="mt-4 block">
          <span className="field-label">City</span>
          <input
            className="field"
            name="event_city"
            autoComplete="off"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
          />
        </label>
      </div>

      <fieldset className="new-event-zones mt-6">
        <legend className="field-label">
          Zones. L/R Chest, Shoulder, Bicep, Forearm, Back, Thigh. Tap a zone
          to close it if you will not wear a mark there.
        </legend>
        <ZoneBodyPicker
          zones={zones}
          onToggle={(zone) =>
            setZones((current) => ({
              ...current,
              [zone]: current[zone] === "open" ? "closed" : "open",
            }))
          }
        />
      </fieldset>

      <div className="form-shell">
        <fieldset className="mt-6">
          <legend className="field-label">Likeness reuse in other ads</legend>
          <div className="seg w-full">
            <button
              type="button"
              className={`flex-1 ${!likeness ? "is-on" : ""}`}
              onClick={() => setLikeness(false)}
            >
              No
            </button>
            <button
              type="button"
              className={`flex-1 ${likeness ? "is-on" : ""}`}
              onClick={() => setLikeness(true)}
            >
              Yes
            </button>
          </div>
          <p className="mt-2 text-[13px] text-muted">
            Slot photos from event day are included either way. Yes only allows reuse
            in other ads after a separate appearance price.
          </p>
        </fieldset>

        <CaptureFields
          orbitError={capture.orbitError}
          nameClipError={capture.nameClipError}
          onOrbitChange={capture.setOrbitFiles}
          onNameClipChange={capture.setNameClip}
        />
        <GlbFileField
          label="Body file (.glb), optional"
          onChange={setGlbFile}
        />
        <p className="mt-2 text-[13px] text-muted">
          {avatarReady
            ? `A body file is already marked ready. Saving will publish /e/${slugPreview}.`
            : "Videos do not mark the body ready. Only a .glb does. No .glb → the event stays draft and is not listed."}
        </p>

        {errorMessage ? <p className="mt-4 text-[13px] text-danger">{errorMessage}</p> : null}
        <button type="submit" disabled={busy} className="btn btn-solid mt-6">
          {busy ? "Saving…" : willPublish ? "Publish event" : "Save draft"}
        </button>
        <Link href="/me" className="btn btn-ghost mt-3">
          Skip
        </Link>
      </div>
    </form>
  );
}

function useCaptureFiles() {
  const orbitToken = useRef(0);
  const [orbitFiles, setOrbitFilesState] = useState<File[]>([]);
  const [nameClip, setNameClipState] = useState<File | null>(null);
  const [orbitError, setOrbitError] = useState("");
  const [nameClipError, setNameClipError] = useState("");
  const [resetKey, setResetKey] = useState(0);

  async function setOrbitFiles(files: File[]) {
    const token = ++orbitToken.current;
    setOrbitFilesState(files);
    if (files.length === 0) {
      setOrbitError("");
      return;
    }
    const reason = await orbitFileError(files);
    if (token !== orbitToken.current) {
      return;
    }
    setOrbitError(reason);
  }

  function setNameClip(file: File | null) {
    setNameClipState(file);
    setNameClipError(nameClipFileError(file));
  }

  function clear() {
    orbitToken.current += 1;
    setOrbitFilesState([]);
    setNameClipState(null);
    setOrbitError("");
    setNameClipError("");
    setResetKey((value) => value + 1);
  }

  return {
    orbitFiles,
    nameClip,
    orbitError,
    nameClipError,
    resetKey,
    setOrbitFiles,
    setNameClip,
    clear,
  };
}

function CaptureFields({
  scanUploaded,
  orbitError,
  nameClipError,
  onOrbitChange,
  onNameClipChange,
}: {
  scanUploaded?: boolean;
  orbitError: string;
  nameClipError: string;
  onOrbitChange: (files: File[]) => void;
  onNameClipChange: (file: File | null) => void;
}) {
  return (
    <section className="capture-block">
      <h2>{CAPTURE_TITLE}</h2>
      <ol className="capture-steps mt-3" aria-label="How to scan">
        {CAPTURE_STEPS.map((step, index) => (
          <li key={step}>
            <span>{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>
      {scanUploaded ? (
        <p className="mt-3 text-[13px] text-muted">
          Scan files uploaded. Event stays draft until the GLB is ready.
        </p>
      ) : null}
      <label className="mt-4 block">
        <FieldHint
          label="Orbit"
          hint="60–90s slow circle, phone at chest, hair to mid-shin."
        />
        <input
          className="field pt-2 text-[13px]"
          type="file"
          accept={CAPTURE_VIDEO_ACCEPT}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            onOrbitChange(file ? [file] : []);
          }}
        />
      </label>
      {orbitError ? (
        <p className="mt-2 text-[13px] text-danger">{orbitError}</p>
      ) : null}
      <label className="mt-4 block">
        <FieldHint
          label="Name clip"
          hint="10s, face + chest, say your display name."
        />
        <input
          className="field pt-2 text-[13px]"
          type="file"
          accept={CAPTURE_VIDEO_ACCEPT}
          onChange={(event) => onNameClipChange(event.target.files?.[0] ?? null)}
        />
      </label>
      {nameClipError ? (
        <p className="mt-2 text-[13px] text-danger">{nameClipError}</p>
      ) : null}
    </section>
  );
}

function GlbFileField({
  label,
  onChange,
}: {
  label: string;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="mt-4 block">
      <FieldHint
        label={label}
        hint="optional .glb if you already have a model."
      />
      <input
        className="field pt-2 text-[13px]"
        type="file"
        accept=".glb,model/gltf-binary"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function FieldHint({ label, hint }: { label: string; hint: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className={`field-label field-hint${open ? " is-open" : ""}`}>
      {label}
      <button
        type="button"
        className="field-hint-btn"
        aria-label={hint}
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        !
      </button>
      <span className="field-hint-line" role="tooltip">
        {hint}
      </span>
    </span>
  );
}
