"use client";

import Link from "next/link";
import { useCallback, useRef, useState, type PointerEvent } from "react";
import { Check, Move, RotateCcw, Save, ScanLine } from "lucide-react";
import { ZONE_LABEL, ZONE_NAMES, type ZoneName } from "@/lib/zones";
import { isHiddenPhotoZone, zonePhotoSide, type ZonePhotoSide, type ZoneRect } from "@/lib/zone-photos";

type Props = {
  athleteId: string;
  frontUrl: string | null;
  backUrl: string | null;
  savedRects?: Partial<Record<ZoneName, ZoneRect>> | null;
  canUpload?: boolean;
  onPlacementSaved?: () => void;
  onPhotosChange?: (photos: { front: string | null; back: string | null }) => void;
};
const names = ZONE_NAMES.filter((name) => !isHiddenPhotoZone(name));
const sides = ["front", "back"] as const;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
function bounded(rect: ZoneRect): ZoneRect {
  const w = clamp(rect.w, 2, 100), h = clamp(rect.h, 2, 100);
  return { x: clamp(rect.x, 0, 100 - w), y: clamp(rect.y, 0, 100 - h), w, h };
}

export function ZoneSlotPlacer({ athleteId, frontUrl, backUrl, savedRects, canUpload = true, onPlacementSaved }: Props) {
  const [picked, setPicked] = useState<ZoneName>("abs");
  const [rects, setRects] = useState<Partial<Record<ZoneName, ZoneRect>>>(() => ({ ...savedRects }));
  const [draft, setDraft] = useState<ZoneRect | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState<Partial<Record<ZonePhotoSide, boolean>>>({});
  const [loaded, setLoaded] = useState<Partial<Record<ZonePhotoSide, boolean>>>({});
  // Cached images may finish before React attaches onLoad during hydration.
  const frontImageRef = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth) setLoaded((value) => value.front ? value : { ...value, front: true });
  }, []);
  const backImageRef = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth) setLoaded((value) => value.back ? value : { ...value, back: true });
  }, []);
  const drag = useRef<{ x: number; y: number; rect: ZoneRect; mode: string } | null>(null);
  const current = draft ?? rects[picked];
  const activeSide = zonePhotoSide(picked);

  function point(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: clamp((event.clientX - box.left) / box.width * 100, 0, 100), y: clamp((event.clientY - box.top) / box.height * 100, 0, 100) };
  }
  function start(event: PointerEvent<HTMLDivElement>, side: ZonePhotoSide) {
    if (busy || side !== activeSide || !loaded[side] || event.button !== 0) return;
    const target = event.target as HTMLElement;
    const other = target.closest<HTMLElement>("[data-zone]")?.dataset.zone;
    if (other && other !== picked) {
      if (!draft) { setPicked(other as ZoneName); setMessage(""); }
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const p = point(event);
    const mode = target.closest<HTMLElement>("[data-mode]")?.dataset.mode ?? "draw";
    drag.current = { ...p, mode, rect: current ?? { x: p.x, y: p.y, w: 12, h: 8 } };
    if (mode === "draw") setDraft(bounded({ x: p.x - 6, y: p.y - 4, w: 12, h: 8 }));
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const p = point(event), dx = p.x - d.x, dy = p.y - d.y;
    if (d.mode === "move") setDraft(bounded({ ...d.rect, x: d.rect.x + dx, y: d.rect.y + dy }));
    else if (d.mode === "resize") setDraft(bounded({ ...d.rect, w: Math.min(100 - d.rect.x, d.rect.w + dx), h: Math.min(100 - d.rect.y, d.rect.h + dy) }));
    else if (Math.abs(dx) + Math.abs(dy) > 2) setDraft(bounded({ x: Math.min(d.x, p.x), y: Math.min(d.y, p.y), w: Math.abs(dx), h: Math.abs(dy) }));
  }
  async function save() {
    if (!draft || busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/zone-rects", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ athlete_id: athleteId, zone_name: picked, ...draft }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save. Your changes are still here; try again.");
      setRects((previous) => ({ ...previous, [picked]: draft }));
      setDraft(null); setMessage(ZONE_LABEL[picked] + " saved. Brands will see this exact position.");
      onPlacementSaved?.();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save this placement."); }
    finally { setBusy(false); }
  }
  const savedCount = names.filter((name) => rects[name]).length;
  return (
    <section className="placement-studio" id="placements" aria-labelledby="placement-title">
      <header className="profile-section-heading">
        <div><h2 id="placement-title">Your body. Your placements.</h2><p>Choose a placement, then draw it on your photo. Nothing is positioned for you.</p></div>
        <span className="setup-count">{savedCount === 1 ? "1 placement saved" : `${savedCount} placements saved`}</span>
      </header>
      <div className="placement-workspace">
        <div className="placement-pair">
          {sides.map((side) => {
            const url = side === "front" ? frontUrl : backUrl;
            return <div className={"placement-view" + (activeSide === side ? " is-active" : "")} key={side}>
              <div className="placement-view-heading"><h3>{side === "front" ? "Front view" : "Back view"}</h3><span>{activeSide === side ? "Editing this view" : "Select a placement to edit"}</span></div>
              {url && !failed[side] ? <div className="placement-image" onPointerDown={(event) => start(event, side)} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; setDraft(null); }}>
                {/* Coordinates use the uncropped, intrinsic image bounds. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img ref={side === "front" ? frontImageRef : backImageRef} src={url} alt={"Your " + side + " photo with sponsorship placements"} draggable={false} onLoad={() => setLoaded((previous) => previous[side] ? previous : ({ ...previous, [side]: true }))} onError={() => setFailed((previous) => ({ ...previous, [side]: true }))} />
                {loaded[side] && names.filter((name) => zonePhotoSide(name) === side).map((name) => {
                  const rect = name === picked ? current : rects[name];
                  if (!rect) return null;
                  return <button key={name} type="button" data-zone={name} data-mode="move" aria-label={"Select " + ZONE_LABEL[name]} aria-pressed={picked === name} disabled={busy || Boolean(draft && name !== picked)} className={"placement-box" + (picked === name ? " is-selected" : "")} style={{ left: rect.x + "%", top: rect.y + "%", width: rect.w + "%", height: rect.h + "%" }} onClick={() => { if (!draft) setPicked(name); }} onKeyDown={(event) => {
                    const delta = event.shiftKey ? 2 : .5;
                    if (!busy && picked === name && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
                      event.preventDefault(); setDraft(bounded({ ...rect, x: rect.x + (event.key === "ArrowLeft" ? -delta : event.key === "ArrowRight" ? delta : 0), y: rect.y + (event.key === "ArrowUp" ? -delta : event.key === "ArrowDown" ? delta : 0) }));
                    }
                  }}><span>{ZONE_LABEL[name]}</span>{picked === name ? <i data-mode="resize" className="placement-handle" aria-hidden="true" /> : null}</button>;
                })}
              </div> : <div className="placement-empty"><ScanLine size={28} /><p>{failed[side] ? "This photo could not load. Refresh or upload it again." : "Add your " + side + " photo to start placing sponsors."}</p><Link href="/me#athlete-media">Set up your photos</Link></div>}
            </div>;
          })}
        </div>
        <aside className="placement-inspector" aria-label="Placement controls">
          <label className="field-label" htmlFor="placement-choice">Placement</label>
          <select id="placement-choice" className="field" value={picked} disabled={busy || Boolean(draft)} onChange={(event) => { setPicked(event.target.value as ZoneName); setMessage(""); }}>
            {sides.map((side) => <optgroup key={side} label={side === "front" ? "Front of body" : "Back of body"}>{names.filter((name) => zonePhotoSide(name) === side).map((name) => <option key={name} value={name}>{ZONE_LABEL[name]}{rects[name] ? " — saved" : ""}</option>)}</optgroup>)}
          </select>
          <p className="placement-help">Left and right mean <strong>your</strong> left and right.</p>
          <div className="placement-instruction"><Move size={18} /><p>Click to place. Drag the box to move it, or its corner to resize. Arrow keys work too.</p></div>
          {current ? <fieldset className="placement-sliders" disabled={busy}><legend>Fine-tune position & size</legend>{([['x','Horizontal'],['y','Vertical'],['w','Width'],['h','Height']] as const).map(([key,label]) => <label key={key}><span>{label}<output>{Math.round(current[key])}%</output></span><input aria-label={label} type="range" min={key === "x" || key === "y" ? 0 : 2} max={key === "x" ? 100-current.w : key === "y" ? 100-current.h : key === "w" ? 100-current.x : 100-current.y} step="0.5" value={current[key]} onChange={(event) => setDraft(bounded({ ...current, [key]: Number(event.target.value) }))} /></label>)}</fieldset> : <button type="button" className="btn btn-ghost" disabled={busy || !loaded[activeSide]} onClick={() => setDraft({ x: 44, y: 46, w: 12, h: 8 })}>Add placement to photo</button>}
          <div className="placement-save"><button type="button" className="btn btn-solid" disabled={!draft || busy} onClick={() => void save()}>{busy ? "Saving…" : draft ? <><Save size={16} /> Save placement</> : <><Check size={16} /> {current ? "Saved" : "Place a box first"}</>}</button>{draft ? <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => { setDraft(null); setMessage(""); }}><RotateCcw size={15} /> Discard changes</button> : null}</div>
          <p className="placement-help" role="status">{message || (draft ? "Unsaved changes. Save or discard before choosing another placement." : "Only saved placements are visible to brands.")}</p>
          {canUpload ? <Link className="placement-media-link" href="/me#athlete-media">Manage photos & introduction video</Link> : null}
        </aside>
      </div>
    </section>
  );
}
