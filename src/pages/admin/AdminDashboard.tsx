import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  FolderKanban,
  Inbox,
  Plus,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AdminEmptyState, AdminMetricCard, AdminPageHeader, AdminSection } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatDate,
  displayLabel,
  formatMoney,
  type CurrencyTag,
  type EntryDirection,
  type GroupTag,
} from "@/lib/finance";
import { statusBadgeVariant } from "@/lib/projects";
import { cn } from "@/lib/utils";
import { getAdminDashboard } from "@/lib/apiClient";
import type {
  AdminDashboardMonthlyFinancial,
  AdminDashboardMovement,
  AdminDashboardPaymentPlan,
  AdminDashboardProject,
  AdminDashboardSummary,
} from "@/lib/apiTypes";

type RecentMovement = {
  id: string;
  label: string;
  amount: number;
  date: string;
  direction: EntryDirection;
  source: string;
  currency: CurrencyTag;
  group: GroupTag;
  projectTitle?: string;
};

type DashboardData = {
  summary: AdminDashboardSummary;
  activeProjects: AdminDashboardProject[];
  overduePlans: AdminDashboardPaymentPlan[];
  upcomingPlans: AdminDashboardPaymentPlan[];
  recentMovements: AdminDashboardMovement[];
  monthlyFinancials: AdminDashboardMonthlyFinancial[];
};

const initialData: DashboardData = {
  summary: {
    total_projects: 0,
    active_projects: 0,
    published_projects: 0,
    draft_projects: 0,
    total_contact_requests: 0,
    new_contact_requests: 0,
    unread_notifications: 0,
    total_customers: 0,
    total_payments: 0,
    total_expenses: 0,
    basic_net_balance: 0,
  },
  activeProjects: [],
  overduePlans: [],
  upcomingPlans: [],
  recentMovements: [],
  monthlyFinancials: [],
};

const chartColors = {
  income: "hsl(142 48% 28%)",
  expenses: "hsl(0 72% 51%)",
  net: "hsl(38 92% 50%)",
};

const dashboardCurrencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

function formatDashboardTRY(value: number) {
  return dashboardCurrencyFormatter.format(value);
}

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toMonthLabel(date: Date) {
  return date.toLocaleDateString("tr-TR", { month: "short" }).replace(".", "");
}

function lastSixMonths() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    return { key: toMonthKey(date), month: toMonthLabel(date) };
  });
}

function chartCurrency(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} mn`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} bin`;
  return value.toLocaleString("tr-TR");
}

function normalizeCurrency(value: string | null | undefined): CurrencyTag {
  return value === "USD" || value === "EUR" ? value : "TRY";
}

function normalizeDirection(value: string | null | undefined): EntryDirection {
  return value === "Gider" ? "Gider" : "Gelir";
}

function normalizeGroup(value: string | null | undefined): GroupTag {
  return value === "Gayri Resmi" ? "Gayri Resmi" : "Resmi";
}

function movementSource(cardType: string | null | undefined) {
  if (cardType === "employee") return "Personel";
  if (cardType === "expense") return "Gider";
  return "Müşteri";
}

function LoadingDashboard() {
  return (
    <div className="w-full max-w-full space-y-7 overflow-x-hidden">
      <div className="rounded-md border border-border bg-card px-5 py-4 text-sm text-muted-foreground shadow-card-soft">
        Veriler hazırlanıyor...
      </div>
      <div className="grid w-full max-w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-md border border-border bg-card p-4 shadow-card-soft">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-4 h-7 w-28" />
            <Skeleton className="mt-3 h-3 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-48 rounded-md" />
      <Skeleton className="h-72 rounded-md" />
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData>(initialData);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const dashboard = await getAdminDashboard();
        setData({
          summary: dashboard.summary,
          activeProjects: dashboard.active_projects_list || [],
          overduePlans: dashboard.overdue_plans || [],
          upcomingPlans: dashboard.upcoming_plans || [],
          recentMovements: dashboard.recent_movements || [],
          monthlyFinancials: dashboard.monthly_financials || [],
        });
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const dashboard = useMemo(() => {
    const months = lastSixMonths();
    const monthlyByKey = new Map(data.monthlyFinancials.map((item) => [item.month_key, item]));
    const monthlyFinancials = months.map((month) => {
      const item = monthlyByKey.get(month.key);
      const income = Number(item?.income || 0);
      const expenses = Number(item?.expenses || 0);
      const net = Number(item?.net ?? income - expenses);
      return { month: month.month, income, expenses, net };
    });
    const recentMovements: RecentMovement[] = data.recentMovements.map((movement) => ({
      id: movement.id,
      label: movement.label || "Finansal hareket",
      amount: Number(movement.amount || 0),
      date: movement.date || "",
      direction: normalizeDirection(movement.direction),
      source: movementSource(movement.card_type),
      currency: normalizeCurrency(movement.currency),
      group: normalizeGroup(movement.group),
      projectTitle: movement.project_title || undefined,
    }));

    return {
      totalIncome: Number(data.summary.total_payments || 0),
      totalExpenses: Number(data.summary.total_expenses || 0),
      netStatus: Number(data.summary.basic_net_balance || 0),
      monthIncome: Number(data.summary.month_income || 0),
      monthExpenses: Number(data.summary.month_expenses || 0),
      monthNet: Number(data.summary.month_net || 0),
      activeProjects: data.activeProjects,
      pendingCollections: Number(data.summary.planned_income || 0),
      expectedPayments: Number(data.summary.expected_payments || 0),
      overdueCollections: Number(data.summary.overdue_collections || 0),
      overduePlans: data.overduePlans,
      upcomingPlans: data.upcomingPlans,
      recentMovements,
      newRequests: Array.from({ length: Number(data.summary.new_contact_requests || 0) }),
      monthlyFinancials,
      hasFinancialData: Boolean(Number(data.summary.financial_entry_count || 0) || data.monthlyFinancials.length || recentMovements.length),
    };
  }, [data]);

  return (
    <div className="w-full max-w-full space-y-6 overflow-x-hidden">
      <AdminPageHeader
        eyebrow="Yönetim Özeti"
        title="Genel Bakış"
        description="Projeler, tahsilatlar, giderler ve net durumu tek ekrandan takip edin."
        actions={
          <>
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent-glow">
              <Link to="/admin/projeler/yeni"><Plus className="h-4 w-4" /> Yeni Proje</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/tahsilatlar?yeni=1"><Wallet className="h-4 w-4" /> Tahsilat Ekle</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/raporlar"><BarChart3 className="h-4 w-4" /> Raporları Gör</Link>
            </Button>
          </>
        }
      />

      {loading ? (
        <LoadingDashboard />
      ) : loadError ? (
        <AdminEmptyState
          title="Veriler alınamadı"
          description="Veriler alınırken bir problem oluştu. Lütfen bağlantınızı kontrol edip tekrar deneyin."
          icon={Wallet}
        />
      ) : (
        <>
          <div className="grid w-full max-w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AdminMetricCard to="/admin/projeler" label="Aktif Projeler" value={data.summary.active_projects} description={`${data.summary.total_projects} toplam proje`} icon={FolderKanban} tone="accent" />
            <AdminMetricCard to="/admin/tahsilatlar" label="Toplam Tahsilat" value={formatDashboardTRY(dashboard.totalIncome)} description="Gerçekleşen gelen ödemeler" icon={Wallet} tone="success" />
            <AdminMetricCard to="/admin/giderler" label="Toplam Gider" value={formatDashboardTRY(dashboard.totalExpenses)} description="Yapılan masraflar" icon={Receipt} tone="danger" />
            <AdminMetricCard to="/admin/finans-ozeti" label="Net Durum" value={formatDashboardTRY(dashboard.netStatus)} description="Gerçekleşen gelir eksi gider" icon={dashboard.netStatus >= 0 ? TrendingUp : TrendingDown} tone={dashboard.netStatus >= 0 ? "success" : "danger"} />
            <AdminMetricCard to="/admin/odeme-planlari" label="Beklenen Tahsilat" value={formatDashboardTRY(dashboard.pendingCollections)} description="Planlanan gelir kayıtları" icon={CalendarClock} tone="warning" />
            <AdminMetricCard to="/admin/odeme-planlari" label="Vadesi Geçen Alacak" value={formatDashboardTRY(dashboard.overdueCollections)} description={`${dashboard.overduePlans.length} ödeme planı takip bekliyor`} icon={Receipt} tone={dashboard.overdueCollections > 0 ? "danger" : "success"} />
          </div>

          <AdminSection title="Bu Ayın Özeti" description="İçinde bulunduğumuz ayın gerçekleşen gelir, gider ve net durumu.">
            <div className="grid w-full max-w-full grid-cols-1 gap-4 md:grid-cols-3">
              <AdminMetricCard label="Bu Ay Tahsilat" value={formatDashboardTRY(dashboard.monthIncome)} icon={Wallet} tone="success" />
              <AdminMetricCard label="Bu Ay Gider" value={formatDashboardTRY(dashboard.monthExpenses)} icon={Receipt} tone="danger" />
              <AdminMetricCard label="Bu Ay Net Durum" value={formatDashboardTRY(dashboard.monthNet)} icon={dashboard.monthNet >= 0 ? TrendingUp : TrendingDown} tone={dashboard.monthNet >= 0 ? "success" : "danger"} />
            </div>
          </AdminSection>

          <div className="grid w-full max-w-full grid-cols-1 gap-6 xl:grid-cols-3">
            <AdminSection title="Takip Gerektirenler" description="Bugün bakılması faydalı olan kısa liste." className="xl:col-span-1" contentClassName="space-y-3">
              <Link to="/admin/odeme-planlari" className="block rounded-md border border-border p-3 hover:border-accent/50 hover:bg-accent/5">
                <div className="text-sm font-semibold">Vadesi Geçen Alacak</div>
                <div className={cn("mt-1 text-lg font-bold", dashboard.overdueCollections > 0 ? "text-red-700" : "text-emerald-700")}>{formatDashboardTRY(dashboard.overdueCollections)}</div>
                <div className="mt-1 text-xs text-muted-foreground">{dashboard.overduePlans.length} ödeme planı takip bekliyor.</div>
              </Link>
              <Link to="/admin/odeme-planlari" className="block rounded-md border border-border p-3 hover:border-accent/50 hover:bg-accent/5">
                <div className="text-sm font-semibold">Yaklaşan Tahsilatlar</div>
                <div className="mt-1 text-lg font-bold text-amber-700">{dashboard.upcomingPlans.length}</div>
                <div className="mt-1 text-xs text-muted-foreground">Önümüzdeki 30 gün içinde.</div>
              </Link>
              <Link to="/admin/talepler" className="block rounded-md border border-border p-3 hover:border-accent/50 hover:bg-accent/5">
                <div className="text-sm font-semibold">Yeni İletişim Talepleri</div>
                <div className="mt-1 text-lg font-bold text-accent">{dashboard.newRequests.length}</div>
                <div className="mt-1 text-xs text-muted-foreground">Web sitesinden gelen yeni talepler.</div>
              </Link>
            </AdminSection>

            <AdminSection title="Son Hareketler" description="Son tahsilat, gider ve finans kayıtları." className="xl:col-span-2" contentClassName="space-y-2">
              {dashboard.recentMovements.length === 0 ? (
                <AdminEmptyState title="Henüz finansal hareket yok" description="İlk finansal hareket eklendiğinde son kayıtlar burada görünecek." icon={Wallet} />
              ) : (
                dashboard.recentMovements.map((movement) => {
                  const isIncome = movement.direction === "Gelir";
                  return (
                    <div key={movement.id} className="flex min-w-0 max-w-full flex-col gap-3 rounded-md border border-border p-3 hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", isIncome ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>{movement.source}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(movement.date)}</span>
                        </div>
                        <div className="mt-2 whitespace-normal break-words font-semibold">{movement.label}</div>
                        <div className="mt-1 whitespace-normal break-words text-xs text-muted-foreground">
                          {movement.projectTitle || "Proje bağlantısı yok"} · {movement.group}
                        </div>
                      </div>
                      <div className={cn("max-w-full shrink-0 self-end whitespace-normal break-words text-right text-lg font-extrabold tabular-nums sm:self-auto", isIncome ? "text-emerald-700" : "text-red-600")}>
                        {isIncome ? "+" : "-"}{formatMoney(movement.amount, movement.currency)}
                      </div>
                    </div>
                  );
                })
              )}
            </AdminSection>
          </div>

          <div className="grid w-full max-w-full grid-cols-1 gap-6 xl:grid-cols-2">
            <AdminSection title="Proje Durumu" description="Devam eden projeler ve hızlı erişim." contentClassName="space-y-2">
              {dashboard.activeProjects.length === 0 ? (
                <AdminEmptyState
                  title="Aktif proje bulunmuyor"
                  description="Yeni proje eklediğinizde proje durumu burada görünecek."
                  icon={FolderKanban}
                  action={<Button asChild><Link to="/admin/projeler/yeni">Yeni Proje Ekle</Link></Button>}
                />
              ) : (
                dashboard.activeProjects.slice(0, 6).map((project) => (
                  <Link key={project.id} to={`/admin/projeler/${project.id}/finans`} className="flex min-w-0 max-w-full flex-col gap-3 rounded-md border border-border p-3 hover:border-accent/50 hover:bg-accent/5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="whitespace-normal break-words font-semibold">{project.title}</div>
                      <div className="mt-1 whitespace-normal break-words text-xs text-muted-foreground">{project.location || "Konum girilmemiş"}</div>
                    </div>
                    <div className="flex max-w-full shrink-0 items-center gap-2 self-start sm:self-auto">
                      <span className={cn("rounded-md border px-2 py-1 text-xs font-medium", statusBadgeVariant(project.project_status))}>{displayLabel(project.project_status)}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))
              )}
            </AdminSection>

            <AdminSection title="Aylık Finans Özeti" description="Son 6 ayın tahsilat, gider ve net durumu.">
              {dashboard.hasFinancialData ? (
                <div className="min-w-0 max-w-full overflow-hidden">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dashboard.monthlyFinancials} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={chartCurrency} tick={{ fontSize: 12 }} width={56} />
                    <Tooltip formatter={(value: number) => formatDashboardTRY(value)} />
                    <Legend />
                    <Bar dataKey="income" name="Toplam Tahsilat" fill={chartColors.income} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Toplam Gider" fill={chartColors.expenses} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="net" name="Net Durum" fill={chartColors.net} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                </div>
              ) : (
                <AdminEmptyState title="Henüz finansal hareket yok" description="Finansal hareket eklendikçe aylık grafik otomatik oluşacak." icon={BarChart3} />
              )}
            </AdminSection>
          </div>
        </>
      )}
    </div>
  );
}
