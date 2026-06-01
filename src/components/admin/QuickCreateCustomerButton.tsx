import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { createAdminCustomer } from "@/lib/apiClient";
import type { AdminCustomer } from "@/lib/apiTypes";

type CustomerType = "Bireysel" | "Firma";

type QuickCreateCustomerButtonProps = {
  onCreated: (customer: AdminCustomer) => void;
};

const emptyForm = {
  customer_type: "Bireysel" as CustomerType,
  full_name: "",
  company_name: "",
  phone: "",
  email: "",
};

export function QuickCreateCustomerButton({ onCreated }: QuickCreateCustomerButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  function reset() {
    setForm(emptyForm);
  }

  async function save() {
    const isCompany = form.customer_type === "Firma";
    const displayName = isCompany ? form.company_name.trim() : form.full_name.trim();
    const phone = form.phone.trim();

    if (!displayName || !phone) {
      toast({ title: "Müşteri adı ve telefon zorunludur", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const customer = await createAdminCustomer({
        customer_type: form.customer_type,
        full_name: isCompany ? "" : displayName,
        company_name: isCompany ? displayName : "",
        phone,
        email: form.email.trim(),
        status: "Aktif",
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
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
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
                  <SelectItem value="Firma">Firma</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{form.customer_type === "Firma" ? "Firma Adı *" : "Ad Soyad *"}</Label>
              <Input
                value={form.customer_type === "Firma" ? form.company_name : form.full_name}
                onChange={(event) => {
                  const value = event.target.value;
                  setForm((current) => form.customer_type === "Firma" ? { ...current, company_name: value } : { ...current, full_name: value });
                }}
              />
            </div>
            <div>
              <Label>Telefon *</Label>
              <Input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
            </div>
            <div>
              <Label>E-posta</Label>
              <Input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
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
