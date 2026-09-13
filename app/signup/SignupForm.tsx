"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  authCallbackHref,
  authErrorCopy,
  continueWithGoogle,
  goThroughAuthCallback,
  PASSWORD_MIN,
  rememberIntendedRole,
} from "@/lib/auth-client";
import {
  loginPath,
  looksLikeEmail,
  type Role,
} from "@/lib/config";
import { createBrowserSupabase, googleAuthEnabled } from "@/lib/supabase/client";

export default function SignupForm({
  role,
  showGoogle,
}: {
  role?: Role | null;
  showGoogle: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState<"password" | "google" | null>(null);
  const [message, setMessage] = useState("");

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
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    const supabase = createBrowserSupabase();
    if (!supabase) {
      setMessage("Auth is not configured yet.");
      return;
    }

    setBusy("password");
    rememberIntendedRole(role);
    const { data, error } = await supabase.auth.signUp({
      email: trimmed,
      password,
      options: {
        emailRedirectTo: authCallbackHref(window.location.origin, role),
      },
    });
    setBusy(null);

    if (error) {
      console.log("Sign up failed", error.message);
      setMessage(authErrorCopy(error.message));
      return;
    }

    if (!data.session) {
      console.log("Sign up needs email confirm", role ?? "no role");
      setMessage(`Check ${trimmed} to confirm your account.`);
      return;
    }

    console.log("Signed up", role ?? "no role");
    goThroughAuthCallback(role);
  }

  async function handleGoogle() {
    setMessage("");
    setBusy("google");
    const error = await continueWithGoogle(role);
    setBusy(null);
    if (error) {
      setMessage(error);
    }
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
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <label className="mt-4 block">
          <span className="field-label">Confirm password</span>
          <input
            className="field"
            type="password"
            name="confirm_password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={busy !== null}
          className="btn btn-solid mt-5"
        >
          {busy === "password" ? "Creating…" : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-[14px] text-muted">
        Already have an account? <Link href={loginPath(role)}>Log in</Link>
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
    </div>
  );
}
