import { useCallback, useEffect, useState } from "react";
import { getCurrentAdmin, loginAdmin, logoutAdmin } from "@/lib/apiClient";
import type { AdminUser } from "@/lib/apiTypes";

type AdminSession = {
  user: AdminUser;
};

export function useAuth() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const applyAdmin = useCallback((admin: AdminUser | null) => {
    setUser(admin);
    setSession(admin ? { user: admin } : null);
    setIsAdmin(admin?.role === "admin");
  }, []);

  const refreshAdmin = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const admin = await getCurrentAdmin();
      applyAdmin(admin);
    } catch (error) {
      applyAdmin(null);
      if (error instanceof Error && !error.message.includes("Authentication required")) {
        setAuthError(error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [applyAdmin]);

  async function signIn(email: string, password: string) {
    const admin = await loginAdmin(email, password);
    applyAdmin(admin);
    setAuthError(null);
    return admin;
  }

  async function signOut() {
    await logoutAdmin();
    applyAdmin(null);
  }

  useEffect(() => {
    void refreshAdmin();
  }, [refreshAdmin]);

  return { session, user, isAdmin, loading, authError, signIn, signOut, refreshAdmin };
}
