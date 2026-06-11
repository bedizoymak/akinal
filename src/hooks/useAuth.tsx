import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getCurrentAdmin, loginAdmin, logoutAdmin } from "@/lib/apiClient";
import type { AdminUser } from "@/lib/apiTypes";

type AdminSession = {
  user: AdminUser;
};

type AuthContextValue = {
  session: AdminSession | null;
  user: AdminUser | null;
  isAdmin: boolean;
  loading: boolean;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<AdminUser>;
  signOut: () => Promise<void>;
  refreshAdmin: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
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

  const signIn = useCallback(async (email: string, password: string) => {
    const admin = await loginAdmin(email, password);
    applyAdmin(admin);
    setAuthError(null);
    return admin;
  }, [applyAdmin]);

  const signOut = useCallback(async () => {
    await logoutAdmin();
    applyAdmin(null);
  }, [applyAdmin]);

  useEffect(() => {
    void refreshAdmin();
  }, [refreshAdmin]);

  const value = useMemo(
    () => ({ session, user, isAdmin, loading, authError, signIn, signOut, refreshAdmin }),
    [session, user, isAdmin, loading, authError, signIn, signOut, refreshAdmin],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth, AuthProvider içinde kullanılmalıdır.");
  }
  return context;
}
