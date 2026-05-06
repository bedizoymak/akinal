import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { CUSTOMER_TYPES, CUSTOMER_STATUSES } from "@/lib/finance";
import { ArrowLeft, Save } from "lucide-react";

const empty = {
  customer_type: "Bireysel", full_name: "", company_name: "",
  phone: "", whatsapp: "", email: "", tax_or_identity_number: "",
  address: "", city: "", district: "", status: "Aktif", notes: "",
};

export default function AdminCustomerEdit() {
  const { id } = useParams();
  const isNew = !id;
  const nav = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState<any>(empty);
  const [projects, setProjects] = useState<any[]>([]);
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: prs } = await supabase.from("projects").select("id,title").order("sort_order");
      setProjects(prs || []);
      if (id) {
        const { data: c } = await (supabase.from("customers" as any).select("*").eq("id", id).maybeSingle()) as any;
        if (c) setForm(c);
        const { data: links } = await (supabase.from("customer_projects" as any).select("project_id").eq("customer_id", id)) as any;
        setLinkedIds(((links as any[]) || []).map((l) => l.project_id));
      }
    })();
  }, [id]);

  function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.phone) { toast({ title: "Telefon zorunludur", variant: "destructive" }); return; }
    if (form.customer_type === "Firma" && !form.company_name) { toast({ title: "Firma adı zorunludur", variant: "destructive" }); return; }
    if (form.customer_type !== "Firma" && !form.full_name) { toast({ title: "Ad Soyad zorunludur", variant: "destructive" }); return; }
    setLoading(true);
    let customerId = id;
    if (isNew) {
      const { data, error } = await (supabase.from("customers" as any).insert(form).select("id").single()) as any;
      if (error) { toast({ title: "Hata", description: error.message, variant: "destructive" }); setLoading(false); return; }
      customerId = data.id;
    } else {
      const { error } = await (supabase.from("customers" as any).update(form).eq("id", id)) as any;
      if (error) { toast({ title: "Hata", description: error.message, variant: "destructive" }); setLoading(false); return; }
    }
    // Update project links
    await (supabase.from("customer_projects" as any).delete().eq("customer_id", customerId)) as any;
    if (linkedIds.length) {
      await (supabase.from("customer_projects" as any).insert(linkedIds.map((pid) => ({ customer_id: customerId, project_id: pid })))) as any;
    }
    toast({ title: isNew ? "Müşteri eklendi" : "Müşteri güncellendi" });
    setLoading(false);
    nav(`/admin/musteriler/${customerId}`);
  }

  function toggleProject(pid: string, on: boolean) {
    setLinkedIds((prev) => on ? [...prev, pid] : prev.filter((x) => x !== pid));
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon"><Link to="/admin/musteriler"><ArrowLeft className="h-5 w-5" /></Link></Button>
          <h1 className="font-display text-3xl font-bold">{isNew ? "Yeni Müşteri Ekle" : "Müşteriyi Düzenle"}</h1>
        </div>
        <Button onClick={save} disabled={loading} className="bg-accent hover:bg-accent-glow text-accent-foreground"><Save className="h-4 w-4 mr-1" /> Kaydet</Button>
      </div>

      <div className="bg-card border border-border rounded-md p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Müşteri Türü</Label>
          <Select value={form.customer_type} onValueChange={(v) => set("customer_type", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CUSTOMER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
        </div>
        <div>
          <Label>Müşteri Durumu</Label>
          <Select value={form.status} onValueChange={(v) => set("status", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CUSTOMER_STATUSES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
        </div>
        <div><Label>Ad Soyad</Label><Input value={form.full_name || ""} onChange={(e) => set("full_name", e.target.value)} /></div>
        <div><Label>Firma Adı</Label><Input value={form.company_name || ""} onChange={(e) => set("company_name", e.target.value)} /></div>
        <div><Label>Telefon *</Label><Input value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} /></div>
        <div><Label>WhatsApp</Label><Input value={form.whatsapp || ""} onChange={(e) => set("whatsapp", e.target.value)} /></div>
        <div><Label>E-posta</Label><Input type="email" value={form.email || ""} onChange={(e) => set("email", e.target.value)} /></div>
        <div><Label>T.C. Kimlik / Vergi No</Label><Input value={form.tax_or_identity_number || ""} onChange={(e) => set("tax_or_identity_number", e.target.value)} /></div>
        <div className="md:col-span-2"><Label>Adres</Label><Input value={form.address || ""} onChange={(e) => set("address", e.target.value)} /></div>
        <div><Label>İl</Label><Input value={form.city || ""} onChange={(e) => set("city", e.target.value)} /></div>
        <div><Label>İlçe</Label><Input value={form.district || ""} onChange={(e) => set("district", e.target.value)} /></div>
        <div className="md:col-span-2">
          <Label>İlgili Projeler</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 p-3 border border-border rounded-md max-h-56 overflow-auto">
            {projects.length === 0 && <div className="text-sm text-muted-foreground">Henüz proje yok.</div>}
            {projects.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={linkedIds.includes(p.id)} onCheckedChange={(v) => toggleProject(p.id, !!v)} />
                {p.title}
              </label>
            ))}
          </div>
        </div>
        <div className="md:col-span-2"><Label>Notlar</Label><Textarea value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} rows={4} /></div>
      </div>
    </div>
  );
}
