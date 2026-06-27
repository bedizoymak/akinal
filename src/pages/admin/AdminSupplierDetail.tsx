import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, Edit, Mail, Phone, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/AdminPage";
import { CardStatementTable } from "@/components/admin/finance/CardStatementTable";
import type { CardEntryFormValues } from "@/components/admin/finance/CardEntryForm";
import { useToast } from "@/hooks/use-toast";
import {
  getAdminSupplier,
  getSupplierFinancialEntries,
  createSupplierFinancialEntry,
  updateSupplierFinancialEntry,
  deleteSupplierFinancialEntry,
  getAdminProjects,
} from "@/lib/apiClient";

const TYPE_LABELS: Record<string, string> = {
  supplier: "Tedarikçi",
  subcontractor: "Alt Yüklenici",
  labor_service: "İşçilik/Hizmet",
  equipment_rental: "Ekipman Kiralama",
  crane_rental: "Vinç Kiralama",
  other: "Diğer",
};

export default function AdminSupplierDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: supplier, isLoading: loadingSupplier } = useQuery({
    queryKey: ["admin-supplier", id],
    queryFn: () => getAdminSupplier(id!),
    enabled: !!id,
  });

  const { data: entries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ["supplier-financial-entries", id],
    queryFn: () => getSupplierFinancialEntries({ supplier_id: id }),
    enabled: !!id,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["admin-projects"],
    queryFn: getAdminProjects,
  });

  async function handleAdd(values: CardEntryFormValues) {
    await createSupplierFinancialEntry({
      supplier_id: id!,
      project_id: values.project_id,
      entry_date: values.entry_date,
      title: values.title,
      notes: values.notes || null,
      amount: values.amount,
      paid_amount: values.paid_amount,
      currency: values.currency,
      exchange_rate_to_try: values.exchange_rate_to_try,
      is_exchange_rate_manual: values.is_exchange_rate_manual,
      account_type: values.account_type,
      payment_method: values.payment_method,
    });
    await qc.invalidateQueries({ queryKey: ["supplier-financial-entries", id] });
    toast({ title: "Kayıt eklendi." });
  }

  async function handleEdit(entryId: string, values: CardEntryFormValues) {
    await updateSupplierFinancialEntry({
      id: entryId,
      supplier_id: id!,
      project_id: values.project_id,
      entry_date: values.entry_date,
      title: values.title,
      notes: values.notes || null,
      amount: values.amount,
      paid_amount: values.paid_amount,
      currency: values.currency,
      exchange_rate_to_try: values.exchange_rate_to_try,
      is_exchange_rate_manual: values.is_exchange_rate_manual,
      account_type: values.account_type,
      payment_method: values.payment_method,
    });
    await qc.invalidateQueries({ queryKey: ["supplier-financial-entries", id] });
    toast({ title: "Kayıt güncellendi." });
  }

  async function handleDelete(entryId: string) {
    await deleteSupplierFinancialEntry(entryId);
    await qc.invalidateQueries({ queryKey: ["supplier-financial-entries", id] });
    toast({ title: "Kayıt silindi." });
  }

  if (loadingSupplier) return <div className="py-12 text-center text-sm text-muted-foreground">Yükleniyor...</div>;
  if (!supplier) return <div className="py-12 text-center text-sm text-destructive">Tedarikçi bulunamadı.</div>;

  const totalPlanned = entries.reduce((s, e) => s + Number(e.amount_try), 0);
  const totalPaid    = entries.reduce((s, e) => s + Number(e.paid_amount_try), 0);
  const totalRemaining = totalPlanned - totalPaid;

  function fmtTRY(v: number) {
    return "₺" + v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={supplier.name}
        description={TYPE_LABELS[supplier.supplier_type] ?? supplier.supplier_type}
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/tedarikciler"><ArrowLeft className="mr-1 h-4 w-4" /> Liste</Link>
            </Button>
            <Button asChild size="sm">
              <Link to={`/admin/tedarikciler/${id}/duzenle`}><Edit className="mr-1 h-4 w-4" /> Düzenle</Link>
            </Button>
          </div>
        }
      />

      {/* Contact info */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-card-soft">
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          {supplier.contact_person && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">İrtibat</div>
              <div className="mt-1 font-medium">{supplier.contact_person}</div>
            </div>
          )}
          {supplier.phone && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Telefon</div>
              <a href={`tel:${supplier.phone}`} className="mt-1 flex items-center gap-1 font-medium hover:underline">
                <Phone className="h-3.5 w-3.5" /> {supplier.phone}
              </a>
            </div>
          )}
          {supplier.whatsapp && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">WhatsApp</div>
              <a href={`https://wa.me/${supplier.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1 font-medium hover:underline text-emerald-600">
                <MessageCircle className="h-3.5 w-3.5" /> {supplier.whatsapp}
              </a>
            </div>
          )}
          {supplier.email && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">E-posta</div>
              <a href={`mailto:${supplier.email}`} className="mt-1 flex items-center gap-1 font-medium hover:underline">
                <Mail className="h-3.5 w-3.5" /> {supplier.email}
              </a>
            </div>
          )}
          {supplier.tax_no && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">VKN</div>
              <div className="mt-1 font-medium">{supplier.tax_no}</div>
            </div>
          )}
          {(supplier.city || supplier.district) && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Konum</div>
              <div className="mt-1 font-medium">{[supplier.district, supplier.city].filter(Boolean).join(", ")}</div>
            </div>
          )}
        </div>
        {supplier.notes && (
          <div className="mt-3 rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{supplier.notes}</div>
        )}
      </div>

      {/* Finance summary */}
      {entries.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Toplam Borç", value: fmtTRY(totalPlanned), color: "text-foreground" },
            { label: "Ödenen", value: fmtTRY(totalPaid), color: "text-emerald-600" },
            { label: "Kalan", value: fmtTRY(totalRemaining), color: totalRemaining > 0 ? "text-amber-600" : "text-emerald-600" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4 shadow-card-soft">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</div>
              <div className={`mt-1 text-2xl font-extrabold tabular-nums ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Financial entries */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-card-soft">
        <CardStatementTable
          entries={entries as any}
          projects={projects.map((p) => ({ id: p.id, title: p.title }))}
          direction="expense"
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDelete}
          loading={loadingEntries}
          title="Gider Kalemleri"
        />
      </div>
    </div>
  );
}
