"use client";

import { useEffect, useState } from "react";
import { PLACEHOLDER_GLB } from "@/lib/capture";
import { ensureModelViewer } from "@/lib/ensure-model-viewer";

// Unpaid capture step only. Real /e/[slug] pages never use this file.
export function CapturePlaceholder() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void ensureModelViewer().then(() => {
      if (!cancelled) {
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="capture-placeholder">
      {!ready ? <p className="capture-placeholder-wait">Loading 3D…</p> : null}
      <model-viewer
        suppressHydrationWarning
        src={PLACEHOLDER_GLB}
        alt="3D body preview"
        camera-controls
        auto-rotate
        auto-rotate-delay="0"
        rotation-per-second="18deg"
        disable-pan
        shadow-intensity="0.6"
        exposure="1"
        environment-image="neutral"
        interaction-prompt="none"
        camera-orbit="0deg 75deg 4.2m"
        field-of-view="34deg"
      />
    </div>
  );
}
