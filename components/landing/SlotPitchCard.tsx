"use client";

// Card that parks on the right of the 3D body after you click a slot.
// It stays open until you hit X. Join waitlist opens the form popup.

type Props = {
  label: string;
  onClose: () => void;
  onJoinWaitlist: () => void;
};

export default function SlotPitchCard({
  label,
  onClose,
  onJoinWaitlist,
}: Props) {
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
        This is a preview, not a live auction. Join the waitlist and we will
        email you when this slot is for sale.
      </p>
      <button
        type="button"
        className="press-btn hud-pitch-cta"
        onClick={() => {
          console.log("Slot pitch joined waitlist", label);
          onJoinWaitlist();
        }}
      >
        <span className="press-btn-plate" aria-hidden="true" />
        <span className="press-btn-face">Join waitlist</span>
      </button>
    </div>
  );
}
