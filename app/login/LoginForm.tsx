"use client";

import { FormEvent, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const supabase = createBrowserSupabase();
    if (!supabase) {
      setMessage("Auth is not configured yet.");
      return;
    }
    setBusy(true);
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
      },
    });
    setBusy(false);
    if (error) {
      console.log("Magic link failed", error.message);
      setMessage("Could not send the link. Try again.");
      return;
    }
    console.log("Magic link sent");
    setMessage("Check your email for the login link.");
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm">
      <label className="block">
        <span className="field-label">Email</span>
        <input
          className="field"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@email.com"
        />
      </label>
      <button type="submit" disabled={busy} className="btn btn-solid mt-5 w-full">
        {busy ? "Sending…" : "Send magic link"}
      </button>
      {message ? <p className="mt-4 text-[14px] text-muted">{message}</p> : null}
    </form>
  );
}
