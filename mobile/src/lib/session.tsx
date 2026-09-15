// Ported from the web app's lib/auth.ts getSessionUser() + lib/config.ts
// destinationAfterAuth(). Same shape (session, user, profile), but exposed as
// a React context/hook since there's no server component to run this in.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { fetchProfile } from "@/lib/queries";
import { destinationForProfile, type AuthProfile } from "@/lib/config";
import type { Profile } from "@/lib/types";

type SessionState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  destination: "onboarding" | "me" | "events";
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  async function loadProfile(userId: string) {
    const row = await fetchProfile(userId);
    setProfile(row);
  }

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) {
        await loadProfile(data.session.user.id);
      }
      if (active) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        await loadProfile(nextSession.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<SessionState>(() => {
    const user = session?.user ?? null;
    return {
      loading,
      session,
      user,
      profile,
      destination: destinationForProfile(profile as AuthProfile | null),
      refreshProfile: async () => {
        if (user) await loadProfile(user.id);
      },
      signOut: async () => {
        await supabase.auth.signOut();
        setProfile(null);
      },
    };
  }, [loading, session, profile]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
