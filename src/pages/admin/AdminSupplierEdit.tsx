import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AdminPageHeader } from "@/components/admin/AdminPage";
import { useToast } from "@/hooks/use-toast";
import { createAdminSupplier, updateAdminSupplier, getAdminSupplier } from "@/lib/apiClient";
import type { SupplierType } from "@/lib/apiTypes";

const SUPPLIER_TYPES: { value: SupplierType; label: string }[] = [
  { value: "supplier", label: "Tedarikçi" },
  { value: "subcontractor", label: "Alt Yüklenici" },
  { value: "labor_service", label: "İşçilik/Hizmet" },
  { value: "equipment_rental", label: "Ekipman Kiralama" },
  { value: "crane_rental", label: "Vinç Kiralama" },
  { value: "other", label: "Diğer" },
];

interface FormState {
  name: string;
  supplier_type: SupplierType;
  contact_person: string;
  phone: string;
  whatsapp: string;
  email: string;
  tax_no: string;
  address: string;
  city: string;
  district: string;
  notes: string;
  is_active: boolean;
}

const blank: FormState = {
  name: "", supplier_type: "supplier", contact_person: "", phone: "",
  whatsapp: "", email: "", tax_no: "", address: "", city: "", district: "",
  notes: "", is_active: true,
};

export default function AdminSupplierEdit() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = !id || id === "yeni";
  const [form, setForm] = useState<FormState>(blank);
  const [saving, setSaving] = useState(false);

  const { data: existing, isLoading } = useQuery({
    queryKey: ["admin-supplier", id],
    queryFn: () => getAdminSupplier(id!),
    enabled: !isNew,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name ?? "",
        supplier_type: existing.supplier_type ?? "supplier",
        contact_person: existing.contact_person ?? "",
        phone: existing.phone ?? "",
        whatsapp: existing.whatsapp ?? "",
        email: existing.email ?? "",
        tax_no: existing.tax_no ?? "",
        address: existing.address ?? "",
        city: existing.city ?? "",
        district: existing.district ?? "",
        notes: existing.notes ?? "",
        is_active: Boolean(existing.is_active),
      });
    }
  }, [existing]);

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    if (!form.name.trim()) { toast({ title: "Hata", description: "Ad zorunludur.", variant: "destructive" }); return; }
    setSaving(true);
    try {
      if (isNew) {
        const created = await createAdminSupplier({ ...form, is_active: form.is_active ? 1 : 0 } as any);
        toast({ title: "Tedarikçi oluşturuldu." });
        navigate(`/admin/tedarikciler/${created.id}`);
      } else {
        await updateAdminSupplier({ id: id!, ...form, is_active: form.is_active ? 1 : 0 } as any);
        toast({ title: "Tedarikçi güncellendi." });
        navigate(`/admin/tedarikciler/${id}`);
      }
    } catch (e: unknown) {
      toast({ title: "Hata", description: e instanceof Error ? e.message : "Kayıt başarısız.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (!isNew && isLoading) return <div className="py-12 text-center text-sm text-muted-foreground">Yükleniyor...</div>;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={isNew ? "Yeni Tedarikçi" : "Tedarikçi Düzenle"}
        description={isNew ? "Yeni bir tedarikçi kartı oluştur" : existing?.name ?? ""}
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={isNew ? "/admin/tedarikciler" : `/admin/tedarikciler/${id}`}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Geri
            </Link>
          </Button>
        }
      />

      <div className="rounded-xl border border-border bg-card p-6 shadow-card-soft">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Tedarikçi Adı *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Şirket veya şahıs adı" />
          </div>

          <div>
            <Label>Tür</Label>
            <Select value={form.supplier_type} onValueChange={(v) => set("supplier_type", v as SupplierType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SUPPLIER_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div>
            <Label>Durum</Label>
            <Select value={form.is_active ? "active" : "passive"} onValueChange={(v) => set("is_active", v === "active")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="passive">Pasif</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div><Label>İrtibat Kişisi</Label><Input value={form.contact_person} onChange={(e) => set("contact_person", e.target.value)} /></div>
          <div><Label>Telefon</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
          <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></div>
          <div><Label>E-posta</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
          <div><Label>VKN / T.C. Kimlik No</Label><Input value={form.tax_no} onChange={(e) => set("tax_no", e.target.value)} /></div>
          <div><Label>Şehir</Label><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></div>
          <div><Label>İlçe</Label><Input value={form.district} onChange={(e) => set("district", e.target.value)} /></div>

          <div className="md:col-span-2">
            <Label>Adres</Label>
            <Textarea value={form.address} onChange={(e) => set("address", e.target.value)} rows={2} />
          </div>

          <div className="md:col-span-2">
            <Label>Notlar</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" asChild><Link to={isNew ? "/admin/tedarikciler" : `/admin/tedarikciler/${id}`}>İptal</Link></Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {isNew ? "Oluştur" : "Güncelle"}
          </Button>
        </div>
      </div>
    </div>
  );
}
