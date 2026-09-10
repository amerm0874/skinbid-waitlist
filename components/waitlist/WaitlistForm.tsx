"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { slotLabel } from "@/lib/demo-landing";
import { trackWaitlistSubmit } from "@/lib/plausible";
import type { Role } from "@/lib/config";

const SUCCESS = "You’re on the list. We’ll email you when we open.";
const SAVE_ERROR = "Could not save. Try again.";

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function errorFromResponse(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    if (response.status === 429) {
      return "Try again later.";
    }
    if (response.status === 400 && payload.error) {
      return payload.error;
    }
    return SAVE_ERROR;
  } catch {
    return SAVE_ERROR;
  }
}

export default function WaitlistForm({
  slot,
  from,
  framed = true,
}: {
  slot?: string;
  from?: Role;
  framed?: boolean;
} = {}) {
  const [role, setRole] = useState<Role | undefined>(from);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [social, setSocial] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [done, setDone] = useState(false);

  // Landing links like /waitlist?from=athlete pre-select, but the person can still switch.
  useEffect(() => {
    if (from) {
      setRole(from);
    }
  }, [from]);

  const shellClass = framed
    ? "form-shell mx-auto w-full max-w-md"
    : "mx-auto w-full";
  const muscleName = slotLabel(slot);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedSocial = social.trim();

    if (!role) {
      setErrorMessage("Choose athlete or brand.");
      return;
    }
    if (!trimmedName) {
      setErrorMessage("Enter your name.");
      return;
    }
    if (!isEmail(trimmedEmail)) {
      setErrorMessage("Enter a real email.");
      return;
    }
    if (!trimmedSocial) {
      setErrorMessage("Enter Instagram or X.");
      return;
    }

    setBusy(true);
    try {
      const fields: Record<string, string> = {
        name: trimmedName,
        social: trimmedSocial,
        from: role,
      };
      if (slot) {
        fields.slot = slot;
      }

      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          social: trimmedSocial,
          company: honeypot,
          from: role,
          fields,
        }),
      });
      if (!response.ok) {
        setErrorMessage(await errorFromResponse(response));
        return;
      }
      trackWaitlistSubmit(role);
      setDone(true);
    } catch {
      setErrorMessage(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className={`${shellClass} text-center`}>
        <p className="text-[18px] leading-7 text-ink">{SUCCESS}</p>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <form onSubmit={handleSubmit} noValidate className="text-center">
        {muscleName ? (
          <p className="mb-5">
            <span className="block text-[12px] text-muted">Selected muscle</span>
            <span className="display mt-1 block text-[28px] leading-none text-accent">
              {muscleName}
            </span>
          </p>
        ) : null}

        <fieldset className="m-0 border-0 p-0">
          <legend className="field-label w-full">I am</legend>
          <div
            className="seg w-full"
            role="radiogroup"
            aria-label="Athlete or brand"
            aria-invalid={errorMessage.startsWith("Choose athlete") || undefined}
          >
            <button
              type="button"
              role="radio"
              aria-checked={role === "athlete"}
              className={`flex-1 ${role === "athlete" ? "is-on" : ""}`}
              onClick={() => {
                setRole("athlete");
                if (errorMessage.startsWith("Choose athlete")) {
                  setErrorMessage("");
                }
              }}
            >
              Athlete
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={role === "brand"}
              className={`flex-1 ${role === "brand" ? "is-on" : ""}`}
              onClick={() => {
                setRole("brand");
                if (errorMessage.startsWith("Choose athlete")) {
                  setErrorMessage("");
                }
              }}
            >
              Brand
            </button>
          </div>
        </fieldset>

        <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
          <label>
            Company
            <input
              name="company"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(event) => setHoneypot(event.target.value)}
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="field-label">Name</span>
          <input
            className="field"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name…"
            aria-invalid={errorMessage.startsWith("Enter your name") || undefined}
          />
        </label>

        <label className="mt-4 block">
          <span className="field-label">Email</span>
          <input
            className="field"
            type="email"
            name="email"
            autoComplete="email"
            spellCheck={false}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@email.com…"
            aria-invalid={errorMessage.includes("email") || undefined}
          />
        </label>

        <label className="mt-4 block">
          <span className="field-label">Social</span>
          <input
            className="field"
            name="social"
            autoComplete="username"
            spellCheck={false}
            value={social}
            onChange={(event) => setSocial(event.target.value)}
            placeholder="@handle…"
            aria-invalid={errorMessage.includes("Instagram") || undefined}
          />
        </label>

        {errorMessage ? (
          <p className="mt-4 text-[13px] text-danger" role="alert" aria-live="polite">
            {errorMessage}
          </p>
        ) : null}

        <button type="submit" disabled={busy} className="btn btn-solid mt-6 w-full">
          {busy ? "Sending…" : "Join the waitlist"}
        </button>
        <p className="mt-3 text-[12px] leading-5 text-muted">
          By joining you agree to the{" "}
          <Link href="/terms" className="underline hover:text-ink">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-ink">
            Privacy
          </Link>{" "}
          pages.
        </p>
      </form>
    </div>
  );
}
