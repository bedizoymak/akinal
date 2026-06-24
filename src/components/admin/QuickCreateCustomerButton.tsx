import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { createAdminCustomer, getAdminCustomersData } from "@/lib/apiClient";
import type { AdminCustomer } from "@/lib/apiTypes";
import {
  formatTurkishPhone,
  isValidEmail,
  isValidTaxOrIdentityNumber,
  normalizeTurkishPhone,
  normalizeWhatsApp,
  type CustomerType,
} from "@/lib/customerMasterData";

type QuickCreateCustomerButtonProps = {
  onCreated: (customer: AdminCustomer) => void;
};

const emptyForm = {
  customer_type: "Bireysel" as CustomerType,
  full_name: "",
  company_name: "",
  phone: "",
  whatsapp: "",
  email: "",
  tax_or_identity_number: "",
  address: "",
};

export function QuickCreateCustomerButton({ onCreated }: QuickCreateCustomerButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [projects, setProjects] = useState<Array<{ id: string; title: string }>>([]);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [whatsappEdited, setWhatsappEdited] = useState(false);

  function reset() {
    setForm(emptyForm);
    setProjectIds([]);
    setWhatsappEdited(false);
  }

  async function openDialog() {
    setOpen(true);
    try {
      const data = await getAdminCustomersData();
      setProjects(data.projects || []);
    } catch (error) {
      toast({
        title: "Projeler alınamadı",
        description: error instanceof Error ? error.message : "Lütfen tekrar deneyin.",
        variant: "destructive",
      });
    }
  }

  async function save() {
    const isCompany = form.customer_type === "Kurumsal";
    const displayName = isCompany ? form.company_name.trim() : form.full_name.trim();
    const phone = normalizeTurkishPhone(form.phone);
    const whatsapp = normalizeWhatsApp(form.whatsapp);
    const email = form.email.trim();
    const taxNumber = form.tax_or_identity_number.trim();

    if (!displayName || !phone) {
      toast({ title: "Müşteri adı ve telefon zorunludur", variant: "destructive" });
      return;
    }
    if (whatsapp === null) { toast({ title: "WhatsApp numarası geçersiz", variant: "destructive" }); return; }
    if (email && !isValidEmail(email)) { toast({ title: "Geçerli bir e-posta adresi girin", variant: "destructive" }); return; }
    if (taxNumber && !isValidTaxOrIdentityNumber(taxNumber)) { toast({ title: "T.C. Kimlik / Vergi No yalnızca 10 veya 11 rakam olmalıdır", variant: "destructive" }); return; }
    if (isCompany && !taxNumber) { toast({ title: "Vergi No zorunludur", variant: "destructive" }); return; }
    if (isCompany && !form.address.trim()) { toast({ title: "Adres zorunludur", variant: "destructive" }); return; }
    if (projectIds.length === 0) { toast({ title: "En az bir ilgili proje seçmelisiniz", variant: "destructive" }); return; }

    setSaving(true);
    try {
      const customer = await createAdminCustomer({
        customer_type: form.customer_type,
        full_name: isCompany ? "" : displayName,
        company_name: isCompany ? displayName : "",
        phone,
        whatsapp,
        email,
        tax_or_identity_number: taxNumber,
        address: form.address.trim(),
        status: "Aktif",
        project_ids: projectIds,
      });
      onCreated(customer);
      toast({ title: "Müşteri eklendi" });
      setOpen(false);
      reset();
    } catch (error) {
      toast({
        title: "Müşteri eklenemedi",
        description: error instanceof Error ? error.message : "Lütfen bilgileri kontrol edip tekrar deneyin.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={openDialog}>
        <Plus className="h-4 w-4" />
        Yeni Müşteri
      </Button>

      <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) reset(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Yeni Müşteri</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Müşteri Türü</Label>
              <Select value={form.customer_type} onValueChange={(value) => setForm((current) => ({ ...current, customer_type: value as CustomerType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bireysel">Bireysel</SelectItem>
                  <SelectItem value="Kurumsal">Kurumsal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{form.customer_type === "Kurumsal" ? "Firma Resmi Ünvanı *" : "Ad Soyad *"}</Label>
              <Input
                value={form.customer_type === "Kurumsal" ? form.company_name : form.full_name}
                onChange={(event) => {
                  const value = event.target.value;
                  setForm((current) => form.customer_type === "Kurumsal" ? { ...current, company_name: value, full_name: "" } : { ...current, full_name: value, company_name: "" });
                }}
              />
            </div>
            {form.customer_type === "Kurumsal" && (
              <div>
                <Label>Yetkili Kişi</Label>
                <Input disabled placeholder="Veritabanı alanı henüz tanımlı değil" />
              </div>
            )}
            <div>
              <Label>Telefon *</Label>
              <Input
                inputMode="tel"
                value={form.phone}
                onChange={(event) => {
                  const value = event.target.value;
                  setForm((current) => ({ ...current, phone: value, whatsapp: whatsappEdited ? current.whatsapp : formatTurkishPhone(value) }));
                }}
                onBlur={() => setForm((current) => ({ ...current, phone: formatTurkishPhone(current.phone) }))}
              />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input
                inputMode="tel"
                value={form.whatsapp}
                onChange={(event) => { setWhatsappEdited(true); setForm((current) => ({ ...current, whatsapp: event.target.value })); }}
                onBlur={() => setForm((current) => ({ ...current, whatsapp: formatTurkishPhone(current.whatsapp) }))}
              />
            </div>
            <div>
              <Label>E-posta</Label>
              <Input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
            </div>
            <div>
              <Label>T.C. Kimlik / Vergi No{form.customer_type === "Kurumsal" ? " *" : ""}</Label>
              <Input inputMode="numeric" maxLength={11} value={form.tax_or_identity_number} onChange={(event) => setForm((current) => ({ ...current, tax_or_identity_number: event.target.value.replace(/\D/g, "") }))} />
            </div>
            <div>
              <Label>Adres{form.customer_type === "Kurumsal" ? " *" : ""}</Label>
              <Input value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
            </div>
            <div>
              <Label>İlgili Projeler *</Label>
              <div className="mt-2 max-h-40 space-y-2 overflow-auto rounded-md border border-border p-3">
                {projects.length === 0 && <div className="text-sm text-muted-foreground">Henüz proje yok.</div>}
                {projects.map((project) => (
                  <label key={project.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={projectIds.includes(project.id)}
                      onCheckedChange={(checked) => setProjectIds((current) => checked ? [...current, project.id] : current.filter((id) => id !== project.id))}
                    />
                    {project.title}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>İptal</Button>
            <Button onClick={save} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent-glow">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Kaydediliyor..." : "Ekle ve Seç"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
