"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  authErrorCopy,
  continueWithGoogle,
  goThroughAuthCallback,
  PASSWORD_MIN,
  rememberAuthReturn,
} from "@/lib/auth-client";
import {
  looksLikeEmail,
  signupPath,
  type Role,
} from "@/lib/config";
import { identifyUser } from "@/lib/analytics";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { ContinueWithGoogle } from "@/components/product/ContinueWithGoogle";

export default function LoginForm({
  role,
  next,
  errorNotice,
}: {
  role?: Role | null;
  next?: string | null;
  errorNotice?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"password" | "google" | null>(null);
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
    rememberAuthReturn(role, next);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    });
    setBusy(null);

    if (error) {
      console.log("Password sign-in failed", error.message);
      setMessage(authErrorCopy(error.message));
      return;
    }

    if (data.user) {
      identifyUser(data.user.id, role);
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

  return (
    <div className="form-shell">
      <ContinueWithGoogle
        busy={busy === "google"}
        disabled={busy !== null}
        onClick={() => void handleGoogle()}
      />

      <form onSubmit={handleSubmit} className="mt-5">
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
          className="btn btn-outline mt-5"
        >
          {busy === "password" ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <Link href={signupPath(role, next)} className="btn btn-outline mt-4">
        Create account
      </Link>

      {message ? <p className="mt-4 text-[14px] text-muted">{message}</p> : null}
    </div>
  );
}
