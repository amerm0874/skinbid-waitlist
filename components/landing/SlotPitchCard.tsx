"use client";

import Link from "next/link";

// Card that parks on the right of the 3D body after you click a slot.
// It stays open until you hit X. The CTA goes to the real demo event page,
// which is where the actual gated bid dock (and its own email capture) lives.

type Props = {
  label: string;
  onClose: () => void;
};

export default function SlotPitchCard({ label, onClose }: Props) {
  return (
    <div
      className="hud-pitch hud-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="hud-pitch-title"
    >
      <div className="hud-pitch-head">
        <h3 id="hud-pitch-title" className="hud-pitch-title">
          {label}
        </h3>
        <button
          type="button"
          className="hud-pitch-close"
          onClick={onClose}
          aria-label="Close slot card"
        >
          ×
        </button>
      </div>
      <p className="hud-pitch-lead">You can put your brand here.</p>
      <p className="hud-pitch-copy">
        This is a preview. Bidding is not open. Floor $100. Money held until
        photos.
      </p>
      <Link href="/e/demo" className="press-btn hud-pitch-cta">
        <span className="press-btn-plate" aria-hidden="true" />
        <span className="press-btn-face">Open the event page</span>
      </Link>
    </div>
  );
}
