import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import logoImg from "@/assets/logo.png";

export default function AdminAuth() {
  const { session, isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && session && isAdmin) {
    return <Navigate to={(loc.state as any)?.from || "/admin"} replace />;
  }
  if (!loading && session && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-light p-6">
        <div className="max-w-md text-center bg-card border border-border rounded-lg p-8">
          <h1 className="font-display text-2xl font-bold mb-3">Yetkisiz Erişim</h1>
          <p className="text-muted-foreground mb-5">Bu hesabın admin paneline erişim yetkisi bulunmuyor.</p>
          <Button onClick={async () => { await supabase.auth.signOut(); nav(0); }}>Çıkış Yap</Button>
        </div>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/admin` }
        });
        if (error) throw error;
        toast({ title: "Kayıt başarılı", description: "Hesabınız oluşturuldu, panele yönlendiriliyorsunuz." });
      }
      nav("/admin", { replace: true });
    } catch (err: any) {
      toast({
        title: "Hata",
        description: err.message?.includes("Invalid login") ? "E-posta veya şifre hatalı." : (err.message || "İşlem başarısız."),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-dark p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 text-white">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <div className="h-12 w-12 rounded-md bg-accent text-accent-foreground flex items-center justify-center">
              <Building2 className="h-6 w-6" />
            </div>
            <div className="text-left">
              <div className="font-display text-xl font-bold">Akınal İnşaat</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/60">Yönetim Paneli</div>
            </div>
          </div>
          <h1 className="font-display text-2xl font-bold">{mode === "login" ? "Yönetici Girişi" : "Yeni Hesap"}</h1>
          <p className="text-sm text-white/65 mt-1">{mode === "login" ? "Devam etmek için giriş yapın." : "İlk kayıt olan kullanıcı otomatik admin olur."}</p>
        </div>

        <form onSubmit={onSubmit} className="bg-card border border-border rounded-lg p-6 space-y-4 shadow-elegant">
          <div>
            <Label htmlFor="email">E-posta</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="password">Şifre</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} />
          </div>
          <Button type="submit" disabled={busy} className="w-full bg-accent hover:bg-accent-glow text-accent-foreground font-semibold">
            {busy ? "Lütfen bekleyin..." : mode === "login" ? "Giriş Yap" : "Kayıt Ol"}
          </Button>
          <div className="text-center text-sm">
            <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")} className="text-muted-foreground hover:text-accent">
              {mode === "login" ? "Hesabınız yok mu? Kayıt olun" : "Zaten hesabınız var mı? Giriş yapın"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
