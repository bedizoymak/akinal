import { useMemo, useState } from "react";
import { useFinanceAll } from "@/hooks/useFinanceData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Printer, FileText } from "lucide-react";
import {
  formatTRY,
  formatDate,
  accountType,
  allocateCollectionsToPlans,
  customerDisplayName,
  derivePlanStatus,
  displayLabel,
  effectivePaidForPlan,
  exportCSV,
  exportPDF,
  statusBadgeClass,
  daysUntil,
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  FINANCE_COLORS,
  printCurrentReport,
  safeNumber,
  summarizeLedgerFinance,
  sumBy,
} from "@/lib/finance";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import logoImg from "@/assets/logo.png";
import { AdminPageHeader } from "@/components/admin/AdminPage";
import type { AdminPayment, AdminPaymentPlan } from "@/lib/apiTypes";

function inDateRange(d: string, from: string, to: string): boolean {
  if (!d) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function entriesInDateRange(entries: any[], from: string, to: string) {
  return entries.filter((entry) => inDateRange(entry.entry_date, from, to));
}

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-card-soft">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className={`mt-2 break-words text-2xl font-extrabold leading-tight tabular-nums ${color || ""}`}>{value}</div>
    </div>
  );
}

function ReportHeader({ title, dateRange }: { title: string; dateRange: string }) {
  return (
    <div className="hidden print:block mb-6 pb-4 border-b">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <img src={logoImg} alt="Akınal İnşaat" className="h-12" />
          <div>
            <div className="font-display font-bold text-xl">Akınal İnşaat</div>
            <div className="text-xs text-muted-foreground">Yönetim Paneli</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">{dateRange}</div>
          <div className="text-xs text-muted-foreground">Oluşturulma: {formatDate(new Date())}</div>
        </div>
      </div>
    </div>
  );
}

function ReportFooter() {
  return (
    <div className="hidden print:block mt-8 pt-4 border-t text-xs text-center text-muted-foreground">
      Akınal İnşaat Yönetim Paneli tarafından oluşturulmuştur.
    </div>
  );
}

function Filters({ children }: any) {
  return <Card className="mb-4 print:hidden"><CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">{children}</CardContent></Card>;
}

function paymentAsFinanceEntry(payment: any) {
  return {
    id: `legacy-payment-${payment.id}`,
    project_id: payment.project_id,
    entry_date: payment.payment_date,
    card_type: "customer",
    customer_id: payment.customer_id,
    amount: payment.amount,
    currency_tag: "TRY",
    group_tag: payment.account_type === "gayri_resmi" ? "Gayri Resmi" : "Resmi",
    direction: "Gelir",
    status: "Gerçekleşti",
  };
}

function expenseAsFinanceEntry(expense: any) {
  return {
    id: `legacy-expense-${expense.id}`,
    project_id: expense.project_id,
    entry_date: expense.expense_date,
    card_type: "expense",
    customer_id: expense.customer_id,
    amount: expense.amount,
    currency_tag: "TRY",
    group_tag: "Resmi",
    direction: "Gider",
    status: "Gerçekleşti",
  };
}

function mysqlFinanceEntries(data: any) {
  return [
    ...data.financialEntries.data,
    ...data.payments.data.map(paymentAsFinanceEntry),
    ...data.expenses.data.map(expenseAsFinanceEntry),
  ];
}

type EnrichedPaymentPlan = AdminPaymentPlan & {
  paid: number;
  remaining: number;
  computed: string;
};

function enrichCustomerPaymentPlans(plans: AdminPaymentPlan[], payments: AdminPayment[]): EnrichedPaymentPlan[] {
  const allocations = new Map<string, number>();
  const groupKeys = new Set(
    plans
      .filter((plan) => plan.customer_id)
      .map((plan) => `${plan.customer_id}|${accountType(plan.account_type)}`),
  );

  groupKeys.forEach((key) => {
    const [customerId, selectedAccount] = key.split("|");
    const scopedPlans = plans.filter(
      (plan) => plan.customer_id === customerId && accountType(plan.account_type) === selectedAccount,
    );
    const scopedPayments = payments.filter(
      (payment) => payment.customer_id === customerId && accountType(payment.account_type) === selectedAccount,
    );
    allocateCollectionsToPlans(scopedPlans, scopedPayments).forEach((value, planId) => allocations.set(planId, value));
  });

  return plans.map((plan) => {
    const paid = effectivePaidForPlan(plan, payments, allocations.get(String(plan.id)) || 0);
    const remaining = Math.max(0, safeNumber(plan.amount) - paid);
    const computed = derivePlanStatus(plan, paid);
    return { ...plan, paid, remaining, computed };
  });
}

function ExportBar({ onCSV, onPDF, title }: { onCSV: () => void; onPDF: () => void; title: string }) {
  return (
    <div className="mb-4 flex flex-col gap-2 print:hidden sm:flex-row sm:flex-wrap sm:items-center">
      <Button onClick={onPDF} variant="outline"><FileText className="h-4 w-4 mr-2" /> PDF Olarak İndir</Button>
      <Button onClick={onCSV} variant="outline"><Download className="h-4 w-4 mr-2" /> CSV Olarak İndir</Button>
      <Button onClick={() => printCurrentReport(title)} variant="outline"><Printer className="h-4 w-4 mr-2" /> Yazdır</Button>
      <div className="text-sm text-muted-foreground sm:ml-auto sm:self-center">{title}</div>
    </div>
  );
}

// ========== Report 1: Project Finance ==========
function ProjectFinanceReport({ data }: any) {
  const { projects } = data;
  const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [projectId, setProjectId] = useState("all");
  const financeEntries = useMemo(() => mysqlFinanceEntries(data), [data]);

  const rows = useMemo(() => {
    const list = projectId === "all" ? projects.data : projects.data.filter((p: any) => p.id === projectId);
    return list.map((p: any) => {
      const fe = entriesInDateRange(financeEntries, from, to).filter((x: any) => x.project_id === p.id);
      const summary = summarizeLedgerFinance({ financialEntries: fe });
      const totalReceivable = summary.receivable;
      const totalReceived = summary.totalIncome;
      const totalSpent = summary.totalExpense;
      const totalPayable = summary.payable;
      return {
        id: p.id, title: p.title,
        totalReceived, totalReceivable, totalSpent, totalPayable,
        net: summary.netBalance,
        collectionRate: totalReceivable > 0 ? (totalReceived / totalReceivable) * 100 : 0,
        expenseRate: totalReceived > 0 ? (totalSpent / totalReceived) * 100 : 0,
      };
    });
  }, [projects.data, financeEntries, from, to, projectId]);

  const dateRange = `${from || "Başlangıç"} - ${to || "Bugün"}`;
  const exportRows = rows.map((r: any) => ({
    "Proje Adı": r.title,
    "Gerçekleşen Gelir": formatTRY(r.totalReceived),
    "Planlanan Gelir": formatTRY(r.totalReceivable),
    "Gerçekleşen Gider": formatTRY(r.totalSpent),
    "Planlanan Gider": formatTRY(r.totalPayable),
    "Net Durum": formatTRY(r.net),
    "Tahsilat Oranı (%)": r.collectionRate.toFixed(2),
    "Gider Oranı (%)": r.expenseRate.toFixed(2),
  }));

  return (
    <div>
      <Filters>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Başlangıç" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Bitiş" />
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger><SelectValue placeholder="Proje" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm projeler</SelectItem>
            {projects.data.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </Filters>
      <ExportBar title="Proje Finans Raporu" onCSV={() => exportCSV("proje-finans-raporu.csv", exportRows)} onPDF={() => exportPDF("proje-finans-raporu.pdf", "Proje Finans Raporu", dateRange, exportRows)} />
      <ReportHeader title="Proje Finans Raporu" dateRange={dateRange} />
      <Card><CardContent className="p-0">
        <Table className="min-w-[980px]">
          <TableHeader><TableRow>
            <TableHead>Proje Adı</TableHead><TableHead>Gerçekleşen Gelir</TableHead><TableHead>Planlanan Gelir</TableHead>
            <TableHead>Gerçekleşen Gider</TableHead><TableHead>Planlanan Gider</TableHead><TableHead>Net Durum</TableHead>
            <TableHead>Tahsilat Oranı</TableHead><TableHead>Gider Oranı</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.title}</TableCell>
                <TableCell>{formatTRY(r.totalReceived)}</TableCell>
                <TableCell>{formatTRY(r.totalReceivable)}</TableCell>
                <TableCell>{formatTRY(r.totalSpent)}</TableCell>
                <TableCell>{formatTRY(r.totalPayable)}</TableCell>
                <TableCell className={r.net >= 0 ? "text-emerald-700" : "text-red-700"}>{formatTRY(r.net)}</TableCell>
                <TableCell>%{r.collectionRate.toFixed(1)}</TableCell>
                <TableCell>%{r.expenseRate.toFixed(1)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Seçilen filtrelere uygun proje finans kaydı bulunmuyor.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
      <ReportFooter />
    </div>
  );
}

// ========== Report 2: Customer Payment ==========
function CustomerPaymentReport({ data }: any) {
  const { customers, projects, plans, payments } = data;
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [customerId, setCustomerId] = useState("all"); const [projectId, setProjectId] = useState("all"); const [status, setStatus] = useState("all");
  const today = new Date().toISOString().slice(0, 10);

  const rows = useMemo(() => {
    const enrichedPlans = enrichCustomerPaymentPlans(plans.data, payments.data);
    return customers.data.filter((c: any) => customerId === "all" || c.id === customerId).map((c: any) => {
      const pl = enrichedPlans.filter((x) => x.customer_id === c.id && (projectId === "all" || x.project_id === projectId) && inDateRange(x.due_date, from, to));
      const py = payments.data.filter((x: any) => x.customer_id === c.id && (projectId === "all" || x.project_id === projectId) && inDateRange(x.payment_date, from, to));
      const totalDebt = sumBy(pl, (x: any) => x.amount);
      const collected = sumBy(pl, (x) => x.paid);
      const remaining = sumBy(pl, (x) => x.remaining);
      const overdue = pl
        .filter((x) => x.due_date < today && x.paid <= 0 && x.computed !== "İptal")
        .reduce((s, x) => s + x.remaining, 0);
      const lastPay = [...py].sort((a: any, b: any) => b.payment_date.localeCompare(a.payment_date))[0];
      const proj = pl[0] ? projects.data.find((p: any) => p.id === pl[0].project_id) : null;
      return {
        id: c.id, name: customerDisplayName(c), project: proj?.title || "-",
        totalDebt, collected, remaining, overdue, lastPaymentDate: lastPay?.payment_date,
      };
    }).filter((r: any) => {
      if (status === "Borçlu" && r.remaining <= 0) return false;
      if (status === "Tamamlanmış" && r.remaining > 0) return false;
      if (status === "Gecikmiş" && r.overdue <= 0) return false;
      return true;
    });
  }, [customers.data, projects.data, plans.data, payments.data, customerId, projectId, from, to, status, today]);

  const dateRange = `${from || "Başlangıç"} - ${to || "Bugün"}`;
  const exportRows = rows.map((r: any) => ({
    "Müşteri": r.name,
    "İlgili Proje": r.project,
    "Toplam Borç": formatTRY(r.totalDebt),
    "Tahsil Edilen": formatTRY(r.collected),
    "Kalan Bakiye": formatTRY(r.remaining),
    "Vadesi Geçen Tutar": formatTRY(r.overdue),
    "Son Ödeme Tarihi": r.lastPaymentDate ? formatDate(r.lastPaymentDate) : "-",
  }));

  return (
    <div>
      <Filters>
        <Select value={customerId} onValueChange={setCustomerId}>
          <SelectTrigger><SelectValue placeholder="Müşteri" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm müşteriler</SelectItem>
            {customers.data.map((c: any) => <SelectItem key={c.id} value={c.id}>{customerDisplayName(c)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger><SelectValue placeholder="Proje" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm projeler</SelectItem>
            {projects.data.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue placeholder="Durum" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm durumlar</SelectItem>
            <SelectItem value="Borçlu">Borçlu</SelectItem>
            <SelectItem value="Tamamlanmış">Tamamlanmış</SelectItem>
            <SelectItem value="Gecikmiş">Gecikmiş</SelectItem>
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </Filters>
      <ExportBar title="Müşteri Ödeme Raporu" onCSV={() => exportCSV("musteri-odeme-raporu.csv", exportRows)} onPDF={() => exportPDF("musteri-odeme-raporu.pdf", "Müşteri Ödeme Raporu", dateRange, exportRows)} />
      <ReportHeader title="Müşteri Ödeme Raporu" dateRange={dateRange} />
      <Card><CardContent className="p-0">
        <Table className="min-w-[880px]">
          <TableHeader><TableRow>
            <TableHead>Müşteri</TableHead><TableHead>İlgili Proje</TableHead>
            <TableHead>Toplam Borç</TableHead><TableHead>Tahsil Edilen</TableHead><TableHead>Kalan Bakiye</TableHead>
            <TableHead>Vadesi Geçen</TableHead><TableHead>Son Ödeme</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.project}</TableCell>
                <TableCell>{formatTRY(r.totalDebt)}</TableCell>
                <TableCell className="text-emerald-700">{formatTRY(r.collected)}</TableCell>
                <TableCell>{formatTRY(r.remaining)}</TableCell>
                <TableCell className={r.overdue > 0 ? "text-red-700" : ""}>{formatTRY(r.overdue)}</TableCell>
                <TableCell>{formatDate(r.lastPaymentDate)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Seçilen filtrelere uygun müşteri ödeme kaydı bulunmuyor.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
      <ReportFooter />
    </div>
  );
}

// ========== Report 3: Collections ==========
function CollectionsReport({ data }: any) {
  const { customers, projects, payments } = data;
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [customerId, setCustomerId] = useState("all"); const [projectId, setProjectId] = useState("all"); const [method, setMethod] = useState("all");

  const rows = useMemo(() => payments.data.filter((p: any) => {
    if (customerId !== "all" && p.customer_id !== customerId) return false;
    if (projectId !== "all" && p.project_id !== projectId) return false;
    if (method !== "all" && p.payment_method !== method) return false;
    if (!inDateRange(p.payment_date, from, to)) return false;
    return true;
  }).map((p: any) => {
    const c = customers.data.find((x: any) => x.id === p.customer_id);
    const pr = projects.data.find((x: any) => x.id === p.project_id);
    return {
      id: p.id, customer: c ? customerDisplayName(c) : "-", project: pr?.title || "-",
      amount: safeNumber(p.amount), date: p.payment_date, method: p.payment_method, description: p.description || "",
    };
  }), [payments.data, customers.data, projects.data, customerId, projectId, method, from, to]);

  const total = rows.reduce((s: number, r: any) => s + r.amount, 0);
  const dateRange = `${from || "Başlangıç"} - ${to || "Bugün"}`;
  const exportRows = rows.map((r: any) => ({
    "Müşteri": r.customer,
    "Proje": r.project,
    "Tahsilat Tutarı": formatTRY(r.amount),
    "Tahsilat Tarihi": formatDate(r.date),
    "Ödeme Yöntemi": r.method,
    "Açıklama": r.description,
  }));

  return (
    <div>
      <Filters>
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger><SelectValue placeholder="Proje" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm projeler</SelectItem>
            {projects.data.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={customerId} onValueChange={setCustomerId}>
          <SelectTrigger><SelectValue placeholder="Müşteri" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm müşteriler</SelectItem>
            {customers.data.map((c: any) => <SelectItem key={c.id} value={c.id}>{customerDisplayName(c)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={method} onValueChange={setMethod}>
          <SelectTrigger><SelectValue placeholder="Ödeme Yöntemi" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm yöntemler</SelectItem>
            {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </Filters>
      <ExportBar title="Tahsilat Raporu" onCSV={() => exportCSV("tahsilat-raporu.csv", exportRows)} onPDF={() => exportPDF("tahsilat-raporu.pdf", "Tahsilat Raporu", dateRange, exportRows)} />
      <ReportHeader title="Tahsilat Raporu" dateRange={dateRange} />
      <div className="grid md:grid-cols-3 gap-3 mb-4">
        <SummaryCard label="Toplam Tahsilat" value={formatTRY(total)} color="text-emerald-700" />
        <SummaryCard label="Kayıt Sayısı" value={String(rows.length)} />
      </div>
      <Card><CardContent className="p-0">
        <Table className="min-w-[760px]">
          <TableHeader><TableRow>
            <TableHead>Müşteri</TableHead><TableHead>Proje</TableHead><TableHead>Tutar</TableHead>
            <TableHead>Tarih</TableHead><TableHead>Yöntem</TableHead><TableHead>Açıklama</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.customer}</TableCell><TableCell>{r.project}</TableCell>
                <TableCell className="text-emerald-700 font-medium">{formatTRY(r.amount)}</TableCell>
                <TableCell>{formatDate(r.date)}</TableCell><TableCell>{r.method}</TableCell><TableCell>{r.description}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Henüz tahsilat kaydı yok veya seçilen filtrelerde sonuç bulunmuyor.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
      <ReportFooter />
    </div>
  );
}

// ========== Report 4: Expenses ==========
function ExpensesReport({ data }: any) {
  const { projects, expenses } = data;
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [projectId, setProjectId] = useState("all"); const [category, setCategory] = useState("all");

  const rows = useMemo(() => expenses.data.filter((e: any) => {
    if (projectId !== "all" && e.project_id !== projectId) return false;
    if (category !== "all" && e.category !== category) return false;
    if (!inDateRange(e.expense_date, from, to)) return false;
    return true;
  }).map((e: any) => {
    const pr = projects.data.find((x: any) => x.id === e.project_id);
    return {
      id: e.id, project: pr?.title || "-", title: e.title, category: e.category,
      amount: safeNumber(e.amount), date: e.expense_date, description: e.description || "",
    };
  }), [expenses.data, projects.data, projectId, category, from, to]);

  const total = rows.reduce((s: number, r: any) => s + r.amount, 0);
  const dateRange = `${from || "Başlangıç"} - ${to || "Bugün"}`;
  const exportRows = rows.map((r: any) => ({
    "Proje": r.project,
    "Gider Başlığı": r.title,
    "Kategori": r.category,
    "Tutar": formatTRY(r.amount),
    "Tarih": formatDate(r.date),
    "Açıklama": r.description,
  }));

  return (
    <div>
      <Filters>
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger><SelectValue placeholder="Proje" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm projeler</SelectItem>
            {projects.data.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger><SelectValue placeholder="Kategori" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm kategoriler</SelectItem>
            {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </Filters>
      <ExportBar title="Gider Raporu" onCSV={() => exportCSV("gider-raporu.csv", exportRows)} onPDF={() => exportPDF("gider-raporu.pdf", "Gider Raporu", dateRange, exportRows)} />
      <ReportHeader title="Gider Raporu" dateRange={dateRange} />
      <div className="grid md:grid-cols-3 gap-3 mb-4">
        <SummaryCard label="Toplam Gider" value={formatTRY(total)} color="text-red-700" />
        <SummaryCard label="Kayıt Sayısı" value={String(rows.length)} />
      </div>
      <Card><CardContent className="p-0">
        <Table className="min-w-[760px]">
          <TableHeader><TableRow>
            <TableHead>Proje</TableHead><TableHead>Başlık</TableHead><TableHead>Kategori</TableHead>
            <TableHead>Tutar</TableHead><TableHead>Tarih</TableHead><TableHead>Açıklama</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.project}</TableCell><TableCell className="font-medium">{r.title}</TableCell>
                <TableCell>{r.category}</TableCell>
                <TableCell className="text-red-700">{formatTRY(r.amount)}</TableCell>
                <TableCell>{formatDate(r.date)}</TableCell><TableCell>{r.description}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Henüz gider kaydı yok veya seçilen filtrelerde sonuç bulunmuyor.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
      <ReportFooter />
    </div>
  );
}

// ========== Report 5: General Summary ==========
function GeneralSummaryReport({ data }: any) {
  const financeEntries = useMemo(() => mysqlFinanceEntries(data), [data]);
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  const summary = summarizeLedgerFinance({ financialEntries: financeEntries });
  const monthSummary = summarizeLedgerFinance({
    financialEntries: financeEntries,
    from: monthStart,
    to: monthEnd,
  });
  const totalReceived = summary.totalIncome;
  const totalReceivable = summary.receivable;
  const totalSpent = summary.totalExpense;
  const totalPayable = summary.payable;
  const monthExpected = monthSummary.receivable;
  const monthCollected = monthSummary.totalIncome;
  const monthSpent = monthSummary.totalExpense;
  const net = summary.netBalance;

  const distData = [
    { name: "Gerçekleşen Gelir", value: totalReceived, color: FINANCE_COLORS.received },
    { name: "Planlanan Gelir", value: totalReceivable, color: FINANCE_COLORS.receivable },
    { name: "Gerçekleşen Gider", value: totalSpent, color: FINANCE_COLORS.expense },
    { name: "Planlanan Gider", value: totalPayable, color: FINANCE_COLORS.pending },
  ];
  const hasDistribution = distData.some((item) => item.value > 0);

  // Monthly chart - last 6 months
  const monthly: any[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const ms = d.toISOString().slice(0, 10);
    const me = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
    const label = d.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });
    const monthlySummary = summarizeLedgerFinance({ financialEntries: financeEntries, from: ms, to: me });
    monthly.push({
      ay: label,
      "Gerçekleşen Gelir": monthlySummary.totalIncome,
      "Gerçekleşen Gider": monthlySummary.totalExpense,
    });
  }
  const hasMonthlyData = monthly.some((item) => item["Gerçekleşen Gelir"] > 0 || item["Gerçekleşen Gider"] > 0);
  const exportRows = [{
    "Gerçekleşen Gelir": formatTRY(totalReceived),
    "Planlanan Gelir": formatTRY(totalReceivable),
    "Gerçekleşen Gider": formatTRY(totalSpent),
    "Planlanan Gider": formatTRY(totalPayable),
    "Net Durum": formatTRY(net),
    "Bu Ay Beklenen Tahsilat": formatTRY(monthExpected),
    "Bu Ay Gerçekleşen Gelir": formatTRY(monthCollected),
    "Bu Ay Gerçekleşen Gider": formatTRY(monthSpent),
  }];

  return (
    <div>
      <ExportBar title="Genel Finans Özeti" onCSV={() => exportCSV("genel-finans-ozeti.csv", exportRows)} onPDF={() => exportPDF("genel-finans-ozeti.pdf", "Genel Finans Özeti", "Tüm Zamanlar", exportRows)} />
      <ReportHeader title="Genel Finans Özeti" dateRange="Tüm Zamanlar" />
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Gerçekleşen Gelir" value={formatTRY(totalReceived)} color="text-emerald-700" />
        <SummaryCard label="Planlanan Gelir" value={formatTRY(totalReceivable)} />
        <SummaryCard label="Gerçekleşen Gider" value={formatTRY(totalSpent)} color="text-red-700" />
        <SummaryCard label="Planlanan Gider" value={formatTRY(totalPayable)} />
        <SummaryCard label="Net Durum" value={formatTRY(net)} color={net >= 0 ? "text-emerald-700" : "text-red-700"} />
        <SummaryCard label="Bu Ay Beklenen Tahsilat" value={formatTRY(monthExpected)} />
        <SummaryCard label="Bu Ay Gerçekleşen Gelir" value={formatTRY(monthCollected)} color="text-emerald-700" />
        <SummaryCard label="Bu Ay Gerçekleşen Gider" value={formatTRY(monthSpent)} color="text-red-700" />
      </div>
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <Card><CardHeader><CardTitle className="text-base">Genel Finans Dağılımı</CardTitle></CardHeader>
          <CardContent>
            {hasDistribution ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={distData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={95}>
                    {distData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => formatTRY(v)} /><Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[260px] items-center justify-center rounded-md bg-surface-light px-6 text-center text-sm text-muted-foreground">
                Finansal hareket eklendiğinde dağılım grafiği burada görünecek.
              </div>
            )}
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle className="text-base">Aylık Gerçekleşen Gelir ve Gider Grafiği</CardTitle></CardHeader>
          <CardContent>
            {hasMonthlyData ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="ay" /><YAxis />
                  <Tooltip formatter={(v: any) => formatTRY(v)} /><Legend />
                  <Bar dataKey="Gerçekleşen Gelir" fill={FINANCE_COLORS.received} />
                  <Bar dataKey="Gerçekleşen Gider" fill={FINANCE_COLORS.expense} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[260px] items-center justify-center rounded-md bg-surface-light px-6 text-center text-sm text-muted-foreground">
                Bu dönem için gerçekleşen gelir veya gider hareketi bulunmuyor.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <ReportFooter />
    </div>
  );
}

// ========== Report 6: Overdue ==========
function OverdueReport({ data }: any) {
  const { customers, projects, plans, payments } = data;
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [customerId, setCustomerId] = useState("all"); const [projectId, setProjectId] = useState("all"); const [delay, setDelay] = useState("all");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const rows = useMemo(() => enrichCustomerPaymentPlans(plans.data, payments.data).filter((p) => {
    if (p.due_date >= todayStr) return false;
    if (p.paid > 0 || p.computed === "Ödendi" || p.computed === "İptal") return false;
    if (customerId !== "all" && p.customer_id !== customerId) return false;
    if (projectId !== "all" && p.project_id !== projectId) return false;
    if (!inDateRange(p.due_date, from, to)) return false;
    return true;
  }).map((p: any) => {
    const c = customers.data.find((x: any) => x.id === p.customer_id);
    const pr = projects.data.find((x: any) => x.id === p.project_id);
    const days = Math.abs(daysUntil(p.due_date));
    return {
      id: p.id, customer: c ? customerDisplayName(c) : "-", project: pr?.title || "-",
      dueDate: p.due_date, days, amount: safeNumber(p.amount), remaining: p.remaining, status: p.computed,
    };
  }).filter((r: any) => {
    if (delay === "1-30" && (r.days < 1 || r.days > 30)) return false;
    if (delay === "31-90" && (r.days < 31 || r.days > 90)) return false;
    if (delay === "90+" && r.days <= 90) return false;
    return true;
  }), [plans.data, payments.data, customers.data, projects.data, customerId, projectId, from, to, delay, todayStr]);

  const totalOverdue = rows.reduce((s: number, r: any) => s + r.remaining, 0);
  const dateRange = `${from || "Başlangıç"} - ${to || "Bugün"}`;
  const exportRows = rows.map((r: any) => ({
    "Müşteri": r.customer,
    "Proje": r.project,
    "Vade Tarihi": formatDate(r.dueDate),
    "Geciken Gün": `${r.days} gün`,
    "Tutar": formatTRY(r.amount),
    "Kalan Tutar": formatTRY(r.remaining),
    "Durum": displayLabel(r.status),
  }));

  return (
    <div>
      <Filters>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger><SelectValue placeholder="Proje" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm projeler</SelectItem>
            {projects.data.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={customerId} onValueChange={setCustomerId}>
          <SelectTrigger><SelectValue placeholder="Müşteri" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm müşteriler</SelectItem>
            {customers.data.map((c: any) => <SelectItem key={c.id} value={c.id}>{customerDisplayName(c)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={delay} onValueChange={setDelay}>
          <SelectTrigger><SelectValue placeholder="Gecikme" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm gecikmeler</SelectItem>
            <SelectItem value="1-30">1-30 gün</SelectItem>
            <SelectItem value="31-90">31-90 gün</SelectItem>
            <SelectItem value="90+">90+ gün</SelectItem>
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </Filters>
      <ExportBar title="Vadesi Geçen Ödemeler Raporu" onCSV={() => exportCSV("vadesi-gecen-odemeler.csv", exportRows)} onPDF={() => exportPDF("vadesi-gecen-odemeler.pdf", "Vadesi Geçen Ödemeler Raporu", dateRange, exportRows)} />
      <ReportHeader title="Vadesi Geçen Ödemeler Raporu" dateRange={dateRange} />
      <div className="grid md:grid-cols-3 gap-3 mb-4">
        <SummaryCard label="Toplam Vadesi Geçen" value={formatTRY(totalOverdue)} color="text-red-700" />
        <SummaryCard label="Kayıt Sayısı" value={String(rows.length)} />
      </div>
      <Card><CardContent className="p-0">
        <Table className="min-w-[860px]">
          <TableHeader><TableRow>
            <TableHead>Müşteri</TableHead><TableHead>Proje</TableHead><TableHead>Vade Tarihi</TableHead>
            <TableHead>Geciken Gün</TableHead><TableHead>Tutar</TableHead><TableHead>Kalan</TableHead><TableHead>Durum</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.customer}</TableCell><TableCell>{r.project}</TableCell>
                <TableCell>{formatDate(r.dueDate)}</TableCell>
                <TableCell className="text-red-700 font-medium">{r.days} gün</TableCell>
                <TableCell>{formatTRY(r.amount)}</TableCell>
                <TableCell className="text-red-700">{formatTRY(r.remaining)}</TableCell>
                <TableCell><span className={`text-xs px-2 py-0.5 rounded border ${statusBadgeClass(r.status)}`}>{displayLabel(r.status)}</span></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Vadesi geçen ödeme bulunmuyor.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
      <ReportFooter />
    </div>
  );
}

// ========== Main ==========
export default function AdminReports() {
  const data = useFinanceAll();
  const [activeTab, setActiveTab] = useState("proje");

  const tabs = [
    { id: "proje", label: "Proje Finans Raporu", desc: "Proje bazlı tahsilat, alacak, gider ve net durum.", Comp: ProjectFinanceReport },
    { id: "musteri", label: "Müşteri Ödeme Raporu", desc: "Müşteri bazlı borç, tahsilat, kalan bakiye ve gecikme.", Comp: CustomerPaymentReport },
    { id: "tahsilat", label: "Tahsilat Raporu", desc: "Tarih, proje, müşteri ve yöntem bazlı tahsilat dökümü.", Comp: CollectionsReport },
    { id: "gider", label: "Gider Raporu", desc: "Proje ve kategori bazlı gider dökümü.", Comp: ExpensesReport },
    { id: "ozet", label: "Genel Finans Özeti", desc: "Tüm finansal özet ve grafikler.", Comp: GeneralSummaryReport },
    { id: "gecikme", label: "Vadesi Geçen Ödemeler", desc: "Vadesi geçmiş ve hâlâ tahsil edilmemiş ödemeler.", Comp: OverdueReport },
  ];
  const presets = [
    { id: "ozet", title: "Genel Finans Özeti", desc: "Şirketin tahsilat, gider ve net durumunu hızlıca görün." },
    { id: "gecikme", title: "Vadesi Geçen Ödemeler", desc: "Takip edilmesi gereken alacakları öne çıkarır." },
    { id: "proje", title: "Proje Finans Raporu", desc: "Projelerin gelir, gider ve net durumunu karşılaştırır." },
  ];

  return (
    <div>
      <div className="mb-6 print:hidden">
        <AdminPageHeader
          eyebrow="Yönetim Raporları"
          title="Raporlar"
          description="Şirket özeti, proje kârlılığı, tahsilat, gider ve gecikme raporlarını yönetici bakışıyla inceleyin; PDF veya CSV olarak dışa aktarın."
        />
      </div>

      {data.loading ? (
        <div className="rounded-md border border-border bg-card py-12 text-center text-sm text-muted-foreground shadow-card-soft">Rapor verileri hazırlanıyor...</div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="mb-5 rounded-md border border-border bg-card p-4 print:hidden">
            <div className="mb-3">
              <h2 className="font-display text-lg font-semibold">Sık Kullanılan Raporlar</h2>
              <p className="text-sm text-muted-foreground">En çok ihtiyaç duyulan yönetim raporlarına hızlıca geçin.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setActiveTab(preset.id)}
                  className={`h-auto rounded-md border p-3 text-left transition-colors hover:border-accent/60 hover:bg-accent/5 ${activeTab === preset.id ? "border-accent bg-accent/10" : "border-border bg-background"}`}
                >
                  <span>
                    <span className="block font-semibold text-foreground">{preset.title}</span>
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">{preset.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <TabsList className="flex flex-wrap h-auto print:hidden">
            {tabs.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}
          </TabsList>
          {tabs.map((t) => (
            <TabsContent key={t.id} value={t.id} className="mt-4">
              <div className="mb-4 print:hidden">
                <h2 className="font-display text-xl font-semibold">{t.label}</h2>
                <p className="text-sm text-muted-foreground">{t.desc}</p>
              </div>
              <t.Comp data={data} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
