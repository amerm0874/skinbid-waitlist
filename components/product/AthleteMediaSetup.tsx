"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Film, Sparkles } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import type { AthleteMediaView, MediaKind } from "@/lib/athlete-media-types";

async function mediaAction(body: Record<string, unknown>) {
  const response = await fetch("/api/athlete-media", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not save. Please try again.");
  return data;
}
async function validateVideo(file: File) {
  const url = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      const video = document.createElement("video");
      const timer = window.setTimeout(() => finish(new Error("Could not read the video. Try an MP4 file.")), 15000);
      function finish(error?: Error) { window.clearTimeout(timer); video.removeAttribute("src"); video.load(); if (error) reject(error); else resolve(); }
      video.onloadedmetadata = () => { video.onloadedmetadata = null; video.onerror = null; finish(!Number.isFinite(video.duration) || video.duration < 5 || video.duration > 60 ? new Error("Use a video between 5 and 60 seconds.") : undefined); };
      video.onerror = () => { video.onerror = null; finish(new Error("This video cannot play in your browser. Try an MP4 file.")); };
      video.preload = "metadata"; video.src = url;
    });
  } finally { URL.revokeObjectURL(url); }
}

export function AthleteMediaSetup({ initial }: { initial: AthleteMediaView }) {
  const router = useRouter();
  const [media, setMedia] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [approvedConsent, setApprovedConsent] = useState(false);
  const processing = media.state === "processing";
  const ready = Boolean(media.originalFront && media.originalBack && media.video);
  const disabled = Boolean(busy || processing || !media.configured);
  async function refresh() {
    const response = await fetch("/api/athlete-media", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not refresh your photo setup. Reload this page to check progress.");
    setMedia(await response.json());
  }
  useEffect(() => {
    if (!processing) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      try {
        const response = await fetch("/api/athlete-media", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Connection interrupted. We’ll check your photos again shortly.");
        const updated = await response.json() as AthleteMediaView;
        if (active) { setMedia(updated); setMessage(""); }
      } catch (error) { if (active) setMessage(error instanceof Error ? error.message : "Could not check progress."); }
      if (active) timer = setTimeout(poll, 6000);
    }
    timer = setTimeout(poll, 3000);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [processing]);

  async function upload(kind: MediaKind, file: File) {
    if (!consent || disabled) return;
    setBusy(kind); setMessage(""); setApprovedConsent(false);
    try {
      const isVideo = kind === "video";
      if (file.size > (isVideo ? 40 : 8) * 1024 * 1024) throw new Error(isVideo ? "Use a video under 40 MB." : "Use a photo under 8 MB.");
      if (isVideo) await validateVideo(file);
      const supabase = createBrowserSupabase();
      if (!supabase) throw new Error("Upload service is unavailable. Reload and try again.");
      const ticket = await mediaAction({ action: "upload", kind, type: file.type, size: file.size, consent });
      const { error } = await supabase.storage.from(ticket.bucket).uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type });
      if (error) throw new Error("Upload did not finish. Check your connection and choose the file again.");
      await mediaAction({ action: "complete", kind, path: ticket.path, consent });
      await refresh(); setMessage(isVideo ? "Introduction video saved." : `${kind === "front" ? "Front" : "Back"} original saved. It stays private until you approve your studio photos.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not upload. Try again."); }
    finally { setBusy(null); }
  }
  async function generate() {
    setBusy("generate"); setMessage(""); setApprovedConsent(false);
    try { await mediaAction({ action: "generate", consent }); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not start photo preparation."); }
    finally { setBusy(null); }
  }
  async function approve() {
    setBusy("approve"); setMessage("");
    try { await mediaAction({ action: "approve", jobId: media.jobId, consent: approvedConsent }); await refresh(); router.refresh(); setMessage("Photos approved. Now position your sponsorship placements on the new photos below."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not approve your photos."); }
    finally { setBusy(null); }
  }
  return <section className="athlete-media" id="athlete-media" aria-labelledby="media-heading">
    <header className="profile-section-heading"><div><h2 id="media-heading">Let brands meet the real you.</h2><p>Two clear photos. One short introduction. We’ll prepare a consistent studio look for your photos, then you decide whether to use them.</p></div><span className="setup-count">{[media.originalFront, media.originalBack, media.video].filter(Boolean).length} of 3 uploads</span></header>
    {!media.configured ? <p className="media-notice" role="status">Photo setup is being connected. Uploads are temporarily unavailable; your existing profile and race stay unchanged.</p> : null}
    <label className="media-consent"><input type="checkbox" checked={consent} disabled={Boolean(busy || processing)} onChange={(event) => setConsent(event.target.checked)} /><span>These are my own photos and video. I agree to send my photos to OpenRouter and Google for editing, and to show my introduction video on my public athlete profile. Original photos stay private; approved studio photos become visible to brands.</span></label>
    <div className="media-upload-grid" style={{ marginTop: 24 }}>
      {(["front", "back", "video"] as const).map((kind) => {
        const url = kind === "front" ? media.originalFront : kind === "back" ? media.originalBack : media.video;
        return <div key={kind} className="media-upload-card"><h3>{kind === "video" ? <Film size={18} /> : <Camera size={18} />}{kind === "front" ? "Front photo" : kind === "back" ? "Back photo" : "Your introduction"}{url ? <Check size={16} aria-label="Uploaded" /> : null}</h3>
          {url ? kind === "video" ? <video className="media-thumbnail" src={url} controls playsInline preload="metadata" aria-label="Your introduction video" /> : <img className="media-thumbnail" src={url} alt={`Your original ${kind} photo`} /> : <div className="media-thumbnail placement-empty" style={{ minHeight: 240 }}><span>{kind === "video" ? "A real person, not just a photo." : "Clear lighting. Full body. No filters."}</span></div>}
          <p>{kind === "video" ? "Say your name and upcoming race. Show your face, then turn around. 5–60 seconds, MP4 or WebM, up to 40 MB." : `Stand straight, facing ${kind === "front" ? "the camera" : "away from the camera"}, with arms slightly apart. Wear your race kit. JPG or PNG, up to 8 MB.`}</p>
          <label><span className="sr-only">{`${url ? "Replace" : "Upload"} ${kind}`}</span><input type="file" accept={kind === "video" ? "video/mp4,video/webm" : "image/jpeg,image/png"} disabled={disabled || !consent} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(kind, file); }} /></label>
          {busy === kind ? <p className="media-status" role="status">Uploading {kind}… Keep this page open.</p> : null}
        </div>;
      })}
    </div>
    <div className="media-actions">
      {processing ? <p className="media-notice" role="status">Preparing your studio photos. This can take a few minutes. You can leave this page and return; your progress is saved.</p> : media.state !== "review" ? <button className="btn btn-solid" type="button" disabled={disabled || !ready || !consent || !media.aiEnabled} onClick={() => void generate()}><Sparkles size={17} />{busy === "generate" ? "Starting…" : media.approved ? "Prepare a new pair" : "Prepare my studio photos"}</button> : null}
      {!media.aiEnabled && media.configured ? <p className="media-notice">AI preparation is not enabled yet. You can save your uploads now and return when it’s ready.</p> : null}
      <p className="placement-help">We ask the AI to preserve your identity, body and clothing. It can still make mistakes: check both results carefully. Two preparations per 24 hours.</p>
      {(message || media.error) ? <p className={/could not|failed|unavailable|try again|under |must |cannot/i.test(message || media.error || "") ? "media-status is-error" : "media-status"} role="status">{message || media.error}</p> : null}
    </div>
    {media.state === "review" && media.candidateFront && media.candidateBack ? <section className="media-review"><h3>Still you? Check before you publish.</h3><p className="placement-help">Compare your face, body, clothing and tattoos. If anything changed, do not approve these photos.</p><div className="media-review-grid">{(["front", "back"] as const).map((side) => <div key={side} className="media-review-pair"><figure><img src={(side === "front" ? media.originalFront : media.originalBack) ?? ""} alt={`Original ${side}`} /><figcaption>Original · {side}</figcaption></figure><figure><img src={(side === "front" ? media.candidateFront : media.candidateBack) ?? ""} alt={`AI-prepared ${side} for review`} /><figcaption>AI-prepared · {side}</figcaption></figure></div>)}</div><label className="media-consent"><input type="checkbox" checked={approvedConsent} disabled={Boolean(busy)} onChange={(event) => setApprovedConsent(event.target.checked)} /><span>Both photos accurately represent me. Use them on my profile and reset my placement boxes so I can position them on these photos. Photos cannot be replaced during an active race.</span></label><div className="media-actions"><button className="btn btn-solid" type="button" disabled={!approvedConsent || Boolean(busy)} onClick={() => void approve()}>{busy === "approve" ? "Approving…" : "Use these photos"}</button><button className="btn btn-ghost" type="button" disabled={!consent || Boolean(busy) || !media.aiEnabled} onClick={() => void generate()}>Not quite right — try again</button></div></section> : null}
    {media.approved && media.state === "approved" ? <p className="media-notice" style={{ marginTop: 24 }}>Studio photos approved. Your next step is to choose and position the placements you want to offer.</p> : null}
  </section>;
}
