"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  authErrorCopy,
  continueWithGoogle,
  goThroughAuthCallback,
  PASSWORD_MIN,
  rememberIntendedRole,
  sendLoginLink,
} from "@/lib/auth-client";
import {
  looksLikeEmail,
  signupPath,
  type Role,
} from "@/lib/config";
import { createBrowserSupabase, googleAuthEnabled } from "@/lib/supabase/client";

export default function LoginForm({
  role,
  next,
  errorNotice,
  showGoogle,
}: {
  role?: Role | null;
  next?: string | null;
  errorNotice?: string;
  showGoogle: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"password" | "google" | "link" | null>(null);
  const [message, setMessage] = useState(errorNotice ?? "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const trimmed = email.trim();
    if (!looksLikeEmail(trimmed)) {
      setMessage("Enter a real email.");
      return;
    }
    if (password.length < PASSWORD_MIN) {
      setMessage(`Password needs at least ${PASSWORD_MIN} characters.`);
      return;
    }

    const supabase = createBrowserSupabase();
    if (!supabase) {
      setMessage("Auth is not configured yet.");
      return;
    }

    setBusy("password");
    rememberIntendedRole(role);
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    });
    setBusy(null);

    if (error) {
      console.log("Password sign-in failed", error.message);
      setMessage(authErrorCopy(error.message));
      return;
    }

    console.log("Signed in", role ?? "no role");
    goThroughAuthCallback(role, next);
  }

  async function handleGoogle() {
    setMessage("");
    setBusy("google");
    const error = await continueWithGoogle(role, next);
    setBusy(null);
    if (error) {
      setMessage(error);
    }
  }

  async function handleLoginLink() {
    setMessage("");
    const trimmed = email.trim();
    if (!looksLikeEmail(trimmed)) {
      setMessage("Enter your email first.");
      return;
    }
    setBusy("link");
    const error = await sendLoginLink(trimmed, role, next);
    setBusy(null);
    if (error) {
      setMessage(error);
      return;
    }
    console.log("Login link sent", role ?? "no role");
    setMessage(`Check ${trimmed} for the login link.`);
  }

  return (
    <div className="form-shell">
      <form onSubmit={handleSubmit}>
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
        <label className="mt-4 block">
          <span className="field-label">Password</span>
          <input
            className="field"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            minLength={PASSWORD_MIN}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={busy !== null}
          className="btn btn-solid mt-5"
        >
          {busy === "password" ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-4 text-[14px] text-muted">
        <Link href={signupPath(role)}>Create account</Link>
      </p>

      {showGoogle && googleAuthEnabled() ? (
        <button
          type="button"
          disabled={busy !== null}
          onClick={handleGoogle}
          className="btn btn-ghost mt-5 w-full"
        >
          {busy === "google" ? "Opening Google…" : "Continue with Google"}
        </button>
      ) : null}

      {message ? <p className="mt-4 text-[14px] text-muted">{message}</p> : null}

      <button
        type="button"
        disabled={busy !== null}
        onClick={handleLoginLink}
        className="mt-8 border-0 bg-transparent p-0 text-left text-[13px] text-muted"
      >
        {busy === "link" ? "Sending…" : "Email me a login link"}
      </button>
    </div>
  );
}
