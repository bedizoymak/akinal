import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  FolderKanban,
  Inbox,
  Plus,
  Receipt,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Pie,
  PieChart,
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
  daysUntil,
  derivePlanStatus,
  isCanceledStatus,
  isPaidStatus,
  paymentPlanRemainingFromPayments,
  paidForPlan,
  realizedFinancialExpense,
  realizedFinancialIncome,
  safeNumber,
  sumBy,
} from "@/lib/finance";
import { statusBadgeVariant } from "@/lib/projects";
import {
  previewCollectionStatus,
  previewExpenseDistribution,
  previewFinancialSeries,
  previewProjectProfitability,
} from "@/lib/adminPreviewData";
import { cn } from "@/lib/utils";

type DashboardData = {
  projects: any[];
  customers: any[];
  plans: any[];
  payments: any[];
  expenses: any[];
  financialEntries: any[];
  requests: any[];
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
  expenses: "hsl(220 9% 35%)",
  net: "hsl(38 92% 50%)",
};

const pieColors = ["hsl(142 48% 28%)", "hsl(220 9% 35%)", "hsl(38 92% 50%)", "hsl(145 30% 18%)", "hsl(220 9% 55%)"];
const collectionColors = ["hsl(142 48% 28%)", "hsl(38 92% 50%)", "hsl(0 72% 51%)"];

function sumAmount(items: any[]) {
  return sumBy(items, (item) => item.amount);
}

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

function PreviewBadge() {
  return <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Önizleme Verisi</span>;
}

function ChartShell({ children, isPreview }: { children: React.ReactNode; isPreview?: boolean }) {
  return (
    <div className="relative min-h-[280px]">
      {isPreview && <div className="absolute right-0 top-0 z-10"><PreviewBadge /></div>}
      {children}
    </div>
  );
}

function LoadingDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-border bg-card p-4 shadow-card-soft">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-4 h-8 w-36" />
            <Skeleton className="mt-4 h-3 w-full" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-80 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData>(initialData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [projects, customers, plans, payments, expenses, financialEntries, requests] = await Promise.all([
        supabase.from("projects").select("id,title,project_status,location,is_published,slug,sort_order").order("sort_order"),
        (supabase.from("customers" as any).select("*").order("created_at", { ascending: false })) as any,
        (supabase.from("payment_plans" as any).select("*").order("due_date")) as any,
        (supabase.from("payments" as any).select("*").order("payment_date", { ascending: false })) as any,
        (supabase.from("expenses" as any).select("*").order("expense_date", { ascending: false })) as any,
        (supabase.from("financial_entries").select("*").order("entry_date", { ascending: false })) as any,
        supabase.from("contact_requests").select("*").order("created_at", { ascending: false }),
      ]);

      setData({
        projects: projects.data || [],
        customers: (customers.data as any[]) || [],
        plans: (plans.data as any[]) || [],
        payments: (payments.data as any[]) || [],
        expenses: (expenses.data as any[]) || [],
        financialEntries: (financialEntries.data as any[]) || [],
        requests: requests.data || [],
      });
      setLoading(false);
    })();
  }, []);

  const dashboard = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

    const totalIncome = sumAmount(data.payments) + realizedFinancialIncome(data.financialEntries);
    const totalExpenses = sumAmount(data.expenses) + realizedFinancialExpense(data.financialEntries);
    const monthIncome = sumAmount(data.payments.filter((payment) => isThisMonth(payment.payment_date, monthStart, monthEnd)))
      + realizedFinancialIncome(data.financialEntries.filter((entry) => isThisMonth(entry.entry_date, monthStart, monthEnd)));
    const monthExpenses = sumAmount(data.expenses.filter((expense) => isThisMonth(expense.expense_date, monthStart, monthEnd)))
      + realizedFinancialExpense(data.financialEntries.filter((entry) => isThisMonth(entry.entry_date, monthStart, monthEnd)));
    const activeProjects = data.projects.filter((project) => project.project_status !== "Tamamlandı");

    const planRows = data.plans.map((plan) => {
      const paid = paidForPlan(plan.id, data.payments);
      const remaining = paymentPlanRemainingFromPayments(plan, data.payments);
      const status = derivePlanStatus(plan, paid);
      const customer = data.customers.find((item) => item.id === plan.customer_id);
      const project = data.projects.find((item) => item.id === plan.project_id);
      const days = daysUntil(plan.due_date);
      return { ...plan, paid, remaining, status, customer, project, days };
    });

    const pendingCollections = planRows.reduce((sum, plan) => sum + plan.remaining, 0);
    const overdueCollections = planRows
      .filter((plan) => plan.days < 0 && plan.remaining > 0 && !isPaidStatus(plan.status) && !isCanceledStatus(plan.status))
      .reduce((sum, plan) => sum + plan.remaining, 0);
    const upcomingPlans = planRows
      .filter((plan) => plan.days >= 0 && plan.days <= 30 && plan.remaining > 0 && !isPaidStatus(plan.status) && !isCanceledStatus(plan.status))
      .sort((a, b) => a.days - b.days);

    const months = lastSixMonths();
    const monthlyFinancials = months.map((month) => {
      const entries = data.financialEntries.filter((entry) => String(entry.entry_date || "").startsWith(month.key));
      const income = sumAmount(data.payments.filter((payment) => String(payment.payment_date || "").startsWith(month.key))) + realizedFinancialIncome(entries);
      const expenses = sumAmount(data.expenses.filter((expense) => String(expense.expense_date || "").startsWith(month.key))) + realizedFinancialExpense(entries);
      return { month: month.month, income, expenses, net: income - expenses };
    });

    const expenseMap = data.expenses.reduce<Record<string, number>>((acc, expense) => {
      const category = expense.category || "Diğer";
      acc[category] = (acc[category] || 0) + Number(expense.amount || 0);
      return acc;
    }, {});
    const expenseDistribution = Object.entries(expenseMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    const projectProfitability = data.projects
      .map((project) => {
        const projectPayments = data.payments.filter((payment) => payment.project_id === project.id);
        const projectExpenses = data.expenses.filter((expense) => expense.project_id === project.id);
        const projectEntries = data.financialEntries.filter((entry) => entry.project_id === project.id);
        const income = sumAmount(projectPayments) + realizedFinancialIncome(projectEntries);
        const expense = sumAmount(projectExpenses) + realizedFinancialExpense(projectEntries);
        return { ...project, income, expense, net: income - expense };
      })
      .sort((a, b) => b.net - a.net);

    const hasProjectFinance = projectProfitability.some((project) => project.income > 0 || project.expense > 0);
    const paidCollections = planRows.reduce((sum, plan) => sum + plan.paid, 0);
    const openCollections = Math.max(0, pendingCollections - overdueCollections);
    const collectionStatus = [
      { name: "Tahsil Edildi", value: paidCollections },
      { name: "Bekliyor", value: openCollections },
      { name: "Gecikti", value: overdueCollections },
    ].filter((item) => item.value > 0);

    const recentMovements = [
      ...data.payments.map((payment) => ({
        id: `payment-${payment.id}`,
        type: "Tahsilat",
        date: payment.payment_date,
        amount: Number(payment.amount || 0),
        tone: "success" as const,
        customer: data.customers.find((item) => item.id === payment.customer_id),
        project: data.projects.find((item) => item.id === payment.project_id),
      })),
      ...data.expenses.map((expense) => ({
        id: `expense-${expense.id}`,
        type: "Gider",
        date: expense.expense_date,
        amount: Number(expense.amount || 0),
        tone: "danger" as const,
        title: expense.title,
        project: data.projects.find((item) => item.id === expense.project_id),
      })),
      ...data.financialEntries
        .filter((entry) => entry.currency_tag === "TRY")
        .map((entry) => ({
          id: `entry-${entry.id}`,
          type: entry.direction === "Gelir" ? "Finans Geliri" : "Finans Gideri",
          date: entry.entry_date,
          amount: safeNumber(entry.amount),
          tone: entry.direction === "Gelir" ? "success" as const : "danger" as const,
          title: entry.title,
          project: data.projects.find((item) => item.id === entry.project_id),
        })),
    ]
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .slice(0, 8);

    return {
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses,
      monthIncome,
      monthExpenses,
      monthNet: monthIncome - monthExpenses,
      activeProjects,
      pendingCollections,
      overdueCollections,
      upcomingPlans,
      projectProfitability,
      recentMovements,
      newRequests: data.requests.filter((request) => request.status === "Yeni"),
      financialChart: {
        data: data.payments.length || data.expenses.length || data.financialEntries.length ? monthlyFinancials : previewFinancialSeries,
        isPreview: data.payments.length === 0 && data.expenses.length === 0 && data.financialEntries.length === 0,
      },
      expenseChart: {
        data: expenseDistribution.length ? expenseDistribution : previewExpenseDistribution,
        isPreview: expenseDistribution.length === 0,
      },
      projectChart: {
        data: hasProjectFinance ? projectProfitability : previewProjectProfitability,
        isPreview: !hasProjectFinance,
      },
      collectionChart: {
        data: collectionStatus.length ? collectionStatus : previewCollectionStatus,
        isPreview: collectionStatus.length === 0,
      },
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Genel Durum"
        title="Genel Bakış"
        description="Şirketin proje, tahsilat, gider ve kârlılık durumunu tek ekranda izleyin."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/admin/raporlar">
                <BarChart3 className="h-4 w-4" />
                Raporları Gör
              </Link>
            </Button>
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent-glow">
              <Link to="/admin/projeler/yeni">
                <Plus className="h-4 w-4" />
                Yeni Proje
              </Link>
            </Button>
          </>
        }
      />

      {loading ? (
        <LoadingDashboard />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard label="Aktif Projeler" value={dashboard.activeProjects.length} description={`${data.projects.length} toplam proje içinde`} icon={FolderKanban} tone="accent" />
            <AdminMetricCard label="Toplam Müşteri" value={data.customers.length} description="Cari ilişkiler ve proje bağlantıları" icon={Users} tone="default" />
            <AdminMetricCard label="Toplam Tahsilat" value={formatTRY(dashboard.totalIncome)} description="Kayıtlı tahsilat toplamı" icon={Wallet} tone="success" />
            <AdminMetricCard label="Toplam Gider" value={formatTRY(dashboard.totalExpenses)} description="Kayıtlı proje ve genel giderler" icon={Receipt} tone="danger" />
            <AdminMetricCard label="Net Kâr" value={formatTRY(dashboard.netProfit)} description="Tahsilat eksi gider" icon={dashboard.netProfit >= 0 ? TrendingUp : TrendingDown} tone={dashboard.netProfit >= 0 ? "success" : "danger"} />
            <AdminMetricCard label="Bekleyen Tahsilatlar" value={formatTRY(dashboard.pendingCollections)} description="Ödeme planlarında kalan tutar" icon={CalendarClock} tone="warning" />
            <AdminMetricCard label="Vadesi Geçen Alacak" value={formatTRY(dashboard.overdueCollections)} description="Aksiyon gerektiren tahsilatlar" icon={AlertTriangle} tone={dashboard.overdueCollections > 0 ? "danger" : "success"} />
            <AdminMetricCard label="Bu Ayın Özeti" value={formatTRY(dashboard.monthNet)} description={`Tahsilat ${formatTRY(dashboard.monthIncome)} / Gider ${formatTRY(dashboard.monthExpenses)}`} icon={BarChart3} tone={dashboard.monthNet >= 0 ? "success" : "danger"} />
          </div>

          {(dashboard.financialChart.isPreview || dashboard.expenseChart.isPreview || dashboard.projectChart.isPreview || dashboard.collectionChart.isPreview) && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="font-semibold">Demo Önizleme</div>
                <div className="text-amber-800">Gerçek kayıtlar eklendiğinde grafikler otomatik olarak canlı verilerle güncellenecek.</div>
              </div>
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-3">
            <AdminSection title="Finansal Görünüm" description="Aylık gelir, gider ve net kâr eğilimi" className="xl:col-span-2" contentClassName="pt-5">
              <ChartShell isPreview={dashboard.financialChart.isPreview}>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={dashboard.financialChart.data} margin={{ top: 28, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartColors.income} stopOpacity={0.28} />
                        <stop offset="95%" stopColor={chartColors.income} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={chartCurrency} tick={{ fontSize: 12 }} width={56} />
                    <Tooltip formatter={(value: number) => formatTRY(value)} labelFormatter={(label) => `${label} ayı`} />
                    <Legend />
                    <Area type="monotone" dataKey="income" name="Gelir" stroke={chartColors.income} fill="url(#incomeGradient)" strokeWidth={2} />
                    <Area type="monotone" dataKey="expenses" name="Gider" stroke={chartColors.expenses} fill="transparent" strokeWidth={2} />
                    <Bar dataKey="net" name="Net Kâr" fill={chartColors.net} radius={[6, 6, 0, 0]} barSize={18} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartShell>
            </AdminSection>

            <AdminSection title="Gider Dağılımı" description="Giderlerin kategori bazında yoğunluğu" contentClassName="pt-5">
              <ChartShell isPreview={dashboard.expenseChart.isPreview}>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={dashboard.expenseChart.data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={96} paddingAngle={3}>
                      {dashboard.expenseChart.data.map((_, index) => <Cell key={index} fill={pieColors[index % pieColors.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatTRY(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartShell>
            </AdminSection>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <AdminSection title="Proje Kârlılığı" description="Projelerin gelir, gider ve net katkısı" className="xl:col-span-2" contentClassName="pt-5">
              <ChartShell isPreview={dashboard.projectChart.isPreview}>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={dashboard.projectChart.data.slice(0, 6)} layout="vertical" margin={{ top: 28, right: 18, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" tickFormatter={chartCurrency} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="title" width={130} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => formatTRY(value)} />
                    <Legend />
                    <Bar dataKey="income" name="Gelir" fill={chartColors.income} radius={[0, 6, 6, 0]} />
                    <Bar dataKey="expense" name="Gider" fill={chartColors.expenses} radius={[0, 6, 6, 0]} />
                    <Bar dataKey="net" name="Net Kâr" fill={chartColors.net} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartShell>
            </AdminSection>

            <AdminSection title="Tahsilat Durumu" description="Tahsil edilen, bekleyen ve geciken tutarlar" contentClassName="pt-5">
              <ChartShell isPreview={dashboard.collectionChart.isPreview}>
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie data={dashboard.collectionChart.data} dataKey="value" nameKey="name" innerRadius={70} outerRadius={104} paddingAngle={3}>
                      {dashboard.collectionChart.data.map((_, index) => <Cell key={index} fill={collectionColors[index % collectionColors.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatTRY(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartShell>
            </AdminSection>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <AdminSection title="Aktif Projeler" description="Devam eden proje portföyü" className="xl:col-span-2" contentClassName="space-y-3">
              {dashboard.activeProjects.length === 0 ? (
                <AdminEmptyState
                  title="Aktif proje bulunmuyor"
                  description="İlk projeyi ekle adımıyla portföyü oluşturabilir, proje finansını ve görsellerini aynı panelden takip edebilirsiniz."
                  icon={FolderKanban}
                  action={<Button asChild className="bg-accent text-accent-foreground hover:bg-accent-glow"><Link to="/admin/projeler/yeni">İlk Projeyi Ekle</Link></Button>}
                />
              ) : (
                dashboard.activeProjects.slice(0, 6).map((project) => (
                  <Link key={project.id} to={`/admin/projeler/${project.id}/finans`} className="group flex items-center justify-between gap-3 rounded-md border border-border p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:bg-accent/5 hover:shadow-card-soft">
                    <div className="min-w-0">
                      <div className="font-semibold transition-colors group-hover:text-accent">{project.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{project.location || "Konum girilmemiş"}</div>
                    </div>
                    <span className={cn("shrink-0 rounded-md border px-2 py-1 text-xs font-medium", statusBadgeVariant(project.project_status))}>{project.project_status}</span>
                  </Link>
                ))
              )}
            </AdminSection>

            <AdminSection title="Hızlı İşlemler" description="Sık kullanılan yönetim adımları" contentClassName="space-y-2">
              {[
                { to: "/admin/projeler/yeni", label: "İlk Projeyi Ekle" },
                { to: "/admin/musteriler/yeni", label: "İlk Müşteriyi Ekle" },
                { to: "/admin/tahsilatlar", label: "İlk Tahsilatı Kaydet" },
                { to: "/admin/giderler", label: "İlk Gideri Kaydet" },
              ].map((item) => (
                <Button key={item.to} asChild variant="outline" className="group w-full justify-between">
                  <Link to={item.to}>
                    {item.label}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              ))}
            </AdminSection>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <AdminSection title="Yaklaşan İşlemler" description="Önümüzdeki 30 gün içinde takip edilmesi gereken tahsilatlar" contentClassName="space-y-3">
              {dashboard.upcomingPlans.length === 0 ? (
                <AdminEmptyState
                  title="Yaklaşan tahsilat yok"
                  description="İlk tahsilatı kaydet veya ödeme planı oluştur adımıyla yaklaşan tahsilat akışını takip edebilirsiniz."
                  icon={CalendarClock}
                  action={<Button asChild variant="outline"><Link to="/admin/odeme-planlari">Ödeme Planı Oluştur</Link></Button>}
                />
              ) : (
                dashboard.upcomingPlans.slice(0, 6).map((plan) => (
                  <Link key={plan.id} to="/admin/odeme-planlari" className="group flex items-center justify-between gap-3 rounded-md border border-border p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:bg-accent/5 hover:shadow-card-soft">
                    <div className="min-w-0">
                      <div className="font-semibold transition-colors group-hover:text-accent">{plan.customer ? customerDisplayName(plan.customer) : "Müşteri seçilmemiş"}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{plan.project?.title || "Proje seçilmemiş"} · {formatDate(plan.due_date)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-amber-700">{formatTRY(plan.remaining)}</div>
                      <div className="text-xs text-muted-foreground">{plan.days === 0 ? "Bugün" : `${plan.days} gün`}</div>
                    </div>
                  </Link>
                ))
              )}
            </AdminSection>

            <AdminSection title="Son Finansal Hareketler" description="Tahsilat ve gider akışının son kayıtları" contentClassName="space-y-3">
              {dashboard.recentMovements.length === 0 ? (
                <AdminEmptyState
                  title="Finansal hareket yok"
                  description="İlk tahsilatı kaydet veya ilk gideri kaydet adımları tamamlandığında hareketler burada listelenir."
                  icon={Wallet}
                  action={<Button asChild variant="outline"><Link to="/admin/tahsilatlar">İlk Tahsilatı Kaydet</Link></Button>}
                />
              ) : (
                dashboard.recentMovements.map((movement) => (
                  <div key={movement.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:bg-surface-light hover:shadow-card-soft">
                    <div className="min-w-0">
                      <div className="font-semibold">{movement.type}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {movement.customer ? customerDisplayName(movement.customer) : movement.title || "Kayıt"} · {movement.project?.title || "Proje yok"} · {formatDate(movement.date)}
                      </div>
                    </div>
                    <div className={cn("font-bold", movement.tone === "success" ? "text-emerald-700" : "text-red-600")}>{formatTRY(movement.amount)}</div>
                  </div>
                ))
              )}
            </AdminSection>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <AdminSection title="Riskli Alanlar" description="Öncelik verilmesi gereken operasyon sinyalleri" contentClassName="space-y-3">
              <div className={cn("rounded-md border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-soft", dashboard.overdueCollections > 0 ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800")}>
                <div className="font-semibold">Tahsilat Riski</div>
                <div className="mt-1 text-sm">{dashboard.overdueCollections > 0 ? `${formatTRY(dashboard.overdueCollections)} vadesi geçmiş alacak var.` : "Vadesi geçmiş alacak görünmüyor."}</div>
              </div>
              <div className="rounded-md border border-border bg-surface-light p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-card-soft">
                <div className="font-semibold text-foreground">Bekleyen Ödemeler</div>
                <div className="mt-1 text-sm text-muted-foreground">Tedarikçi/personel ödeme takibi için ayrı tablo bulunmuyor. ERP kapsamına alınması önerilir.</div>
              </div>
              <Link to="/admin/talepler" className="block rounded-md border border-border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:bg-accent/5 hover:shadow-card-soft">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">Yeni İletişim Talepleri</div>
                    <div className="mt-1 text-sm text-muted-foreground">Web sitesinden gelen yeni talepler</div>
                  </div>
                  <div className="text-2xl font-bold text-accent">{dashboard.newRequests.length}</div>
                </div>
              </Link>
            </AdminSection>

            <AdminSection title="İlk Kurulum Rehberi" description="Paneli canlı veriye hazırlamak için önerilen başlangıç adımları" contentClassName="grid gap-3 sm:grid-cols-2">
              {[
                { to: "/admin/projeler/yeni", title: "İlk projeyi ekle", icon: FolderKanban },
                { to: "/admin/musteriler/yeni", title: "İlk müşteriyi ekle", icon: Users },
                { to: "/admin/tahsilatlar", title: "İlk tahsilatı kaydet", icon: Wallet },
                { to: "/admin/giderler", title: "İlk gideri kaydet", icon: Receipt },
              ].map((item) => (
                <Link key={item.to} to={item.to} className="group rounded-md border border-border bg-surface-light p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:bg-accent/5 hover:shadow-card-soft">
                  <item.icon className="h-5 w-5 text-accent transition-transform duration-200 group-hover:scale-110" />
                  <div className="mt-3 font-semibold">{item.title}</div>
                  <div className="mt-1 flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-accent">
                    Başla <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              ))}
            </AdminSection>
          </div>
        </>
      )}
    </div>
  );
}
