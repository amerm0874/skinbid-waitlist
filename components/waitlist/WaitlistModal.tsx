"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import WaitlistForm from "@/components/waitlist/WaitlistForm";
import type { Role } from "@/lib/config";

type Props = {
  open: boolean;
  onClose: () => void;
  slot?: string;
  from?: Role;
};

export default function WaitlistModal({
  open,
  onClose,
  slot,
  from,
}: Props) {
  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="modal-shell max-h-[90vh] w-full max-w-md overflow-y-auto overscroll-contain"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative text-center">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="btn btn-ghost absolute top-0 right-0 h-9 px-3"
          >
            Close
          </button>
          <h2 className="display px-16 text-[22px] text-ink">Join the waitlist</h2>
        </div>
        <div className="mt-5">
          <WaitlistForm slot={slot} from={from} framed={false} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
