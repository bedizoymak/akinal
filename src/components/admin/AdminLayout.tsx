import { NavLink, Outlet, Navigate, useNavigate } from "react-router-dom";
import { LayoutDashboard, FolderKanban, PlusSquare, Image as ImageIcon, Inbox, Settings, LogOut, Menu, Users, UserPlus, CalendarClock, Wallet, Receipt, PieChart, Bell, FileBarChart } from "lucide-react";
import NotificationBell from "@/components/admin/NotificationBell";
import logoImg from "@/assets/logo.png";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

const ITEMS = [
  { to: "/admin", label: "Panel Ana Sayfa", icon: LayoutDashboard, end: true },
  { to: "/admin/projeler", label: "Projeler", icon: FolderKanban },
  { to: "/admin/projeler/yeni", label: "Yeni Proje Ekle", icon: PlusSquare },
  { to: "/admin/musteriler", label: "Müşteriler", icon: Users },
  { to: "/admin/musteriler/yeni", label: "Yeni Müşteri Ekle", icon: UserPlus },
  { to: "/admin/odeme-planlari", label: "Ödeme Planları", icon: CalendarClock },
  { to: "/admin/tahsilatlar", label: "Tahsilatlar", icon: Wallet },
  { to: "/admin/giderler", label: "Giderler", icon: Receipt },
  { to: "/admin/finans-dashboard", label: "Finans Dashboard", icon: PieChart },
  { to: "/admin/medya", label: "Medya Galerisi", icon: ImageIcon },
  { to: "/admin/talepler", label: "İletişim Talepleri", icon: Inbox },
  { to: "/admin/ayarlar", label: "Site Ayarları", icon: Settings },
];

export default function AdminLayout() {
  const { session, isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Yükleniyor...</div>;
  if (!session) return <Navigate to="/admin/giris" replace />;
  if (!isAdmin) return <Navigate to="/admin/giris" replace />;

  async function logout() {
    await supabase.auth.signOut();
    nav("/admin/giris", { replace: true });
  }

  return (
    <div className="min-h-screen bg-surface-light flex">
      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-40 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform",
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="p-5 border-b border-sidebar-border flex items-center gap-3">
          <div className="bg-white rounded-md p-1.5 shadow-card-soft">
            <img src={logoImg} alt="Akınal İnşaat" className="h-9 w-auto object-contain" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold">Akınal İnşaat</div>
            <div className="text-[10px] uppercase tracking-[0.15em] opacity-70">Yönetim Paneli</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {ITEMS.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                isActive ? "bg-accent text-accent-foreground font-semibold" : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-white"
              )}
            >
              <it.icon className="h-4 w-4" />
              {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <Button onClick={logout} variant="ghost" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-white">
            <LogOut className="h-4 w-4 mr-2" /> Çıkış Yap
          </Button>
        </div>
      </aside>

      {open && <button className="lg:hidden fixed inset-0 bg-black/50 z-30" onClick={() => setOpen(false)} aria-label="Kapat" />}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-card border-b border-border flex items-center px-4 gap-3 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Menü"><Menu className="h-5 w-5" /></button>
          <div className="font-display font-bold">Akınal İnşaat — Panel</div>
        </header>
        <div className="p-5 md:p-8 flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
