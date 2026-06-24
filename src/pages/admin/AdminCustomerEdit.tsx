import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { CUSTOMER_TYPES } from "@/lib/finance";
import { ArrowLeft, Save } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPage";
import { createAdminCustomer, getAdminCustomerDetail, getAdminCustomersData, updateAdminCustomer } from "@/lib/apiClient";
import {
  formatTurkishPhone,
  isValidEmail,
  isValidTaxOrIdentityNumber,
  normalizeCustomerType,
  normalizeTurkishPhone,
  normalizeWhatsApp,
} from "@/lib/customerMasterData";

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
  const [whatsappEdited, setWhatsappEdited] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (id) {
          const data = await getAdminCustomerDetail(id);
          setProjects(data.projects || []);
          if (data.customer) {
            setForm({
              ...data.customer,
              customer_type: normalizeCustomerType(data.customer.customer_type),
              phone: formatTurkishPhone(data.customer.phone),
              whatsapp: formatTurkishPhone(data.customer.whatsapp),
            });
            setWhatsappEdited(Boolean(data.customer.whatsapp));
          }
          setLinkedIds((data.links || []).map((l) => l.project_id));
        } else {
          const data = await getAdminCustomersData();
          setProjects(data.projects || []);
        }
      } catch (error) {
        toast({ title: "Müşteri bilgileri alınamadı", description: error instanceof Error ? error.message : "Lütfen tekrar deneyin.", variant: "destructive" });
      }
    })();
  }, [id, toast]);

  function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }

  function changeCustomerType(customerType: string) {
    setForm((current: any) => ({
      ...current,
      customer_type: customerType,
      full_name: customerType === "Bireysel" ? current.full_name : "",
      company_name: customerType === "Kurumsal" ? current.company_name : "",
    }));
  }

  function changePhone(value: string) {
    setForm((current: any) => ({
      ...current,
      phone: value,
      whatsapp: whatsappEdited ? current.whatsapp : formatTurkishPhone(value),
    }));
  }

  async function save() {
    const isCorporate = form.customer_type === "Kurumsal";
    const phone = normalizeTurkishPhone(form.phone || "");
    const whatsapp = normalizeWhatsApp(form.whatsapp || "");
    const email = (form.email || "").trim();
    const taxNumber = (form.tax_or_identity_number || "").trim();
    if (!phone) { toast({ title: "Telefon 05XXXXXXXXX biçiminde 11 haneli olmalıdır", variant: "destructive" }); return; }
    if (whatsapp === null) { toast({ title: "WhatsApp numarası geçerli bir Türkiye cep telefonu olmalıdır", variant: "destructive" }); return; }
    if (isCorporate && !(form.company_name || "").trim()) { toast({ title: "Firma Resmi Ünvanı zorunludur", variant: "destructive" }); return; }
    if (!isCorporate && !(form.full_name || "").trim()) { toast({ title: "Ad Soyad zorunludur", variant: "destructive" }); return; }
    if (email && !isValidEmail(email)) { toast({ title: "Geçerli bir e-posta adresi girin", variant: "destructive" }); return; }
    if (taxNumber && !isValidTaxOrIdentityNumber(taxNumber)) { toast({ title: "T.C. Kimlik / Vergi No yalnızca 10 veya 11 rakam olmalıdır", variant: "destructive" }); return; }
    if (isCorporate && !taxNumber) { toast({ title: "Vergi No zorunludur", variant: "destructive" }); return; }
    if (isCorporate && !(form.address || "").trim()) { toast({ title: "Adres zorunludur", variant: "destructive" }); return; }
    if (linkedIds.length === 0) { toast({ title: "En az bir ilgili proje seçmelisiniz", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const payload = {
        ...form,
        full_name: isCorporate ? "" : form.full_name.trim(),
        company_name: isCorporate ? form.company_name.trim() : "",
        phone,
        whatsapp,
        email,
        tax_or_identity_number: taxNumber,
        status: form.status || "Aktif",
        project_ids: linkedIds,
      };
      const customer = isNew ? await createAdminCustomer(payload) : await updateAdminCustomer({ ...payload, id: id || "" });
      toast({ title: isNew ? "Müşteri eklendi" : "Müşteri güncellendi" });
      nav(`/admin/musteriler/${customer.id}`);
    } catch (error) {
      toast({ title: "Müşteri kaydedilemedi", description: error instanceof Error ? error.message : "Müşteri bilgileri kaydedilirken bir problem oluştu. Lütfen alanları kontrol edip tekrar deneyin.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function toggleProject(pid: string, on: boolean) {
    setLinkedIds((prev) => on ? [...prev, pid] : prev.filter((x) => x !== pid));
  }

  return (
    <div className="max-w-4xl">
      <AdminPageHeader
        eyebrow="Cari ve Tahsilat"
        title={isNew ? "Yeni Müşteri" : "Müşteri Düzenle"}
        description="Müşteri iletişim bilgilerini, cari bilgilerini ve ilgili proje bağlantılarını düzenleyin."
        actions={
          <>
            <Button asChild variant="outline"><Link to="/admin/musteriler"><ArrowLeft className="h-4 w-4" /> Müşterilere Dön</Link></Button>
            <Button onClick={save} disabled={loading} className="bg-accent hover:bg-accent-glow text-accent-foreground"><Save className="h-4 w-4" /> Kaydet</Button>
          </>
        }
      />

      <div className="bg-card border border-border rounded-md p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Müşteri Türü</Label>
          <Select value={form.customer_type} onValueChange={changeCustomerType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CUSTOMER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
        </div>
        <div>
          <Label>{form.customer_type === "Kurumsal" ? "Firma Resmi Ünvanı *" : "Ad Soyad *"}</Label>
          <Input
            value={form.customer_type === "Kurumsal" ? form.company_name || "" : form.full_name || ""}
            onChange={(e) => set(form.customer_type === "Kurumsal" ? "company_name" : "full_name", e.target.value)}
          />
        </div>
        {form.customer_type === "Kurumsal" && <div><Label>Yetkili Kişi</Label><Input disabled placeholder="Veritabanı alanı henüz tanımlı değil" /></div>}
        <div><Label>Telefon *</Label><Input inputMode="tel" value={form.phone || ""} onChange={(e) => changePhone(e.target.value)} onBlur={() => set("phone", formatTurkishPhone(form.phone))} /></div>
        <div><Label>WhatsApp</Label><Input inputMode="tel" value={form.whatsapp || ""} onChange={(e) => { setWhatsappEdited(true); set("whatsapp", e.target.value); }} onBlur={() => set("whatsapp", formatTurkishPhone(form.whatsapp))} /></div>
        <div><Label>E-posta</Label><Input type="email" value={form.email || ""} onChange={(e) => set("email", e.target.value)} /></div>
        <div><Label>T.C. Kimlik / Vergi No{form.customer_type === "Kurumsal" ? " *" : ""}</Label><Input inputMode="numeric" maxLength={11} value={form.tax_or_identity_number || ""} onChange={(e) => set("tax_or_identity_number", e.target.value.replace(/\D/g, ""))} /></div>
        <div className="md:col-span-2"><Label>Adres{form.customer_type === "Kurumsal" ? " *" : ""}</Label><Input value={form.address || ""} onChange={(e) => set("address", e.target.value)} /></div>
        <div><Label>İl</Label><Input value={form.city || ""} onChange={(e) => set("city", e.target.value)} /></div>
        <div><Label>İlçe</Label><Input value={form.district || ""} onChange={(e) => set("district", e.target.value)} /></div>
        <div className="md:col-span-2">
          <Label>İlgili Projeler *</Label>
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
