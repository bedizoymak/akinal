import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import logoImg from "@/assets/logo.png";

type LocationState = {
  from?: string;
};

export default function AdminAuth() {
  const { session, isAdmin, loading, signIn, signOut } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && session && isAdmin) {
    return <Navigate to={(loc.state as LocationState | null)?.from || "/admin"} replace />;
  }
  if (!loading && session && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-light p-6">
        <div className="max-w-md text-center bg-card border border-border rounded-lg p-8">
          <h1 className="font-display text-2xl font-bold mb-3">Yetkisiz Erişim</h1>
          <p className="text-muted-foreground mb-5">Bu hesabın admin paneline erişim yetkisi bulunmuyor.</p>
          <Button onClick={async () => { await signOut(); nav(0); }}>Çıkış Yap</Button>
        </div>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await signIn(email, password);
      nav("/admin", { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "İşlem başarısız.";
      toast({
        title: "Hata",
        description: message.includes("Invalid email or password") ? "E-posta veya şifre hatalı." : message,
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
          <div className="inline-flex flex-col items-center gap-3 mb-4">
            <div className="bg-white rounded-md p-3 shadow-card-soft">
              <img src={logoImg} alt="Akinal İnşaat" className="h-14 w-auto object-contain" />
            </div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/70">Yönetim Paneli</div>
          </div>
          <h1 className="font-display text-2xl font-bold">Yönetici Girişi</h1>
          <p className="text-sm text-white/65 mt-1">Devam etmek için giriş yapın.</p>
        </div>

        <form onSubmit={onSubmit} className="bg-card border border-border rounded-lg p-6 space-y-4 shadow-elegant">
          <div>
            <Label htmlFor="email">E-posta</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="password">Şifre</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" minLength={6} />
          </div>
          <Button type="submit" disabled={busy} className="w-full bg-accent hover:bg-accent-glow text-accent-foreground font-semibold">
            {busy ? "Lütfen bekleyin..." : "Giriş Yap"}
          </Button>
        </form>
      </div>
    </div>
  );
}
