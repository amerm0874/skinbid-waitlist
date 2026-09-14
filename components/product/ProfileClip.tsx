"use client";

import { useState } from "react";

export function ProfileClip({ src }: { src: string }) {
  const [muted, setMuted] = useState(true);

  return (
    <button
      type="button"
      className="athlete-clip"
      onClick={() => setMuted((value) => !value)}
      aria-label={muted ? "Unmute clip" : "Mute clip"}
    >
      <video
        className="athlete-face-photo"
        src={src}
        autoPlay
        muted={muted}
        loop
        playsInline
        preload="metadata"
      />
      <span className="athlete-clip-hint">
        {muted ? "Tap for sound" : "Sound on"}
      </span>
    </button>
  );
}
