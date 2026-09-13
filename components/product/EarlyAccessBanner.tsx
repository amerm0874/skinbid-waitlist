"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "skinbid_early_access_dismissed";

export function EarlyAccessBanner() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") {
        setDismissed(true);
      }
    } catch {
      // Private browsing or storage blocked. Leave the banner up.
    }
  }, []);

  if (dismissed) {
    return null;
  }

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Nothing to persist to. Still hides for this view.
    }
  }

  return (
    <div className="early-access-banner">
      <p>Early access — events are live, bidding opens soon.</p>
      <button
        type="button"
        className="early-access-dismiss"
        onClick={dismiss}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
