import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";

async function checkAdmin(user: User) {
  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (role) return true;
  if (!user.email) return false;

  const { data: allowlisted } = await (supabase
    .from("admin_users" as any)
    .select("id")
    .eq("email", user.email)
    .eq("is_active", true)
    .maybeSingle() as any);

  return !!allowlisted;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        // defer to avoid auth deadlock
        setTimeout(async () => {
          setIsAdmin(await checkAdmin(sess.user));
          setLoading(false);
        }, 0);
      } else {
        setIsAdmin(false);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (!sess) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, user, isAdmin, loading };
}
