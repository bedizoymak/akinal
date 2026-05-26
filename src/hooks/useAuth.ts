import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";

async function checkAdmin(user: User) {
  const { data: role, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (error) {
    console.error("Admin role validation failed", {
      userId: user.id,
      code: error.code,
      message: error.message,
    });
    throw error;
  }
  return !!role;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  async function applySession(sess: Session | null) {
    setSession(sess);
    setUser(sess?.user ?? null);
    setAuthError(null);

    if (!sess?.user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    try {
      setIsAdmin(await checkAdmin(sess.user));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Admin rolü doğrulanamadı.";
      setIsAdmin(false);
      setAuthError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setTimeout(() => {
        void applySession(sess);
      }, 0);
    });

    supabase.auth.getSession().then(({ data: { session: sess }, error }) => {
      if (error) {
        console.error("Supabase session lookup failed", error);
        setAuthError(error.message);
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      void applySession(sess);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, user, isAdmin, loading, authError };
}
