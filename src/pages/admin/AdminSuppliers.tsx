import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Edit, Trash2, Eye, Download, Phone, Building2, Wallet, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatTRY, exportCSV } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { AdminEmptyState, AdminMetricCard, AdminPageHeader } from "@/components/admin/AdminPage";
import { deleteAdminSupplier, getAdminSuppliers, getSupplierFinancialEntries } from "@/lib/apiClient";

const TYPE_LABELS: Record<string, string> = {
  supplier: "Tedarikçi",
  subcontractor: "Alt Yüklenici",
  labor_service: "İşçilik/Hizmet",
  equipment_rental: "Ekipman Kiralama",
  crane_rental: "Vinç Kiralama",
  other: "Diğer",
};

const SUPPLIER_TYPES = Object.keys(TYPE_LABELS);

export default function AdminSuppliers() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [balanceFilter, setBalanceFilter] = useState("all");
  const { toast } = useToast();
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    try {
      const [supplierData, entryData] = await Promise.all([
        getAdminSuppliers(),
        getSupplierFinancialEntries(),
      ]);
      setSuppliers(supplierData || []);
      setEntries(entryData || []);
    } catch (error) {
      toast({ title: "Tedarikçi verileri alınamadı", description: error instanceof Error ? error.message : "Lütfen tekrar deneyin.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const enriched = useMemo(() => {
    return suppliers.map((s) => {
      const supplierEntries = entries.filter((e: any) => e.supplier_id === s.id);
      const totalDue = supplierEntries.reduce((sum: number, e: any) => sum + (Number(e.amount_try) || 0), 0);
      const totalPaid = supplierEntries.reduce((sum: number, e: any) => sum + (Number(e.paid_amount_try) || 0), 0);
      const balance = Math.max(0, totalDue - totalPaid);
      return { ...s, totalDue, totalPaid, balance };
    });
  }, [suppliers, entries]);

  const filtered = enriched.filter((s) => {
    if (q && !`${s.name} ${s.phone || ""} ${s.contact_person || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (typeFilter !== "all" && s.supplier_type !== typeFilter) return false;
    if (balanceFilter === "with" && s.balance <= 0) return false;
    if (balanceFilter === "clear" && s.balance > 0) return false;
    return true;
  });

  const summary = {
    totalSuppliers: enriched.length,
    totalPaid: enriched.reduce((sum, s) => sum + s.totalPaid, 0),
    pendingBalance: enriched.reduce((sum, s) => sum + s.balance, 0),
    closedAccounts: enriched.filter((s) => s.balance <= 0 && s.totalDue > 0).length,
  };

  async function remove(id: string, name: string) {
    if (!confirm(`"${name}" tedarikçi kaydını silmek istediğinize emin misiniz? Bu işlem bağlı finansal kayıtları da siler.`)) return;
    try {
      await deleteAdminSupplier(id);
      toast({ title: "Tedarikçi silindi" });
      await load();
    } catch (error) {
      toast({ title: "Tedarikçi silinemedi", description: error instanceof Error ? error.message : "Lütfen tekrar deneyin.", variant: "destructive" });
    }
  }

  function downloadCSV() {
    exportCSV("tedarikciler.csv", filtered.map((s) => ({
      "Tedarikçi": s.name,
      "Tür": TYPE_LABELS[s.supplier_type] ?? s.supplier_type,
      "Telefon": s.phone || "",
      "İletişim Kişisi": s.contact_person || "",
      "Planlanan Borç": s.totalDue,
      "Ödenen": s.totalPaid,
      "Kalan Borç": s.balance,
    })));
  }

  return (
    <div>
      <AdminPageHeader
        eyebrow="Tedarik ve Gider"
        title="Tedarikçiler"
        description="Tedarikçi ilişkilerini, ödemeleri ve kalan bakiyeleri tek yerden izleyin."
        actions={
          <>
            <Button variant="outline" onClick={downloadCSV}><Download className="h-4 w-4 mr-1" /> CSV Olarak İndir</Button>
            <Button asChild className="bg-accent hover:bg-accent-glow text-accent-foreground"><Link to="/admin/tedarikciler/yeni"><Plus className="h-4 w-4" /> Yeni Tedarikçi</Link></Button>
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Toplam Tedarikçi" value={summary.totalSuppliers} description="Kayıtlı tedarikçi hesabı" icon={Building2} tone="accent" />
        <AdminMetricCard label="Toplam Ödenen" value={formatTRY(summary.totalPaid)} description="Tedarikçilere yapılan toplam ödeme" icon={Wallet} tone="success" />
        <AdminMetricCard label="Bekleyen Ödeme" value={formatTRY(summary.pendingBalance)} description="Kalan tedarikçi borcu" icon={AlertTriangle} tone={summary.pendingBalance > 0 ? "warning" : "success"} />
        <AdminMetricCard label="Bakiyesi Kapanan" value={summary.closedAccounts} description="Borcu kalmayan tedarikçi" icon={CheckCircle2} tone="success" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5 p-4 bg-card border border-border rounded-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Ara..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Türler</SelectItem>
            {SUPPLIER_TYPES.map((t) => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={balanceFilter} onValueChange={setBalanceFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Bakiyeler</SelectItem>
            <SelectItem value="with">Borcu Olan</SelectItem>
            <SelectItem value="clear">Borcu Kapanmış</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Yükleniyor...</div>
      ) : filtered.length === 0 ? (
        <AdminEmptyState
          title={suppliers.length === 0 ? "Henüz tedarikçi kaydı yok" : "Tedarikçi bulunamadı"}
          description={suppliers.length === 0 ? "İlk tedarikçi kartını oluşturarak tedarik takibine başlayın." : "Arama veya filtreleri temizleyebilir, yeni tedarikçi kaydı oluşturabilirsiniz."}
          icon={Building2}
          action={<Button asChild className="bg-accent hover:bg-accent-glow text-accent-foreground"><Link to="/admin/tedarikciler/yeni">Yeni Tedarikçi Ekle</Link></Button>}
        />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {filtered.map((s) => (
              <div key={s.id} className="rounded-md border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{s.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{TYPE_LABELS[s.supplier_type] ?? s.supplier_type} · {s.phone || "Telefon yok"}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div><div className="text-xs text-muted-foreground">Ödenen</div><div className="font-semibold text-emerald-700">{formatTRY(s.totalPaid)}</div></div>
                  <div><div className="text-xs text-muted-foreground">Kalan Borç</div><div className={cn("font-semibold", s.balance > 0 ? "text-red-600" : "text-emerald-700")}>{formatTRY(s.balance)}</div></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline"><Link to={`/admin/tedarikciler/${s.id}`}><Eye className="h-4 w-4" /> Görüntüle</Link></Button>
                  <Button asChild size="sm" variant="outline"><Link to={`/admin/tedarikciler/${s.id}/duzenle`}><Edit className="h-4 w-4" /> Düzenle</Link></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(s.id, s.name)}><Trash2 className="h-4 w-4 text-destructive" /> Sil</Button>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto bg-card border border-border rounded-md md:block">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-3">Tedarikçi</th>
                  <th className="p-3">Telefon</th>
                  <th className="p-3">Tür</th>
                  <th className="p-3 text-right">Planlanan Borç</th>
                  <th className="p-3 text-right">Ödenen</th>
                  <th className="p-3 text-right">Kalan Borç</th>
                  <th className="p-3 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="cursor-pointer border-t border-border transition-colors duration-150 hover:bg-orange-50/70"
                    onClick={() => navigate(`/admin/tedarikciler/${s.id}`)}
                  >
                    <td className="p-3">
                      <div className="font-semibold">{s.name}</div>
                      {s.tax_no && <div className="text-xs text-muted-foreground">VKN: {s.tax_no}</div>}
                    </td>
                    <td className="p-3">
                      {s.phone ? <div className="flex items-center gap-1 text-xs"><Phone className="h-3 w-3" /> {s.phone}</div> : <span className="text-muted-foreground">—</span>}
                      {s.contact_person && <div className="text-xs text-muted-foreground">{s.contact_person}</div>}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{TYPE_LABELS[s.supplier_type] ?? s.supplier_type}</td>
                    <td className="p-3 text-right font-medium">{formatTRY(s.totalDue)}</td>
                    <td className="p-3 text-right text-emerald-700">{formatTRY(s.totalPaid)}</td>
                    <td className={cn("p-3 text-right font-bold", s.balance > 0 ? "text-red-600" : "text-emerald-700")}>{formatTRY(s.balance)}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button asChild size="sm" variant="ghost" title="Görüntüle"><Link to={`/admin/tedarikciler/${s.id}`}><Eye className="h-4 w-4" /><span className="sr-only xl:not-sr-only xl:ml-1">Görüntüle</span></Link></Button>
                        <Button asChild size="sm" variant="ghost" title="Düzenle"><Link to={`/admin/tedarikciler/${s.id}/duzenle`}><Edit className="h-4 w-4" /><span className="sr-only xl:not-sr-only xl:ml-1">Düzenle</span></Link></Button>
                        <Button size="sm" variant="ghost" title="Sil" onClick={() => remove(s.id, s.name)}><Trash2 className="h-4 w-4 text-destructive" /><span className="sr-only xl:not-sr-only xl:ml-1">Sil</span></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
