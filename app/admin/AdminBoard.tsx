"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/product/EmptyState";
import { formatEventDate } from "@/lib/event-form";
import { AVATARS_BUCKET, glbFileError, isGlbMagic } from "@/lib/glb";
import { createBrowserSupabase } from "@/lib/supabase/client";

export type ProofFile = {
  path: string;
  name: string;
  url: string | null;
};

export type PendingProof = {
  id: string;
  athleteName: string;
  eventName: string;
  zones: string[];
  files: ProofFile[];
};

export type DraftEvent = {
  id: string;
  name: string;
  slug: string;
  date: string;
  city: string | null;
  sport: string | null;
  athleteName: string;
};

export default function AdminBoard({
  drafts,
  proofs,
}: {
  drafts: DraftEvent[];
  proofs: PendingProof[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");
  const [glbFiles, setGlbFiles] = useState<Record<string, File | null>>({});

  async function postProof(action: "approve" | "reject", proofId: string) {
    if (action === "reject") {
      const confirmed = window.confirm(
        "Reject this proof? The winning bid is marked refunded. No money moves.",
      );
      if (!confirmed) {
        return;
      }
    }

    setMessage("");
    setBusyId(proofId);
    const response = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, proof_id: proofId }),
    });
    const payload = (await response.json()) as { error?: string };
    setBusyId("");
    if (!response.ok) {
      setMessage(payload.error || "Failed.");
      return;
    }
    router.refresh();
  }

  async function readyGlb(event: DraftEvent) {
    const file = glbFiles[event.id] ?? null;
    const reason = file ? glbFileError(file) : "Upload a .glb file.";
    if (!file || reason) {
      setMessage(reason);
      return;
    }
    const header = await file.slice(0, 4).arrayBuffer();
    if (!isGlbMagic(header)) {
      setMessage("That file is not a .glb.");
      return;
    }

    const supabase = createBrowserSupabase();
    if (!supabase) {
      setMessage("Auth is not configured yet.");
      return;
    }

    setMessage("");
    setBusyId(event.id);
    try {
      const signResponse = await fetch("/api/admin/glb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sign",
          event_id: event.id,
          name: file.name,
          size: file.size,
        }),
      });
      const signed = (await signResponse.json()) as {
        error?: string;
        path?: string;
        token?: string;
      };
      if (!signResponse.ok || !signed.path || !signed.token) {
        setMessage(signed.error || "Could not start the upload.");
        return;
      }

      const { error: uploadError } = await supabase.storage
        .from(AVATARS_BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, file, {
          contentType: "model/gltf-binary",
        });
      if (uploadError) {
        setMessage(uploadError.message || "Could not store the .glb.");
        return;
      }

      const publishResponse = await fetch("/api/admin/glb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", event_id: event.id }),
      });
      const published = (await publishResponse.json()) as {
        error?: string;
        slug?: string;
        status?: string;
      };
      if (!publishResponse.ok || published.status !== "live") {
        setMessage(published.error || "Could not take the event live.");
        return;
      }

      setGlbFiles((current) => ({ ...current, [event.id]: null }));
      router.refresh();
    } catch (error) {
      console.log("Admin GLB failed", error);
      setMessage(error instanceof Error ? error.message : "Could not take the event live.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="flex flex-col gap-10">
      {message ? (
        <p className="text-[13px] text-danger" role="alert">
          {message}
        </p>
      ) : null}

      <section>
        <h2 className="text-[22px] font-semibold">Draft events</h2>
        <p className="mt-2 max-w-xl text-[14px] text-muted">
          Upload a .glb. That marks the body ready and takes the event live. Scan
          videos stay files only.
        </p>
        {drafts.length === 0 ? (
          <p className="mt-4 text-[15px] text-muted">No draft events.</p>
        ) : (
          <ul className="admin-list mt-4">
            {drafts.map((event) => {
              const busy = busyId === event.id;
              const file = glbFiles[event.id] ?? null;
              return (
                <li key={event.id} className="bib admin-card">
                  <div>
                    <p className="bib-title">{event.name}</p>
                    <p className="mt-1 text-[14px] text-muted">{event.athleteName}</p>
                    <p className="font-mono text-[12px] text-muted">
                      {event.city ?? "-"} · {event.sport ?? "-"} ·{" "}
                      {formatEventDate(event.date)}
                    </p>
                    <p className="mt-1 font-mono text-[12px] text-muted">
                      /e/{event.slug} stays draft until this lands
                    </p>
                  </div>
                  <div className="admin-glb">
                    <label className="min-w-0 flex-1">
                      <span className="field-label">Body file (.glb)</span>
                      <input
                        className="field pt-2 text-[13px]"
                        type="file"
                        accept=".glb,model/gltf-binary"
                        disabled={busy}
                        onChange={(change) =>
                          setGlbFiles((current) => ({
                            ...current,
                            [event.id]: change.target.files?.[0] ?? null,
                          }))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="btn btn-solid"
                      disabled={busy || !file}
                      onClick={() => void readyGlb(event)}
                    >
                      {busy ? "Saving…" : "Ready GLB"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-[22px] font-semibold">Pending proofs</h2>
        <p className="mt-2 max-w-xl text-[14px] text-muted">
          Approve keeps the winning bid as won. Reject marks that bid failed.
          This page does not move money.
        </p>
        {proofs.length === 0 ? (
          <div className="mt-4">
            <EmptyState line="No pending proofs." />
          </div>
        ) : (
          <ul className="admin-list mt-4">
            {proofs.map((proof) => {
              const busy = busyId === proof.id;
              return (
                <li key={proof.id} className="bib admin-card">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="bib-title">{proof.eventName}</p>
                      <p className="mt-1 text-[14px] text-muted">{proof.athleteName}</p>
                      <p className="text-[14px] text-muted">
                        {proof.zones.length > 0
                          ? proof.zones.join(", ")
                          : "No winning zone"}
                      </p>
                    </div>
                    <div className="admin-actions">
                      <button
                        type="button"
                        className="btn btn-solid"
                        disabled={busy}
                        onClick={() => postProof("approve", proof.id)}
                      >
                        {busy ? "Saving…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={busy}
                        onClick={() => postProof("reject", proof.id)}
                      >
                        Reject
                      </button>
                    </div>
                  </div>

                  {proof.files.length === 0 ? (
                    <p className="mt-4 text-[13px] text-muted">No files on this proof.</p>
                  ) : (
                    <ul className="proof-thumbs">
                      {proof.files.map((file) => (
                        <li key={file.path}>
                          {file.url ? (
                            <a href={file.url} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={file.url} alt={file.name} />
                              <span>{file.name}</span>
                            </a>
                          ) : (
                            <span className="block break-all text-[12px] text-muted">
                              {file.name}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
