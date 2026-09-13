"use client";

import { useState, type FormEvent } from "react";

export function BidGate({ slug }: { slug: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrorMessage("Enter a real email.");
      return;
    }
    setBusy(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/brand-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, event_slug: slug }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setErrorMessage(payload.error || "Could not save. Try again.");
        return;
      }
      console.log("Early access requested", slug);
      setDone(true);
    } catch (error) {
      console.log("Early access request failed", error);
      setErrorMessage("Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="bid-gate">
        <p className="bid-gate-done">You&rsquo;re on the list</p>
      </div>
    );
  }

  return (
    <div className="bid-gate">
      <h2 className="bid-gate-title display">Bidding opens soon</h2>
      <p className="bid-gate-sub">
        We&rsquo;re onboarding athletes first. Leave your email to bid in the
        first round.
      </p>
      <form onSubmit={handleSubmit} className="bid-gate-form">
        <input
          type="email"
          className="field"
          placeholder="you@brand.com"
          aria-label="Email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button
          type="submit"
          className="cta-press cta-press-full bid-gate-cta"
          disabled={busy}
        >
          <span className="cta-press-plate" aria-hidden="true" />
          <span className="cta-press-face">
            {busy ? "Saving…" : "Request early access"}
          </span>
        </button>
      </form>
      {errorMessage ? (
        <p className="fine text-danger">{errorMessage}</p>
      ) : null}
    </div>
  );
}
