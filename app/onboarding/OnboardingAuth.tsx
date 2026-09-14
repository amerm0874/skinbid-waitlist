"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { continueWithGoogle, sendLoginLink } from "@/lib/auth-client";
import { loginPath, looksLikeEmail, type Role } from "@/lib/config";
import { ContinueWithGoogle } from "@/components/product/ContinueWithGoogle";

export default function OnboardingAuth({
  role,
  next,
}: {
  role?: Role | null;
  next?: string | null;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"google" | "link" | null>(null);
  const [message, setMessage] = useState("");

  async function handleGoogle() {
    setMessage("");
    setBusy("google");
    const error = await continueWithGoogle(role, next);
    setBusy(null);
    if (error) {
      setMessage(error);
    }
  }

  async function handleLoginLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const trimmed = email.trim();
    if (!looksLikeEmail(trimmed)) {
      setMessage("Enter a real email.");
      return;
    }
    setBusy("link");
    const error = await sendLoginLink(trimmed, role, next);
    setBusy(null);
    if (error) {
      setMessage(error);
      return;
    }
    setMessage(`Check ${trimmed} for a login link.`);
  }

  return (
    <div className="form-shell">
      <ContinueWithGoogle
        busy={busy === "google"}
        disabled={busy !== null}
        onClick={() => void handleGoogle()}
      />

      <p className="mt-5 text-[13px] text-muted">or email</p>

      <form onSubmit={handleLoginLink} className="mt-4">
        <label className="block">
          <span className="field-label">Email</span>
          <input
            className="field"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={busy !== null}
          className="btn btn-ghost mt-4 w-full"
        >
          {busy === "link" ? "Sending…" : "Email me a login link"}
        </button>
      </form>

      <p className="mt-4 text-[14px] text-muted">
        <Link href={loginPath(role, next)}>Log in with a password</Link>
      </p>

      {message ? <p className="mt-4 text-[14px] text-muted">{message}</p> : null}
    </div>
  );
}
