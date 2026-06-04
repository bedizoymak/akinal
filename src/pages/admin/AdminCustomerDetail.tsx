import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Edit, Mail, MapPin, MessageCircle, Phone, Plus, Trash2 } from "lucide-react";
import { accountType, allocateCollectionsToPlans, customerDisplayName, derivePlanStatus, displayLabel, formatTRY, formatDate, statusBadgeClass, daysUntil, safeNumber, whatsappLink } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { AdminPageHeader } from "@/components/admin/AdminPage";
import { createAdminCustomerNote, deleteAdminCustomerNote, getAdminCustomerDetail } from "@/lib/apiClient";

function Stat({ label, value, color }: any) {
  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-card-soft">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className={cn("mt-2 break-words text-2xl font-extrabold leading-tight tabular-nums", color || "text-foreground")}>{value}</div>
    </div>
  );
}

const ACCOUNT_TABS = [
  { value: "resmi", label: "Resmi Hesap" },
  { value: "gayri_resmi", label: "Gayri Resmi Hesap" },
] as const;

function percentLabel(value: number, total: number): string {
  if (total <= 0) return "%0";
  return `%${((value / total) * 100).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
}

function renderChartCallout(props: any) {
  const { cx, cy, midAngle, outerRadius, value, payload } = props;
  if (!value) return null;

  const RADIAN = Math.PI / 180;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const startX = cx + outerRadius * cos;
  const startY = cy + outerRadius * sin;
  const midX = cx + (outerRadius + 16) * cos;
  const midY = cy + (outerRadius + 16) * sin;
  const endX = midX + (cos >= 0 ? 26 : -26);
  const endY = midY;
  const textAnchor = cos >= 0 ? "start" : "end";

  return (
    <g>
      <path d={`M${startX},${startY}L${midX},${midY}L${endX},${endY}`} fill="none" stroke={payload.color} strokeWidth={1.4} />
      <circle cx={startX} cy={startY} r={2.5} fill={payload.color} />
      <text x={endX + (cos >= 0 ? 5 : -5)} y={endY - 4} textAnchor={textAnchor} className="fill-foreground text-[10px] font-semibold">
        {formatTRY(value)}
      </text>
      <text x={endX + (cos >= 0 ? 5 : -5)} y={endY + 10} textAnchor={textAnchor} className="fill-muted-foreground text-[10px]">
        {payload.name} · {payload.percentLabel}
      </text>
    </g>
  );
}

export default function AdminCustomerDetail() {
  const { id } = useParams();
  const [customer, setCustomer] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [pays, setPays] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const { toast } = useToast();

  async function load() {
    if (!id) return;
    try {
      const data = await getAdminCustomerDetail(id);
      setCustomer(data.customer);
      setAllProjects(data.projects || []);
      const linkedIds = (data.links || []).map((l) => l.project_id);
      setProjects((data.projects || []).filter((p) => linkedIds.includes(p.id)));
      setPlans(data.payment_plans || []);
      setPays(data.payments || []);
      setExpenses(data.expenses || []);
      setNotes(data.notes || []);
      setDocs(data.documents || []);
    } catch (error) {
      toast({ title: "Müşteri bilgileri alınamadı", description: error instanceof Error ? error.message : "Lütfen tekrar deneyin.", variant: "destructive" });
    }
  }
  useEffect(() => { load(); }, [id]);

  const accountSummaries = useMemo(() => {
    return ACCOUNT_TABS.reduce((result, account) => {
      const accountPlans = plans.filter((plan) => accountType(plan.account_type) === account.value);
      const accountPays = pays.filter((payment) => accountType(payment.account_type) === account.value);
      const allocatedPaid = allocateCollectionsToPlans(accountPlans, accountPays);
      const enrichedPlans = accountPlans.map((plan) => {
        const paid = allocatedPaid.get(plan.id) || 0;
        const remain = Math.max(0, safeNumber(plan.amount) - paid);
        const computed = derivePlanStatus(plan, paid);
        return { ...plan, paid, remain, computed };
      });
      const totalDue = accountPlans.reduce((s, p) => s + safeNumber(p.amount), 0);
      const totalPaid = accountPays.reduce((s, p) => s + safeNumber(p.amount), 0);
      const balance = totalDue - totalPaid;
      const overdue = enrichedPlans
        .filter((plan) => daysUntil(plan.due_date) < 0 && plan.computed !== "Ödendi" && plan.computed !== "İptal")
        .reduce((sum, plan) => sum + plan.remain, 0);
      const upcomingPlan = enrichedPlans
        .filter((plan) => daysUntil(plan.due_date) >= 0 && plan.computed !== "Ödendi" && plan.computed !== "İptal" && plan.remain > 0)
        .sort((a, b) => String(a.due_date || "").localeCompare(String(b.due_date || "")))[0];
      const upcoming = upcomingPlan?.remain || 0;
      result[account.value] = { totalDue, totalPaid, balance, overdue, upcoming, plans: enrichedPlans, pays: accountPays };
      return result;
    }, {} as Record<string, any>);
  }, [plans, pays]);

  const combinedPaymentChart = useMemo(() => {
    const official = accountSummaries.resmi || { totalPaid: 0, balance: 0, overdue: 0 };
    const unofficial = accountSummaries.gayri_resmi || { totalPaid: 0, balance: 0, overdue: 0 };
    const officialRemaining = Math.max(0, official.balance);
    const unofficialRemaining = Math.max(0, unofficial.balance);
    const overdue = Math.max(0, Number(official.overdue || 0) + Number(unofficial.overdue || 0));
    const total = Number(official.totalPaid || 0) + Number(unofficial.totalPaid || 0) + officialRemaining + unofficialRemaining;

    return [
      { name: "Resmi ödenen", value: Number(official.totalPaid || 0), color: "#15803d" },
      { name: "Gayri resmi ödenen", value: Number(unofficial.totalPaid || 0), color: "#22c55e" },
      { name: "Resmi kalan", value: Math.max(0, officialRemaining - Number(official.overdue || 0)), color: "#2563eb" },
      { name: "Gayri resmi kalan", value: Math.max(0, unofficialRemaining - Number(unofficial.overdue || 0)), color: "#60a5fa" },
      { name: "Geciken ödeme", value: overdue, color: "#dc2626" },
    ]
      .filter((item) => item.value > 0)
      .map((item) => ({ ...item, percentLabel: percentLabel(item.value, total) }));
  }, [accountSummaries]);

  async function addNote() {
    if (!id || !newNote.trim()) return;
    await createAdminCustomerNote(id, newNote.trim());
    setNewNote(""); toast({ title: "Not eklendi" }); load();
  }
  async function deleteNote(nid: string) {
    if (!confirm("Bu müşteri notunu silmek istediğinize emin misiniz?")) return;
    await deleteAdminCustomerNote(nid);
    load();
  }

  if (!customer) return <div className="rounded-md border border-border bg-card py-12 text-center text-sm text-muted-foreground shadow-card-soft">Müşteri bilgileri hazırlanıyor...</div>;

  const name = customerDisplayName(customer);

  return (
    <div>
      <AdminPageHeader
        eyebrow="Cari ve Tahsilat"
        title={name}
        description={`${displayLabel(customer.customer_type)} · ${displayLabel(customer.status)} · müşteri bakiyesi, tahsilat planı, notlar ve belgeler.`}
        actions={
          <>
          <Button asChild variant="outline"><Link to="/admin/musteriler"><ArrowLeft className="h-4 w-4" /> Müşterilere Dön</Link></Button>
          {customer.whatsapp && <Button asChild variant="outline"><a href={whatsappLink(customer.whatsapp, `Merhaba ${name},`)} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4 mr-1" /> WhatsApp</a></Button>}
          <Button asChild className="bg-accent hover:bg-accent-glow text-accent-foreground"><Link to={`/admin/musteriler/${id}/duzenle`}><Edit className="h-4 w-4 mr-1" /> Düzenle</Link></Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 bg-card border border-border rounded-md p-5 space-y-3">
          <h3 className="font-semibold">İletişim Bilgileri</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {customer.phone || "-"}</div>
            <div className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-muted-foreground" /> {customer.whatsapp || "-"}</div>
            <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {customer.email || "-"}</div>
            <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {[customer.address, customer.district, customer.city].filter(Boolean).join(", ") || "-"}</div>
            <div className="text-muted-foreground text-xs">T.C./Vergi No: {customer.tax_or_identity_number || "-"}</div>
          </div>
          <div>
            <h4 className="font-semibold mt-4 mb-2">İlgili Projeler</h4>
            {projects.length ? (
              <div className="flex flex-wrap gap-2">
                {projects.map((p) => <Link key={p.id} to={`/admin/projeler/${p.id}/finans`} className="text-xs px-2 py-1 rounded-md border border-border bg-muted/50 hover:bg-muted">{p.title}</Link>)}
              </div>
            ) : <div className="text-xs text-muted-foreground">Bu müşteriye bağlı proje bulunmuyor.</div>}
          </div>
          {customer.notes && <div><h4 className="font-semibold mt-4 mb-1">Genel Notlar</h4><p className="text-sm text-muted-foreground whitespace-pre-wrap">{customer.notes}</p></div>}
        </div>

        <div className="bg-card border border-border rounded-md p-5">
          <h3 className="font-semibold mb-2">Giderler</h3>
          <div className="text-sm text-muted-foreground">Müşteriye bağlı giderler hesap türüne ayrılmadan genel bilgi olarak gösterilir.</div>
          <div className="mt-4 space-y-2">
            {expenses.slice(0, 4).map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{e.title}</span>
                <span className="font-semibold tabular-nums">{formatTRY(e.amount)}</span>
              </div>
            ))}
            {expenses.length === 0 && <div className="text-sm text-muted-foreground">Bu müşteriye bağlı gider kaydı bulunmuyor.</div>}
          </div>
        </div>
      </div>

      <Tabs defaultValue="resmi">
        <TabsList className="flex flex-wrap">
          {ACCOUNT_TABS.map((account) => <TabsTrigger key={account.value} value={account.value}>{account.label}</TabsTrigger>)}
        </TabsList>

        {ACCOUNT_TABS.map((account) => {
          const summary = accountSummaries[account.value] || { totalDue: 0, totalPaid: 0, balance: 0, overdue: 0, upcoming: 0, plans: [], pays: [] };
          return (
            <TabsContent key={account.value} value={account.value} className="mt-4 space-y-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <Stat label="Planlanan Alacak" value={formatTRY(summary.totalDue)} />
                <Stat label="Tahsil Edilen" value={formatTRY(summary.totalPaid)} color="text-emerald-700" />
                <Stat label="Müşteri Bakiyesi" value={formatTRY(summary.balance)} color={summary.balance > 0 ? "text-red-600" : "text-emerald-700"} />
                <Stat label="Vadesi Geçen Tutar" value={formatTRY(summary.overdue)} color="text-red-600" />
                <Stat label="Yaklaşan Ödeme" value={formatTRY(summary.upcoming)} color="text-amber-600" />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-4">
                  <div>
                    <div className="flex justify-end mb-3">
                      <Button asChild className="bg-accent hover:bg-accent-glow text-accent-foreground"><Link to={`/admin/odeme-planlari?musteri=${id}&hesap=${account.value}`}><Plus className="h-4 w-4 mr-1" /> Ödeme Ekle</Link></Button>
                    </div>
                    <div className="bg-card border border-border rounded-md overflow-x-auto">
                      <table className="min-w-[760px] w-full text-sm">
                        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="p-3 text-left">Başlık</th><th className="p-3 text-left">Vade</th><th className="p-3 text-right">Tutar</th><th className="p-3 text-right">Ödenen</th><th className="p-3 text-right">Kalan</th><th className="p-3">Durum</th></tr></thead>
                        <tbody>
                          {summary.plans.map((p: any) => {
                            return (
                              <tr key={p.id} className="border-t border-border">
                                <td className="p-3"><div className="font-medium">{p.title}</div>{p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}</td>
                                <td className="p-3">{formatDate(p.due_date)}</td>
                                <td className="p-3 text-right">{formatTRY(p.amount)}</td>
                                <td className="p-3 text-right text-emerald-700">{formatTRY(p.paid)}</td>
                                <td className="p-3 text-right font-bold">{formatTRY(p.remain)}</td>
                                <td className="p-3"><span className={cn("px-2 py-0.5 rounded-md border text-xs", statusBadgeClass(p.computed))}>{displayLabel(p.computed)}</span></td>
                              </tr>
                            );
                          })}
                          {summary.plans.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Bu hesap türü için ödeme planı bulunmuyor.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-end mb-3">
                      <Button asChild className="bg-accent hover:bg-accent-glow text-accent-foreground"><Link to={`/admin/tahsilatlar?musteri=${id}&hesap=${account.value}&yeni=1`}><Plus className="h-4 w-4 mr-1" /> Yeni Tahsilat Ekle</Link></Button>
                    </div>
                    <div className="bg-card border border-border rounded-md overflow-x-auto">
                      <table className="min-w-[680px] w-full text-sm">
                        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="p-3 text-left">Tarih</th><th className="p-3 text-right">Tutar</th><th className="p-3">Yöntem</th><th className="p-3 text-left">Açıklama</th></tr></thead>
                        <tbody>
                          {summary.pays.map((p: any) => (
                            <tr key={p.id} className="border-t border-border">
                              <td className="p-3">{formatDate(p.payment_date)}</td>
                              <td className="p-3 text-right text-emerald-700 font-medium">{formatTRY(p.amount)}</td>
                              <td className="p-3">{p.payment_method}</td>
                              <td className="p-3 text-muted-foreground">{p.description || "-"}</td>
                            </tr>
                          ))}
                          {summary.pays.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Bu hesap türü için tahsilat kaydı yok.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-card border border-border rounded-md p-5">
                    <h3 className="font-semibold mb-2">Genel Ödeme Durumu</h3>
                    {combinedPaymentChart.length ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={combinedPaymentChart}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={48}
                            outerRadius={82}
                            paddingAngle={2}
                            label={renderChartCallout}
                            labelLine={false}
                          >
                            {combinedPaymentChart.map((d, i) => <Cell key={i} fill={d.color} />)}
                          </Pie>
                          <Tooltip formatter={(v: any, name: any, item: any) => [`${formatTRY(v)} (${item.payload.percentLabel})`, name]} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <div className="text-sm text-muted-foreground py-12 text-center">Bu müşteri için ödeme verisi bulunmuyor.</div>}
                  </div>

                  <div className="bg-card border border-border rounded-md p-4">
                    <Textarea placeholder={`${account.label} notu...`} value={newNote} onChange={(e) => setNewNote(e.target.value)} rows={3} />
                    <Button onClick={addNote} className="mt-2 bg-accent hover:bg-accent-glow text-accent-foreground"><Plus className="h-4 w-4 mr-1" /> Not Ekle</Button>
                  </div>
                  <div className="space-y-2">
                    {notes.map((n) => (
                      <div key={n.id} className="bg-card border border-border rounded-md p-3 flex justify-between gap-3">
                        <div><div className="text-sm whitespace-pre-wrap">{n.note}</div><div className="text-xs text-muted-foreground mt-1">{formatDate(n.created_at)}</div></div>
                        <Button size="sm" variant="ghost" onClick={() => deleteNote(n.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    ))}
                    {notes.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">Henüz müşteri notu eklenmemiş.</div>}
                  </div>

                  <div className="bg-card border border-border rounded-md overflow-x-auto">
                    <table className="min-w-[420px] w-full text-sm">
                      <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="p-3 text-left">Belge</th><th className="p-3 text-right">İşlem</th></tr></thead>
                      <tbody>
                        {docs.map((d) => (
                          <tr key={d.id} className="border-t border-border">
                            <td className="p-3"><div>{d.title}</div><div className="text-xs text-muted-foreground">{d.document_type} · {formatDate(d.created_at)}</div></td>
                            <td className="p-3 text-right"><a href={d.file_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">Görüntüle</a></td>
                          </tr>
                        ))}
                        {docs.length === 0 && <tr><td colSpan={2} className="p-6 text-center text-muted-foreground">Bu müşteri için belge kaydı bulunmuyor.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
