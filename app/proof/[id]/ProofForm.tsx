"use client";

import { FormEvent, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

export default function ProofForm({
  eventId,
  userId,
}: {
  eventId: string;
  userId: string;
}) {
  const [files, setFiles] = useState<FileList | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createBrowserSupabase();
    if (!supabase || !files || files.length < 3) {
      setMessage("Upload 2 zone photos and 1 event photo.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const paths: string[] = [];
      for (const file of Array.from(files)) {
        const path = `${userId}/${eventId}/${file.name}`;
        const { error } = await supabase.storage
          .from("proofs")
          .upload(path, file, { upsert: true });
        if (error) {
          throw error;
        }
        paths.push(path);
      }
      const { error } = await supabase.from("proofs").insert({
        event_id: eventId,
        files: paths,
        status: "pending",
      });
      if (error) {
        throw error;
      }
      console.log("Proof uploaded", eventId);
      setMessage("Proof sent. We review within 48 hours.");
    } catch (error) {
      console.log("Proof upload failed", error);
      setMessage("Upload failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md">
      <label className="block">
        <span className="field-label">
          2 photos of the mark on the correct zone, plus 1 photo at the event
        </span>
        <input
          className="field pt-2 text-[13px]"
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setFiles(e.target.files)}
        />
      </label>
      <button type="submit" disabled={busy} className="btn btn-solid mt-5">
        {busy ? "Uploading…" : "Submit proof"}
      </button>
      {message ? <p className="mt-4 text-[14px] text-muted">{message}</p> : null}
    </form>
  );
}
