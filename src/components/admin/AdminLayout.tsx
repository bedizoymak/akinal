import { Suspense, useMemo, useState } from "react";
import { NavLink, Outlet, Navigate, useLocation, useNavigate, Link } from "react-router-dom";
import {
  Bell,
  Building2,
  Calculator,
  ChevronRight,
  FolderKanban,
  HardHat,
  Home,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Tags,
  Wrench,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import NotificationBell from "@/components/admin/NotificationBell";
import AdminMarketTicker from "@/components/admin/AdminMarketTicker";
import logoImg from "@/assets/logo.png";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_GROUPS = [
  {
    title: "Genel",
    items: [
      { to: "/admin", label: "Genel Bakış", description: "Kısa şirket özeti", icon: LayoutDashboard, end: true },
      { to: "/admin/gelenler", label: "Gelenler", description: "Müşteri tahsilat kalemleri", icon: TrendingUp },
      { to: "/admin/gidenler", label: "Gidenler", description: "Tüm gider kalemleri", icon: TrendingDown },
      { to: "/admin/enflasyon-hesaplama", label: "Enflasyon Hesaplama", description: "TÜFE endeksi ile tutar güncelleme", icon: Calculator },
    ],
  },
  {
    title: "Proje Yönetimi",
    items: [
      { to: "/admin/projeler", label: "Projeler", description: "Şantiye ve proje kayıtları", icon: FolderKanban },
      { to: "/admin/medya", label: "Medya", description: "Proje görselleri", icon: ImageIcon },
    ],
  },
  {
    title: "Cari ve Tahsilat",
    items: [
      { to: "/admin/musteriler", label: "Müşteriler", description: "Cari kayıtlar", icon: Users },
      { to: "/admin/devlet-hakedisleri", label: "Devlet Hakedişleri", description: "Hakediş ve teşvik ödemeleri", icon: TrendingUp },
    ],
  },
  {
    title: "Tedarik ve Giderler",
    items: [
      { to: "/admin/tedarikciler", label: "Tedarikçiler", description: "Tedarikçi ve alt yüklenici kartları", icon: Building2 },
      { to: "/admin/gider-kartlari", label: "Masraf Kartları", description: "Proje masraf kartları", icon: Tags },
    ],
  },
  {
    title: "Personel",
    items: [
      { to: "/admin/personeller", label: "Personeller", description: "Usta ve çalışanlar", icon: HardHat },
    ],
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
    items: [
      { to: "/admin/ayarlar",      label: "Ayarlar",       description: "Site ayarları",              icon: Settings },
      { to: "/admin/bakim-konsolu", label: "Bakım Konsolu", description: "Migration ve bakım araçları", icon: Wrench },
    ],
  },
];

type PageMeta = {
  path: string;
  title: string;
  group: string;
  exact?: boolean;
  match?: (pathname: string) => boolean;
};

const PAGE_META: PageMeta[] = [
  { path: "/admin/projeler/yeni", title: "Yeni Proje", group: "Proje Yönetimi" },
  { path: "/admin/musteriler/yeni", title: "Yeni Müşteri", group: "Cari ve Tahsilat" },
  { path: "/admin/projeler/:id/finans", title: "Proje Ekstresi", group: "Proje Yönetimi", match: (pathname) => /^\/admin\/projeler\/[^/]+\/finans$/.test(pathname) },
  { path: "/admin/projeler/:id/giderler", title: "Proje Giderleri", group: "Proje Yönetimi", match: (pathname) => /^\/admin\/projeler\/[^/]+\/giderler$/.test(pathname) },
  { path: "/admin/musteriler/:id/finans", title: "Müşteri Ekstresi", group: "Cari ve Tahsilat", match: (pathname) => /^\/admin\/musteriler\/[^/]+\/finans$/.test(pathname) },
  { path: "/admin/personeller/:id/finans", title: "Personel Ekstresi", group: "Personel", match: (pathname) => /^\/admin\/personeller\/[^/]+\/finans$/.test(pathname) },
  { path: "/admin/gider-kartlari/:id/finans", title: "Gider Kartı Ekstresi", group: "Finans", match: (pathname) => /^\/admin\/gider-kartlari\/[^/]+\/finans$/.test(pathname) },
  { path: "/admin/projeler/:id", title: "Proje Düzenle", group: "Proje Yönetimi", match: (pathname) => /^\/admin\/projeler\/[^/]+$/.test(pathname) },
  { path: "/admin/musteriler/:id/duzenle", title: "Müşteri Düzenle", group: "Cari ve Tahsilat", match: (pathname) => /^\/admin\/musteriler\/[^/]+\/duzenle$/.test(pathname) },
  { path: "/admin/musteriler/:id", title: "Müşteri Detayı", group: "Cari ve Tahsilat", match: (pathname) => /^\/admin\/musteriler\/[^/]+$/.test(pathname) },
  { path: "/admin/projeler", title: "Projeler", group: "Proje Yönetimi" },
  { path: "/admin/musteriler", title: "Müşteriler", group: "Cari ve Tahsilat" },
  { path: "/admin/devlet-hakedisleri", title: "Devlet Hakedişleri", group: "Cari ve Tahsilat" },
  { path: "/admin/personeller", title: "Personeller", group: "Personel" },
  { path: "/admin/finans-dashboard", title: "Finans Özeti", group: "Finans" },
  { path: "/admin/gelenler", title: "Gelenler", group: "Cari ve Tahsilat" },
  { path: "/admin/gidenler", title: "Gidenler", group: "Tedarik ve Giderler" },
  { path: "/admin/net-durum", title: "Net Durum", group: "Genel" },
  { path: "/admin/tahsilatlar", title: "Tahsilatlar", group: "Cari ve Tahsilat" },
  { path: "/admin/giderler", title: "Giderler", group: "Tedarik ve Giderler" },
  { path: "/admin/gider-kartlari", title: "Masraf Kartları", group: "Tedarik ve Giderler" },
  { path: "/admin/raporlar", title: "Raporlar", group: "Raporlar" },
  { path: "/admin/tedarikciler/yeni", title: "Yeni Tedarikçi", group: "Tedarik ve Giderler" },
  { path: "/admin/tedarikciler/:id/duzenle", title: "Tedarikçi Düzenle", group: "Tedarik ve Giderler", match: (pathname) => /^\/admin\/tedarikciler\/[^/]+\/duzenle$/.test(pathname) },
  { path: "/admin/tedarikciler/:id", title: "Tedarikçi Detayı", group: "Tedarik ve Giderler", match: (pathname) => /^\/admin\/tedarikciler\/[^/]+$/.test(pathname) },
  { path: "/admin/tedarikciler", title: "Tedarikçiler", group: "Tedarik ve Giderler" },
  { path: "/admin/medya", title: "Medya", group: "Proje Yönetimi" },
  { path: "/admin/talepler", title: "İletişim Talepleri", group: "Operasyon" },
  { path: "/admin/bildirimler", title: "Bildirimler", group: "Operasyon" },
  { path: "/admin/ayarlar", title: "Ayarlar", group: "Sistem" },
  { path: "/admin/sql-editor",    title: "SQL Editörü",  group: "Sistem" },
  { path: "/admin/bakim-konsolu", title: "Bakım Konsolu", group: "Sistem" },
  { path: "/admin", title: "Genel Bakış", group: "Genel", exact: true },
];

function findPageMeta(pathname: string) {
  return (
    PAGE_META.find((item) => (item.match ? item.match(pathname) : item.exact ? pathname === item.path : pathname.startsWith(item.path))) ?? {
      title: "Yönetim Paneli",
      group: "Akınal İnşaat",
    }
  );
}

export default function AdminLayout() {
  const { session, isAdmin, loading, authError, signOut } = useAuth();
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
  if (authError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-light p-6">
        <div className="max-w-md rounded-md border border-border bg-card p-6 text-center shadow-card-soft">
          <h1 className="font-display text-xl font-bold">Yönetici yetkisi doğrulanamadı</h1>
          <p className="mt-2 text-sm text-muted-foreground">{authError}</p>
          <Button onClick={logout} className="mt-5">Tekrar Giriş Yap</Button>
        </div>
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/admin/giris" replace />;

  async function logout() {
    await signOut();
    nav("/admin/giris", { replace: true });
  }

  return (
    <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-surface-light">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-sidebar text-sidebar-foreground shadow-2xl transition-transform duration-200 print:hidden lg:static lg:shadow-none",
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
                          "group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-all duration-200 hover:translate-x-0.5",
                          isActive
                            ? "bg-accent text-accent-foreground shadow-accent-glow ring-1 ring-white/10"
                            : "text-sidebar-foreground/82 hover:bg-sidebar-accent hover:text-white hover:shadow-card-soft",
                        )
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
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

      <div className="flex min-w-0 max-w-full flex-1 flex-col overflow-x-hidden">
        <header className="sticky top-0 z-20 w-full max-w-full overflow-x-hidden border-b border-border bg-card/95 px-4 backdrop-blur print:hidden md:px-6">
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
              <AdminMarketTicker />
              <NotificationBell />
            </div>
          </div>
        </header>
        <main className="min-w-0 w-full max-w-full flex-1 overflow-x-hidden p-4 md:p-6 xl:p-8">
          <Suspense fallback={<div className="py-10 text-center text-sm text-muted-foreground">Sayfa yükleniyor...</div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
