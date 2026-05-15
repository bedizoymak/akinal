import { useMemo, useState } from "react";
import { NavLink, Outlet, Navigate, useLocation, useNavigate, Link } from "react-router-dom";
import {
  BarChart3,
  Bell,
  ChevronRight,
  FileBarChart,
  FolderKanban,
  Home,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Receipt,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import NotificationBell from "@/components/admin/NotificationBell";
import logoImg from "@/assets/logo.png";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_GROUPS = [
  {
    title: "Genel Bakış",
    items: [{ to: "/admin", label: "Genel Bakış", description: "Şirket özeti", icon: LayoutDashboard, end: true }],
  },
  {
    title: "Proje Yönetimi",
    items: [
      { to: "/admin/projeler", label: "Projeler", description: "Proje portföyü", icon: FolderKanban },
      { to: "/admin/medya", label: "Medya", description: "Proje görselleri", icon: ImageIcon },
    ],
  },
  {
    title: "Finans",
    items: [
      { to: "/admin/finans-dashboard", label: "Finans Özeti", description: "Kasa ve kârlılık", icon: BarChart3 },
      { to: "/admin/tahsilatlar", label: "Tahsilatlar", description: "Gelen ödemeler", icon: Wallet },
      { to: "/admin/odeme-planlari", label: "Ödeme Planları", description: "Alacak takibi", icon: Wallet },
      { to: "/admin/giderler", label: "Giderler", description: "Masraf takibi", icon: Receipt },
      { to: "/admin/raporlar", label: "Raporlar", description: "Yönetim raporları", icon: FileBarChart },
    ],
  },
  {
    title: "Cari Yönetimi",
    items: [{ to: "/admin/musteriler", label: "Müşteriler", description: "Cari ve ilişki takibi", icon: Users }],
  },
  {
    title: "Operasyon",
    items: [
      { to: "/admin/talepler", label: "İletişim Talepleri", description: "Web form talepleri", icon: Inbox },
      { to: "/admin/bildirimler", label: "Bildirimler", description: "Hatırlatmalar", icon: Bell },
    ],
  },
  {
    title: "Sistem",
    items: [{ to: "/admin/ayarlar", label: "Ayarlar", description: "Site ayarları", icon: Settings }],
  },
];

const PAGE_META = [
  { path: "/admin/projeler/yeni", title: "Yeni Proje", group: "Proje Yönetimi" },
  { path: "/admin/musteriler/yeni", title: "Yeni Müşteri", group: "Cari Yönetimi" },
  { path: "/admin/projeler", title: "Projeler", group: "Proje Yönetimi" },
  { path: "/admin/musteriler", title: "Müşteriler", group: "Cari Yönetimi" },
  { path: "/admin/finans-dashboard", title: "Finans Özeti", group: "Finans" },
  { path: "/admin/tahsilatlar", title: "Tahsilatlar", group: "Finans" },
  { path: "/admin/odeme-planlari", title: "Ödeme Planları", group: "Finans" },
  { path: "/admin/giderler", title: "Giderler", group: "Finans" },
  { path: "/admin/raporlar", title: "Raporlar", group: "Finans" },
  { path: "/admin/medya", title: "Medya", group: "Proje Yönetimi" },
  { path: "/admin/talepler", title: "İletişim Talepleri", group: "Operasyon" },
  { path: "/admin/bildirimler", title: "Bildirimler", group: "Operasyon" },
  { path: "/admin/ayarlar", title: "Ayarlar", group: "Sistem" },
  { path: "/admin", title: "Genel Bakış", group: "Genel Bakış", exact: true },
];

function findPageMeta(pathname: string) {
  return (
    PAGE_META.find((item) => (item.exact ? pathname === item.path : pathname.startsWith(item.path))) ?? {
      title: "Yönetim Paneli",
      group: "Akınal İnşaat",
    }
  );
}

export default function AdminLayout() {
  const { session, isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const page = useMemo(() => findPageMeta(location.pathname), [location.pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-light text-sm text-muted-foreground">
        Yönetim paneli yükleniyor...
      </div>
    );
  }
  if (!session) return <Navigate to="/admin/giris" replace />;
  if (!isAdmin) return <Navigate to="/admin/giris" replace />;

  async function logout() {
    await supabase.auth.signOut();
    nav("/admin/giris", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-surface-light">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-sidebar text-sidebar-foreground shadow-2xl transition-transform print:hidden lg:static lg:shadow-none",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="border-b border-sidebar-border p-5">
          <Link to="/admin" className="flex items-center gap-3">
            <div className="rounded-md bg-white p-1.5 shadow-card-soft">
              <img src={logoImg} alt="Akınal İnşaat" className="h-10 w-auto object-contain" />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="font-display text-lg font-bold">Akınal İnşaat</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/65">Yönetim Paneli</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-5">
            {NAV_GROUPS.map((group) => (
              <div key={group.title}>
                <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/50">{group.title}</div>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                          isActive
                            ? "bg-accent text-accent-foreground shadow-accent-glow"
                            : "text-sidebar-foreground/82 hover:bg-sidebar-accent hover:text-white",
                        )
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{item.label}</span>
                        <span className="block truncate text-[11px] opacity-65">{item.description}</span>
                      </span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="mb-3 rounded-md bg-sidebar-accent/70 p-3">
            <div className="text-xs text-sidebar-foreground/65">Oturum</div>
            <div className="mt-1 truncate text-sm font-semibold">{session.user.email || "Yönetici"}</div>
          </div>
          <Button onClick={logout} variant="ghost" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-white">
            <LogOut className="mr-2 h-4 w-4" /> Çıkış Yap
          </Button>
        </div>
      </aside>

      {open && <button className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} aria-label="Menüyü kapat" />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-card/95 px-4 backdrop-blur print:hidden md:px-6">
          <div className="flex h-16 items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              aria-label="Menüyü aç"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Home className="h-3.5 w-3.5" />
                <span>{page.group}</span>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">{page.title}</span>
              </div>
              <div className="truncate font-display text-lg font-bold md:text-xl">{page.title}</div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button asChild size="sm" className="hidden bg-accent text-accent-foreground hover:bg-accent-glow md:inline-flex">
                <Link to="/admin/projeler/yeni">
                  <Plus className="h-4 w-4" />
                  Yeni Proje
                </Link>
              </Button>
              <NotificationBell />
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6 xl:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
