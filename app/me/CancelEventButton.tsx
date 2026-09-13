"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelEventButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function cancel() {
    setBusy(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/events/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: eventId }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setErrorMessage(payload.error || "Could not cancel.");
        return;
      }
      console.log("Event cancelled");
      router.refresh();
    } catch (error) {
      console.log("Event cancel failed", error);
      setErrorMessage("Could not cancel.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="btn btn-danger"
        disabled={busy}
        onClick={cancel}
      >
        {busy ? "Cancelling" : "Cancel"}
      </button>
      {errorMessage ? (
        <p className="mt-2 text-[13px] text-danger" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
