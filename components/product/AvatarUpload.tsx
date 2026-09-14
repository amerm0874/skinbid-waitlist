"use client";

import { useRef, useState } from "react";
import { avatarClientError, uploadAvatarPhoto } from "@/lib/photo";
import { logoClientError } from "@/lib/logo";
import { uploadBrandLogo } from "@/lib/uploads";

function nameInitial(name: string) {
  const letter = name.trim().slice(0, 1);
  return letter ? letter.toUpperCase() : "?";
}

export function AvatarUpload({
  userId,
  name,
  initialUrl,
  kind = "photo",
}: {
  userId: string;
  name: string;
  initialUrl: string | null;
  kind?: "photo" | "logo";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const isLogo = kind === "logo";

  async function handleFile(file: File) {
    const invalid = isLogo ? logoClientError(file) : avatarClientError(file);
    if (invalid) {
      setErrorMessage(invalid);
      return;
    }
    setBusy(true);
    setErrorMessage("");
    try {
      const publicUrl = isLogo
        ? await uploadBrandLogo(userId, file)
        : await uploadAvatarPhoto(userId, file);
      const response = await fetch("/api/profile/photo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isLogo ? { logo_url: publicUrl } : { photo_url: publicUrl },
        ),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error || "Could not save photo.");
      }
      console.log(isLogo ? "Brand logo updated" : "Avatar updated");
      setUrl(publicUrl);
    } catch (error) {
      console.log("Avatar upload failed", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Could not save photo.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="avatar-upload-wrap">
      <button
        type="button"
        className="avatar-upload"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label={url ? "Change photo" : "Add photo"}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={url} src={url} alt="" className="avatar-upload-photo" />
        ) : (
          <span className="avatar-upload-initial" aria-hidden="true">
            {nameInitial(name)}
          </span>
        )}
        <span className="avatar-upload-overlay">
          {busy ? "Saving…" : "Change"}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={isLogo ? "image/png" : "image/jpeg,image/png,image/webp"}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.target.value = "";
          if (file) {
            void handleFile(file);
          }
        }}
      />
      {errorMessage ? <p className="avatar-upload-error">{errorMessage}</p> : null}
    </div>
  );
}
