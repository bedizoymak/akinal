import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminPageHeader } from "@/components/admin/AdminPage";
import { getAdminSuppliers } from "@/lib/apiClient";
import type { AdminSupplier } from "@/lib/apiTypes";

const TYPE_LABELS: Record<string, string> = {
  supplier: "Tedarikçi",
  subcontractor: "Alt Yüklenici",
  labor_service: "İşçilik/Hizmet",
  equipment_rental: "Ekipman Kiralama",
  crane_rental: "Vinç Kiralama",
  other: "Diğer",
};

export default function AdminSuppliers() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["admin-suppliers", q],
    queryFn: () => getAdminSuppliers({ q: q || undefined }),
  });

  const filtered = q
    ? suppliers.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()) || s.supplier_type.toLowerCase().includes(q.toLowerCase()))
    : suppliers;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Tedarikçiler"
        description="Tedarikçi ve alt yüklenici kart listesi"
        action={
          <Button asChild size="sm">
            <Link to="/admin/tedarikciler/yeni"><Plus className="mr-1 h-4 w-4" /> Yeni Tedarikçi</Link>
          </Button>
        }
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Tedarikçi ara..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Yükleniyor...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <Building2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Tedarikçi bulunamadı.</p>
          <Button asChild className="mt-4" size="sm"><Link to="/admin/tedarikciler/yeni">İlk tedarikçiyi ekle</Link></Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ad</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tür</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">İletişim</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Durum</th>
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((s: AdminSupplier) => (
                <tr key={s.id} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => navigate(`/admin/tedarikciler/${s.id}`)}>
                  <td className="px-4 py-3">
                    <span className="font-medium">{s.name}</span>
                    {s.tax_no && <div className="text-[11px] text-muted-foreground">VKN: {s.tax_no}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{TYPE_LABELS[s.supplier_type] ?? s.supplier_type}</td>
                  <td className="px-4 py-3">
                    {s.contact_person && <div>{s.contact_person}</div>}
                    {s.phone && <div className="text-muted-foreground">{s.phone}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${s.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-border bg-muted text-muted-foreground"}`}>
                      {s.is_active ? "Aktif" : "Pasif"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/admin/tedarikciler/${s.id}`}>Detay</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
