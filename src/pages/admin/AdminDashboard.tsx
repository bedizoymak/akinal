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
import { supabase } from "@/integrations/supabase/client";
import { AdminEmptyState, AdminMetricCard, AdminPageHeader, AdminSection } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatTRY,
  formatDate,
  customerDisplayName,
  displayLabel,
  daysUntil,
  derivePlanStatus,
  isCanceledStatus,
  isPaidStatus,
  paymentPlanRemainingFromPayments,
  paidForPlan,
  safeNumber,
  summarizeLedgerFinance,
  type CurrencyTag,
  type EntryDirection,
  type GroupTag,
} from "@/lib/finance";
import { statusBadgeVariant } from "@/lib/projects";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type ProjectRow = Pick<Database["public"]["Tables"]["projects"]["Row"], "id" | "title" | "project_status" | "location" | "is_published" | "slug" | "sort_order">;
type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
type PaymentPlanRow = Database["public"]["Tables"]["payment_plans"]["Row"];
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type ExpenseRow = Database["public"]["Tables"]["expenses"]["Row"];
type FinancialEntryRow = Database["public"]["Tables"]["financial_entries"]["Row"];
type ContactRequestRow = Database["public"]["Tables"]["contact_requests"]["Row"];

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
  projects: ProjectRow[];
  customers: CustomerRow[];
  plans: PaymentPlanRow[];
  payments: PaymentRow[];
  expenses: ExpenseRow[];
  financialEntries: FinancialEntryRow[];
  requests: ContactRequestRow[];
};

const initialData: DashboardData = {
  projects: [],
  customers: [],
  plans: [],
  payments: [],
  expenses: [],
  financialEntries: [],
  requests: [],
};

const chartColors = {
  income: "hsl(142 48% 28%)",
  expenses: "hsl(0 72% 51%)",
  net: "hsl(38 92% 50%)",
};

function isThisMonth(date: string | null | undefined, monthStart: string, monthEnd: string) {
  if (!date) return false;
  return date >= monthStart && date <= monthEnd;
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

function LoadingDashboard() {
  return (
    <div className="space-y-6">
      <div className="rounded-md border border-border bg-card px-5 py-4 text-sm text-muted-foreground shadow-card-soft">
        Veriler hazırlanıyor...
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
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
        const [projects, customers, plans, payments, expenses, financialEntries, requests] = await Promise.all([
          supabase.from("projects").select("id,title,project_status,location,is_published,slug,sort_order").order("sort_order"),
          supabase.from("customers").select("id,customer_type,full_name,company_name,phone,email,status,created_at,updated_at,tax_or_identity_number,whatsapp,address,city,district,notes").order("created_at", { ascending: false }),
          supabase.from("payment_plans").select("id,customer_id,project_id,title,amount,due_date,status,description,notes,created_at,updated_at").order("due_date"),
          supabase.from("payments").select("id,customer_id,project_id,payment_plan_id,amount,payment_date,payment_method,description,document_url,created_at,updated_at").order("payment_date", { ascending: false }),
          supabase.from("expenses").select("id,project_id,customer_id,title,category,amount,expense_date,description,document_url,created_at,updated_at").order("expense_date", { ascending: false }),
          supabase.from("financial_entries").select("id,project_id,entry_date,card_type,customer_id,employee_id,expense_card_id,title,description,amount,currency_tag,group_tag,direction,status,document_url,created_at,updated_at").order("entry_date", { ascending: false }),
          supabase.from("contact_requests").select("id,full_name,email,phone,service_type,message,status,created_at").order("created_at", { ascending: false }),
        ]);

        const firstError = [projects.error, customers.error, plans.error, payments.error, expenses.error, financialEntries.error, requests.error].find(Boolean);
        if (firstError) throw firstError;

        setData({
          projects: projects.data || [],
          customers: customers.data || [],
          plans: plans.data || [],
          payments: payments.data || [],
          expenses: expenses.data || [],
          financialEntries: financialEntries.data || [],
          requests: requests.data || [],
        });
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const dashboard = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

    const overallFinance = summarizeLedgerFinance({
      financialEntries: data.financialEntries,
    });
    const monthFinance = summarizeLedgerFinance({
      financialEntries: data.financialEntries,
      from: monthStart,
      to: monthEnd,
    });
    const activeProjects = data.projects.filter((project) => displayLabel(project.project_status) !== "Tamamlandı");

    const planRows = data.plans.map((plan) => {
      const paid = paidForPlan(plan.id, data.payments);
      const remaining = paymentPlanRemainingFromPayments(plan, data.payments);
      const status = derivePlanStatus(plan, paid);
      const customer = data.customers.find((item) => item.id === plan.customer_id);
      const project = data.projects.find((item) => item.id === plan.project_id);
      const days = daysUntil(plan.due_date);
      return { ...plan, paid, remaining, status, customer, project, days };
    });

    const overduePlans = planRows.filter((plan) => plan.days < 0 && plan.remaining > 0 && !isPaidStatus(plan.status) && !isCanceledStatus(plan.status));
    const upcomingPlans = planRows
      .filter((plan) => plan.days >= 0 && plan.days <= 30 && plan.remaining > 0 && !isPaidStatus(plan.status) && !isCanceledStatus(plan.status))
      .sort((a, b) => a.days - b.days);

    const months = lastSixMonths();
    const monthlyFinancials = months.map((month) => {
      const from = `${month.key}-01`;
      const monthDate = new Date(from);
      const to = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).toISOString().slice(0, 10);
      const summary = summarizeLedgerFinance({
        financialEntries: data.financialEntries,
        from,
        to,
      });
      return { month: month.month, income: summary.totalIncome, expenses: summary.totalExpense, net: summary.netBalance };
    });

    const recentMovements: RecentMovement[] = [
      ...data.payments.map((payment) => ({
        id: `payment-${payment.id}`,
        label: data.customers.find((item) => item.id === payment.customer_id)
          ? customerDisplayName(data.customers.find((item) => item.id === payment.customer_id)!)
          : "Tahsilat",
        date: payment.payment_date ?? "",
        amount: safeNumber(payment.amount),
        direction: "Gelir" as const,
        source: "Tahsilat",
        currency: "TRY" as const,
        group: "Resmi" as const,
        projectTitle: data.projects.find((item) => item.id === payment.project_id)?.title,
      })),
      ...data.expenses.map((expense) => ({
        id: `expense-${expense.id}`,
        label: expense.title,
        date: expense.expense_date ?? "",
        amount: safeNumber(expense.amount),
        direction: "Gider" as const,
        source: "Gider",
        currency: "TRY" as const,
        group: "Resmi" as const,
        projectTitle: data.projects.find((item) => item.id === expense.project_id)?.title,
      })),
      ...data.financialEntries
        .filter((entry) => entry.currency_tag === "TRY")
        .map((entry) => ({
          id: `entry-${entry.id}`,
          label: entry.title,
          date: entry.entry_date,
          amount: safeNumber(entry.amount),
          direction: entry.direction as EntryDirection,
          source: entry.direction === "Gelir" ? "Finans Geliri" : "Finans Gideri",
          currency: entry.currency_tag as CurrencyTag,
          group: entry.group_tag as GroupTag,
          projectTitle: data.projects.find((item) => item.id === entry.project_id)?.title,
        })),
    ]
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .slice(0, 6);

    return {
      totalIncome: overallFinance.totalIncome,
      totalExpenses: overallFinance.totalExpense,
      netStatus: overallFinance.netBalance,
      monthIncome: monthFinance.totalIncome,
      monthExpenses: monthFinance.totalExpense,
      monthNet: monthFinance.netBalance,
      activeProjects,
      pendingCollections: overallFinance.receivable,
      expectedPayments: overallFinance.payable,
      overdueCollections: overduePlans.reduce((sum, plan) => sum + plan.remaining, 0),
      overduePlans,
      upcomingPlans,
      recentMovements,
      newRequests: data.requests.filter((request) => request.status === "Yeni"),
      monthlyFinancials,
      hasFinancialData: data.financialEntries.length > 0,
    };
  }, [data]);

  return (
    <div className="space-y-6">
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <AdminMetricCard label="Aktif Projeler" value={dashboard.activeProjects.length} description={`${data.projects.length} toplam proje`} icon={FolderKanban} tone="accent" />
            <AdminMetricCard label="Toplam Tahsilat" value={formatTRY(dashboard.totalIncome)} description="Gerçekleşen gelen ödemeler" icon={Wallet} tone="success" />
            <AdminMetricCard label="Toplam Gider" value={formatTRY(dashboard.totalExpenses)} description="Yapılan masraflar" icon={Receipt} tone="danger" />
            <AdminMetricCard label="Net Durum" value={formatTRY(dashboard.netStatus)} description="Gerçekleşen gelir eksi gider" icon={dashboard.netStatus >= 0 ? TrendingUp : TrendingDown} tone={dashboard.netStatus >= 0 ? "success" : "danger"} />
            <AdminMetricCard label="Beklenen Tahsilat" value={formatTRY(dashboard.pendingCollections)} description="Planlanan gelir kayıtları" icon={CalendarClock} tone="warning" />
            <AdminMetricCard label="Vadesi Geçen Alacak" value={formatTRY(dashboard.overdueCollections)} description={`${dashboard.overduePlans.length} ödeme planı takip bekliyor`} icon={Receipt} tone={dashboard.overdueCollections > 0 ? "danger" : "success"} />
          </div>

          <AdminSection title="Bu Ayın Özeti" description="İçinde bulunduğumuz ayın gerçekleşen gelir, gider ve net durumu.">
            <div className="grid gap-3 md:grid-cols-3">
              <AdminMetricCard label="Bu Ay Tahsilat" value={formatTRY(dashboard.monthIncome)} icon={Wallet} tone="success" />
              <AdminMetricCard label="Bu Ay Gider" value={formatTRY(dashboard.monthExpenses)} icon={Receipt} tone="danger" />
              <AdminMetricCard label="Bu Ay Net Durum" value={formatTRY(dashboard.monthNet)} icon={dashboard.monthNet >= 0 ? TrendingUp : TrendingDown} tone={dashboard.monthNet >= 0 ? "success" : "danger"} />
            </div>
          </AdminSection>

          <div className="grid gap-6 xl:grid-cols-3">
            <AdminSection title="Takip Gerektirenler" description="Bugün bakılması faydalı olan kısa liste." className="xl:col-span-1" contentClassName="space-y-3">
              <Link to="/admin/odeme-planlari" className="block rounded-md border border-border p-3 hover:border-accent/50 hover:bg-accent/5">
                <div className="text-sm font-semibold">Vadesi Geçen Alacak</div>
                <div className={cn("mt-1 text-lg font-bold", dashboard.overdueCollections > 0 ? "text-red-700" : "text-emerald-700")}>{formatTRY(dashboard.overdueCollections)}</div>
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
                    <div key={movement.id} className="flex flex-col gap-3 rounded-md border border-border p-3 hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", isIncome ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>{movement.source}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(movement.date)}</span>
                        </div>
                        <div className="mt-2 truncate font-semibold">{movement.label}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {movement.projectTitle || "Proje bağlantısı yok"} · {movement.group}
                        </div>
                      </div>
                      <div className={cn("shrink-0 text-right text-lg font-extrabold tabular-nums", isIncome ? "text-emerald-700" : "text-red-600")}>
                        {isIncome ? "+" : "-"}{formatTRY(movement.amount)}
                      </div>
                    </div>
                  );
                })
              )}
            </AdminSection>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
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
                  <Link key={project.id} to={`/admin/projeler/${project.id}/finans`} className="flex items-center justify-between gap-3 rounded-md border border-border p-3 hover:border-accent/50 hover:bg-accent/5">
                    <div className="min-w-0">
                      <div className="font-semibold">{project.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{project.location || "Konum girilmemiş"}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={cn("rounded-md border px-2 py-1 text-xs font-medium", statusBadgeVariant(project.project_status))}>{displayLabel(project.project_status)}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))
              )}
            </AdminSection>

            <AdminSection title="Aylık Finans Özeti" description="Son 6 ayın tahsilat, gider ve net durumu.">
              {dashboard.hasFinancialData ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dashboard.monthlyFinancials} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={chartCurrency} tick={{ fontSize: 12 }} width={56} />
                    <Tooltip formatter={(value: number) => formatTRY(value)} />
                    <Legend />
                    <Bar dataKey="income" name="Toplam Tahsilat" fill={chartColors.income} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Toplam Gider" fill={chartColors.expenses} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="net" name="Net Durum" fill={chartColors.net} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
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
