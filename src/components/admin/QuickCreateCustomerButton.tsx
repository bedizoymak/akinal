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
  isValidCustomerTaxOrIdentityNumber,
  normalizeCustomerContactPayload,
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
    const normalizedCustomer = normalizeCustomerContactPayload(form.customer_type, form);
    const { phone, whatsapp } = normalizedCustomer;
    const email = form.email.trim();
    const taxNumber = form.tax_or_identity_number.trim();

    if (!displayName || !phone) {
      toast({ title: "Müşteri adı ve telefon zorunludur", variant: "destructive" });
      return;
    }
    if (whatsapp === null) { toast({ title: "WhatsApp numarası geçersiz", variant: "destructive" }); return; }
    if (email && !isValidEmail(email)) { toast({ title: "Geçerli bir e-posta adresi girin", variant: "destructive" }); return; }
    if (taxNumber && !isValidCustomerTaxOrIdentityNumber(form.customer_type, taxNumber)) {
      toast({ title: isCompany ? "Vergi No 10 veya 11 rakam olmalıdır" : "T.C. Kimlik No 11 rakam olmalıdır", variant: "destructive" });
      return;
    }
    if (isCompany && !taxNumber) { toast({ title: "Vergi No zorunludur", variant: "destructive" }); return; }
    if (isCompany && !form.address.trim()) { toast({ title: "Adres zorunludur", variant: "destructive" }); return; }
    if (projectIds.length === 0) { toast({ title: "En az bir ilgili proje seçmelisiniz", variant: "destructive" }); return; }

    setSaving(true);
    try {
      const customer = await createAdminCustomer({
        ...normalizedCustomer,
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
              <Label htmlFor="quick-customer-type">Müşteri Türü</Label>
              <Select name="customer_type" value={form.customer_type} onValueChange={(value) => setForm((current) => ({ ...current, customer_type: value as CustomerType, full_name: value === "Bireysel" ? current.full_name : "", company_name: value === "Kurumsal" ? current.company_name : "" }))}>
                <SelectTrigger id="quick-customer-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bireysel">Bireysel</SelectItem>
                  <SelectItem value="Kurumsal">Kurumsal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="quick-customer-name">{form.customer_type === "Kurumsal" ? "Firma Resmi Ünvanı *" : "Ad Soyad *"}</Label>
              <Input
                id="quick-customer-name"
                name={form.customer_type === "Kurumsal" ? "company_name" : "full_name"}
                value={form.customer_type === "Kurumsal" ? form.company_name : form.full_name}
                onChange={(event) => {
                  const value = event.target.value;
                  setForm((current) => form.customer_type === "Kurumsal" ? { ...current, company_name: value, full_name: "" } : { ...current, full_name: value, company_name: "" });
                }}
              />
            </div>
            {form.customer_type === "Kurumsal" && (
              <div>
                <Label htmlFor="quick-customer-contact-person">Yetkili Kişi</Label>
                <Input id="quick-customer-contact-person" name="contact_person" disabled placeholder="Veritabanı alanı henüz tanımlı değil" />
              </div>
            )}
            <div>
              <Label htmlFor="quick-customer-phone">Telefon *</Label>
              <Input
                id="quick-customer-phone"
                name="phone"
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
              <Label htmlFor="quick-customer-whatsapp">WhatsApp</Label>
              <Input
                id="quick-customer-whatsapp"
                name="whatsapp"
                inputMode="tel"
                value={form.whatsapp}
                onChange={(event) => { setWhatsappEdited(true); setForm((current) => ({ ...current, whatsapp: event.target.value })); }}
                onBlur={() => setForm((current) => ({ ...current, whatsapp: formatTurkishPhone(current.whatsapp) }))}
              />
            </div>
            <div>
              <Label htmlFor="quick-customer-email">E-posta</Label>
              <Input id="quick-customer-email" name="email" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
            </div>
            <div>
              <Label htmlFor="quick-customer-tax-number">T.C. Kimlik / Vergi No{form.customer_type === "Kurumsal" ? " *" : ""}</Label>
              <Input id="quick-customer-tax-number" name="tax_or_identity_number" inputMode="numeric" maxLength={11} value={form.tax_or_identity_number} onChange={(event) => setForm((current) => ({ ...current, tax_or_identity_number: event.target.value.replace(/\D/g, "") }))} />
            </div>
            <div>
              <Label htmlFor="quick-customer-address">Adres{form.customer_type === "Kurumsal" ? " *" : ""}</Label>
              <Input id="quick-customer-address" name="address" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
            </div>
            <div>
              <Label>İlgili Projeler *</Label>
              <div className="mt-2 max-h-40 space-y-2 overflow-auto rounded-md border border-border p-3">
                {projects.length === 0 && <div className="text-sm text-muted-foreground">Henüz proje yok.</div>}
                {projects.map((project) => (
                  <label key={project.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      id={`quick-customer-project-${project.id}`}
                      name="project_ids"
                      value={project.id}
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
