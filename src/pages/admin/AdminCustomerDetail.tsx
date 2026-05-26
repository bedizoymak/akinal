import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Edit, Mail, MapPin, MessageCircle, Phone, Plus, Trash2 } from "lucide-react";
import { customerDisplayName, displayLabel, formatTRY, formatDate, statusBadgeClass, daysUntil, whatsappLink, FINANCE_COLORS } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { AdminPageHeader } from "@/components/admin/AdminPage";

function Stat({ label, value, color }: any) {
  return (
    <div className="bg-card border border-border rounded-md p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-xl font-bold mt-1", color)}>{value}</div>
    </div>
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
    const [c, links, pr, pl, py, ex, nt, dc] = await Promise.all([
      (supabase.from("customers" as any).select("*").eq("id", id).maybeSingle()) as any,
      (supabase.from("customer_projects" as any).select("project_id").eq("customer_id", id)) as any,
      supabase.from("projects").select("id,title,slug"),
      (supabase.from("payment_plans" as any).select("*").eq("customer_id", id).order("due_date")) as any,
      (supabase.from("payments" as any).select("*").eq("customer_id", id).order("payment_date", { ascending: false })) as any,
      (supabase.from("expenses" as any).select("*").eq("customer_id", id).order("expense_date", { ascending: false })) as any,
      (supabase.from("customer_notes" as any).select("*").eq("customer_id", id).order("created_at", { ascending: false })) as any,
      (supabase.from("documents" as any).select("*").eq("customer_id", id).order("created_at", { ascending: false })) as any,
    ]);
    setCustomer(c.data);
    setAllProjects((pr.data as any[]) || []);
    const linkedIds = ((links.data as any[]) || []).map((l) => l.project_id);
    setProjects(((pr.data as any[]) || []).filter((p) => linkedIds.includes(p.id)));
    setPlans((pl.data as any[]) || []);
    setPays((py.data as any[]) || []);
    setExpenses((ex.data as any[]) || []);
    setNotes((nt.data as any[]) || []);
    setDocs((dc.data as any[]) || []);
  }
  useEffect(() => { load(); }, [id]);

  const stats = useMemo(() => {
    const totalDue = plans.reduce((s, p) => s + Number(p.amount), 0);
    const totalPaid = pays.reduce((s, p) => s + Number(p.amount), 0);
    const balance = totalDue - totalPaid;
    const overdue = plans.filter((p) => daysUntil(p.due_date) < 0 && p.status !== "Ödendi" && p.status !== "İptal").reduce((s, p) => {
      const paid = pays.filter((x) => x.payment_plan_id === p.id).reduce((a, x) => a + Number(x.amount), 0);
      return s + Math.max(0, Number(p.amount) - paid);
    }, 0);
    const upcoming = plans.filter((p) => { const d = daysUntil(p.due_date); return d >= 0 && d <= 30 && p.status !== "Ödendi" && p.status !== "İptal"; })
      .reduce((s, p) => {
        const paid = pays.filter((x) => x.payment_plan_id === p.id).reduce((a, x) => a + Number(x.amount), 0);
        return s + Math.max(0, Number(p.amount) - paid);
      }, 0);
    return { totalDue, totalPaid, balance, overdue, upcoming };
  }, [plans, pays]);

  const pieData = [
    { name: "Ödenen", value: stats.totalPaid, color: FINANCE_COLORS.paid },
    { name: "Kalan", value: Math.max(0, stats.balance - stats.overdue), color: FINANCE_COLORS.receivable },
    { name: "Geciken", value: stats.overdue, color: FINANCE_COLORS.overdue },
  ].filter((d) => d.value > 0);

  async function addNote() {
    if (!newNote.trim()) return;
    await (supabase.from("customer_notes" as any).insert({ customer_id: id, note: newNote.trim() })) as any;
    setNewNote(""); toast({ title: "Not eklendi" }); load();
  }
  async function deleteNote(nid: string) {
    if (!confirm("Bu müşteri notunu silmek istediğinize emin misiniz?")) return;
    await (supabase.from("customer_notes" as any).delete().eq("id", nid)) as any;
    load();
  }

  if (!customer) return <div className="text-muted-foreground">Yükleniyor...</div>;

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

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Stat label="Planlanan Alacak" value={formatTRY(stats.totalDue)} />
        <Stat label="Tahsil Edilen" value={formatTRY(stats.totalPaid)} color="text-emerald-700" />
        <Stat label="Müşteri Bakiyesi" value={formatTRY(stats.balance)} color={stats.balance > 0 ? "text-red-600" : "text-emerald-700"} />
        <Stat label="Vadesi Geçen Tutar" value={formatTRY(stats.overdue)} color="text-red-600" />
        <Stat label="Yaklaşan Ödeme" value={formatTRY(stats.upcoming)} color="text-amber-600" />
      </div>

      <Tabs defaultValue="genel">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="genel">Genel Bilgiler</TabsTrigger>
          <TabsTrigger value="plan">Ödeme Planı</TabsTrigger>
          <TabsTrigger value="tahsilat">Tahsilatlar</TabsTrigger>
          <TabsTrigger value="gider">Giderler</TabsTrigger>
          <TabsTrigger value="not">Notlar</TabsTrigger>
          <TabsTrigger value="belge">Belgeler</TabsTrigger>
        </TabsList>

        <TabsContent value="genel" className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
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
            <h3 className="font-semibold mb-2">Müşteri Ödeme Durumu</h3>
            {pieData.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={85} paddingAngle={2}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => formatTRY(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="text-sm text-muted-foreground py-12 text-center">Bu müşteri için ödeme verisi bulunmuyor.</div>}
          </div>
        </TabsContent>

        <TabsContent value="plan" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button asChild className="bg-accent hover:bg-accent-glow text-accent-foreground"><Link to={`/admin/odeme-planlari?musteri=${id}`}><Plus className="h-4 w-4 mr-1" /> Ödeme Ekle</Link></Button>
          </div>
          <div className="bg-card border border-border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="p-3 text-left">Başlık</th><th className="p-3 text-left">Vade</th><th className="p-3 text-right">Tutar</th><th className="p-3 text-right">Ödenen</th><th className="p-3 text-right">Kalan</th><th className="p-3">Durum</th></tr></thead>
              <tbody>
                {plans.map((p) => {
                  const paid = pays.filter((x) => x.payment_plan_id === p.id).reduce((a, x) => a + Number(x.amount), 0);
                  const remain = Math.max(0, Number(p.amount) - paid);
                  return (
                    <tr key={p.id} className="border-t border-border">
                      <td className="p-3"><div className="font-medium">{p.title}</div>{p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}</td>
                      <td className="p-3">{formatDate(p.due_date)}</td>
                      <td className="p-3 text-right">{formatTRY(p.amount)}</td>
                      <td className="p-3 text-right text-emerald-700">{formatTRY(paid)}</td>
                      <td className="p-3 text-right font-bold">{formatTRY(remain)}</td>
                      <td className="p-3"><span className={cn("px-2 py-0.5 rounded-md border text-xs", statusBadgeClass(p.status))}>{displayLabel(p.status)}</span></td>
                    </tr>
                  );
                })}
                {plans.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Bu müşteri için ödeme planı bulunmuyor.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="tahsilat" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button asChild className="bg-accent hover:bg-accent-glow text-accent-foreground"><Link to={`/admin/tahsilatlar?musteri=${id}`}><Plus className="h-4 w-4 mr-1" /> Yeni Tahsilat Ekle</Link></Button>
          </div>
          <div className="bg-card border border-border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="p-3 text-left">Tarih</th><th className="p-3 text-right">Tutar</th><th className="p-3">Yöntem</th><th className="p-3 text-left">Açıklama</th></tr></thead>
              <tbody>
                {pays.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-3">{formatDate(p.payment_date)}</td>
                    <td className="p-3 text-right text-emerald-700 font-medium">{formatTRY(p.amount)}</td>
                    <td className="p-3">{p.payment_method}</td>
                    <td className="p-3 text-muted-foreground">{p.description || "-"}</td>
                  </tr>
                ))}
                {pays.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Henüz tahsilat kaydı yok.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="gider" className="mt-4">
          <div className="bg-card border border-border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="p-3 text-left">Tarih</th><th className="p-3 text-left">Başlık</th><th className="p-3">Kategori</th><th className="p-3 text-right">Tutar</th></tr></thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="p-3">{formatDate(e.expense_date)}</td>
                    <td className="p-3">{e.title}</td>
                    <td className="p-3">{e.category}</td>
                    <td className="p-3 text-right">{formatTRY(e.amount)}</td>
                  </tr>
                ))}
                {expenses.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Bu müşteriye bağlı gider kaydı bulunmuyor.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="not" className="mt-4 space-y-3">
          <div className="bg-card border border-border rounded-md p-4">
            <Textarea placeholder="Yeni not..." value={newNote} onChange={(e) => setNewNote(e.target.value)} rows={3} />
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
        </TabsContent>

        <TabsContent value="belge" className="mt-4">
          <div className="bg-card border border-border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="p-3 text-left">Belge</th><th className="p-3">Tür</th><th className="p-3">Tarih</th><th className="p-3 text-right">İşlem</th></tr></thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="border-t border-border">
                    <td className="p-3">{d.title}</td>
                    <td className="p-3">{d.document_type}</td>
                    <td className="p-3">{formatDate(d.created_at)}</td>
                    <td className="p-3 text-right"><a href={d.file_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">Görüntüle</a></td>
                  </tr>
                ))}
                {docs.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Bu müşteri için belge kaydı bulunmuyor.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
