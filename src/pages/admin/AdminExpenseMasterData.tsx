import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Edit, Trash2, ToggleLeft, ToggleRight, Filter, Tags, Layers3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { AdminEmptyState, AdminPageHeader } from "@/components/admin/AdminPage";
import type { ExpenseCategoryMasterRecord, ExpenseItemMasterRecord } from "@/lib/apiTypes";
import { createAdminExpenseMasterCategory, createAdminExpenseMasterItem, deleteAdminExpenseMasterCategory, deleteAdminExpenseMasterItem, getAdminExpenseMasterData, updateAdminExpenseMasterCategory, updateAdminExpenseMasterItem } from "@/lib/apiClient";

const UNIT_OPTIONS = ["adet", "m²", "m³", "ton", "kg", "metre", "gün", "saat", "hizmet", "götürü"];

export default function AdminExpenseMasterData() {
  const [categories, setCategories] = useState<ExpenseCategoryMasterRecord[]>([]);
  const [items, setItems] = useState<ExpenseItemMasterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("categories");
  const [categorySearch, setCategorySearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [itemStatusFilter, setItemStatusFilter] = useState("all");
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategoryMasterRecord | null>(null);
  const [editingItem, setEditingItem] = useState<ExpenseItemMasterRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "category" | "item"; record: ExpenseCategoryMasterRecord | ExpenseItemMasterRecord } | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "", is_active: true, sort_order: 0 });
  const [itemForm, setItemForm] = useState({ name: "", category_id: "", description: "", default_unit: "", default_vat_rate: "", is_active: true });
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getAdminExpenseMasterData();
      setCategories(data.categories || []);
      setItems(data.items || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lütfen tekrar deneyin.";
      setLoadError(message);
      toast({ title: "Master veri yüklenemedi", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCategoryCreate() {
    setEditingCategory(null);
    setCategoryForm({ name: "", description: "", is_active: true, sort_order: 0 });
    setCategoryModalOpen(true);
  }

  function openCategoryEdit(category: ExpenseCategoryMasterRecord) {
    setEditingCategory(category);
    setCategoryForm({ name: category.name, description: category.description || "", is_active: Number(category.is_active) === 1, sort_order: Number(category.sort_order || 0) });
    setCategoryModalOpen(true);
  }

  async function saveCategory() {
    if (!categoryForm.name.trim()) {
      toast({ title: "Kategori adı zorunludur", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editingCategory) {
        await updateAdminExpenseMasterCategory({ id: editingCategory.id, name: categoryForm.name.trim(), description: categoryForm.description.trim(), is_active: categoryForm.is_active ? 1 : 0, sort_order: categoryForm.sort_order });
        toast({ title: "Kategori güncellendi" });
      } else {
        await createAdminExpenseMasterCategory({ name: categoryForm.name.trim(), description: categoryForm.description.trim(), is_active: categoryForm.is_active ? 1 : 0, sort_order: categoryForm.sort_order });
        toast({ title: "Kategori oluşturuldu" });
      }
      setCategoryModalOpen(false);
      await load();
    } catch (error) {
      toast({ title: "Kategori kaydedilemedi", description: error instanceof Error ? error.message : "Lütfen tekrar deneyin.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleCategory(category: ExpenseCategoryMasterRecord) {
    try {
      await updateAdminExpenseMasterCategory({ id: category.id, name: category.name, description: category.description || "", is_active: Number(category.is_active) === 1 ? 0 : 1, sort_order: Number(category.sort_order || 0) });
      toast({ title: Number(category.is_active) === 1 ? "Kategori pasifleştirildi" : "Kategori aktifleştirildi" });
      await load();
    } catch (error) {
      toast({ title: "Kategori durumu güncellenemedi", description: error instanceof Error ? error.message : "Lütfen tekrar deneyin.", variant: "destructive" });
    }
  }

  async function removeCategory(category: ExpenseCategoryMasterRecord) {
    setDeleteTarget({ kind: "category", record: category });
  }

  function openItemCreate() {
    setEditingItem(null);
    setItemForm({ name: "", category_id: categoryFilter === "all" ? categories[0]?.id || "" : categoryFilter, description: "", default_unit: "", default_vat_rate: "", is_active: true });
    setItemModalOpen(true);
  }

  function openItemEdit(item: ExpenseItemMasterRecord) {
    setEditingItem(item);
    setItemForm({ name: item.name, category_id: item.category_id || "", description: item.description || "", default_unit: item.default_unit || "", default_vat_rate: item.default_vat_rate ? String(item.default_vat_rate) : "", is_active: Number(item.is_active) === 1 });
    setItemModalOpen(true);
  }

  async function saveItem() {
    if (!itemForm.name.trim() || !itemForm.category_id) {
      toast({ title: "Masraf kalemi adı ve kategori zorunludur", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editingItem) {
        await updateAdminExpenseMasterItem({ id: editingItem.id, name: itemForm.name.trim(), category_id: itemForm.category_id, description: itemForm.description.trim(), default_unit: itemForm.default_unit.trim(), default_vat_rate: itemForm.default_vat_rate ? Number(itemForm.default_vat_rate) : null, is_active: itemForm.is_active ? 1 : 0 });
        toast({ title: "Masraf kalemi güncellendi" });
      } else {
        await createAdminExpenseMasterItem({ name: itemForm.name.trim(), category_id: itemForm.category_id, description: itemForm.description.trim(), default_unit: itemForm.default_unit.trim(), default_vat_rate: itemForm.default_vat_rate ? Number(itemForm.default_vat_rate) : null, is_active: itemForm.is_active ? 1 : 0 });
        toast({ title: "Masraf kalemi oluşturuldu" });
      }
      setItemModalOpen(false);
      await load();
    } catch (error) {
      toast({ title: "Masraf kalemi kaydedilemedi", description: error instanceof Error ? error.message : "Lütfen tekrar deneyin.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleItem(item: ExpenseItemMasterRecord) {
    try {
      await updateAdminExpenseMasterItem({ id: item.id, name: item.name, category_id: item.category_id || "", description: item.description || "", default_unit: item.default_unit || "", default_vat_rate: item.default_vat_rate ? Number(item.default_vat_rate) : null, is_active: Number(item.is_active) === 1 ? 0 : 1 });
      toast({ title: Number(item.is_active) === 1 ? "Masraf kalemi pasifleştirildi" : "Masraf kalemi aktifleştirildi" });
      await load();
    } catch (error) {
      toast({ title: "Masraf kalemi durumu güncellenemedi", description: error instanceof Error ? error.message : "Lütfen tekrar deneyin.", variant: "destructive" });
    }
  }

  async function removeItem(item: ExpenseItemMasterRecord) {
    setDeleteTarget({ kind: "item", record: item });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.kind === "category") {
        await deleteAdminExpenseMasterCategory(deleteTarget.record.id);
        toast({ title: "Kategori silindi" });
      } else {
        await deleteAdminExpenseMasterItem(deleteTarget.record.id);
        toast({ title: "Masraf kalemi silindi" });
      }
      setDeleteTarget(null);
      await load();
    } catch (error) {
      const title = deleteTarget.kind === "category" ? "Kategori silinemedi" : "Masraf kalemi silinemedi";
      toast({ title, description: error instanceof Error ? error.message : "Lütfen tekrar deneyin.", variant: "destructive" });
    }
  }

  const filteredCategories = useMemo(() => categories.filter((category) => {
    if (categorySearch && !category.name.toLocaleLowerCase("tr-TR").includes(categorySearch.toLocaleLowerCase("tr-TR"))) return false;
    return true;
  }), [categories, categorySearch]);

  const filteredItems = useMemo(() => items.filter((item) => {
    if (itemSearch && !item.name.toLocaleLowerCase("tr-TR").includes(itemSearch.toLocaleLowerCase("tr-TR"))) return false;
    if (categoryFilter !== "all" && item.category_id !== categoryFilter) return false;
    if (itemStatusFilter === "active" && Number(item.is_active) !== 1) return false;
    if (itemStatusFilter === "passive" && Number(item.is_active) === 1) return false;
    return true;
  }), [items, itemSearch, categoryFilter, itemStatusFilter]);

  return (
    <div>
      <AdminPageHeader
        eyebrow="Tedarik ve Gider"
        title="Masraf Kalemleri"
        description="Kategoriler ve tekrarlanabilir masraf kalemlerini merkezi olarak yönetin."
        actions={<Button onClick={activeTab === "categories" ? openCategoryCreate : openItemCreate} className="bg-accent hover:bg-accent-glow text-accent-foreground"><Plus className="mr-1 h-4 w-4" /> {activeTab === "categories" ? "Yeni Kategori" : "Yeni Masraf Kalemi"}</Button>}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="categories">Kategoriler</TabsTrigger>
          <TabsTrigger value="items">Masraf Kalemleri</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} placeholder="Kategori ara..." className="pl-9" />
            </div>
          </div>

          {loading ? <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">Yükleniyor...</div> : loadError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
              <div className="font-medium">Master veriler yüklenemedi.</div>
              <div className="mt-1">{loadError}</div>
              <Button className="mt-4" onClick={() => load()}>Yeniden Dene</Button>
            </div>
          ) : filteredCategories.length === 0 ? (
            <AdminEmptyState title="Henüz kategori yok" description="İlk kategoriyi oluşturarak masraf master verisini kurmaya başlayın." icon={Tags} action={<Button onClick={openCategoryCreate}>Yeni Kategori</Button>} />
          ) : (
            <div className="space-y-3">
              {filteredCategories.map((category) => (
                <div key={category.id} className="rounded-md border border-border bg-card p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-semibold">{category.name}</div>
                      {category.description ? <div className="mt-1 text-sm text-muted-foreground">{category.description}</div> : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{Number(category.is_active) === 1 ? "Aktif" : "Pasif"}</span>
                        <span>•</span>
                        <span>Sıralama: {Number(category.sort_order || 0)}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => toggleCategory(category)}>{Number(category.is_active) === 1 ? <ToggleLeft className="mr-1 h-4 w-4" /> : <ToggleRight className="mr-1 h-4 w-4" />} {Number(category.is_active) === 1 ? "Pasifleştir" : "Aktifleştir"}</Button>
                      <Button size="sm" variant="outline" onClick={() => openCategoryEdit(category)}><Edit className="mr-1 h-4 w-4" /> Düzenle</Button>
                      <Button size="sm" variant="ghost" onClick={() => removeCategory(category)}><Trash2 className="mr-1 h-4 w-4 text-destructive" /> Sil</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="items" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_180px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={itemSearch} onChange={(event) => setItemSearch(event.target.value)} placeholder="Masraf kalemi ara..." className="pl-9" />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger><SelectValue placeholder="Kategori filtre" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Kategoriler</SelectItem>
                {categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={itemStatusFilter} onValueChange={setItemStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Durum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="passive">Pasif</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {loading ? <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">Yükleniyor...</div> : loadError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
              <div className="font-medium">Master veriler yüklenemedi.</div>
              <div className="mt-1">{loadError}</div>
              <Button className="mt-4" onClick={() => load()}>Yeniden Dene</Button>
            </div>
          ) : filteredItems.length === 0 ? (
            <AdminEmptyState title="Henüz masraf kalemi yok" description="İlk masraf kalemini oluşturarak standart gider katalogunu kurmaya başlayın." icon={Layers3} action={<Button onClick={openItemCreate}>Yeni Masraf Kalemi</Button>} />
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <div key={item.id} className="rounded-md border border-border bg-card p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-semibold">{item.name}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{item.category_name || "Kategori yok"}</div>
                      {item.description ? <div className="mt-1 text-sm text-muted-foreground">{item.description}</div> : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{Number(item.is_active) === 1 ? "Aktif" : "Pasif"}</span>
                        {item.default_unit ? <><span>•</span><span>Birim: {item.default_unit}</span></> : null}
                        {item.default_vat_rate !== null && item.default_vat_rate !== undefined ? <><span>•</span><span>KDV: %{item.default_vat_rate}</span></> : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => toggleItem(item)}>{Number(item.is_active) === 1 ? <ToggleLeft className="mr-1 h-4 w-4" /> : <ToggleRight className="mr-1 h-4 w-4" />} {Number(item.is_active) === 1 ? "Pasifleştir" : "Aktifleştir"}</Button>
                      <Button size="sm" variant="outline" onClick={() => openItemEdit(item)}><Edit className="mr-1 h-4 w-4" /> Düzenle</Button>
                      <Button size="sm" variant="ghost" onClick={() => removeItem(item)}><Trash2 className="mr-1 h-4 w-4 text-destructive" /> Sil</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingCategory ? "Kategori Düzenle" : "Yeni Kategori"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Ad *</Label>
              <Input value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div>
              <Label>Açıklama</Label>
              <Textarea value={categoryForm.description} onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))} rows={3} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Durum</Label>
                <Select value={categoryForm.is_active ? "active" : "passive"} onValueChange={(value) => setCategoryForm((current) => ({ ...current, is_active: value === "active" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktif</SelectItem>
                    <SelectItem value="passive">Pasif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sıralama</Label>
                <Input type="number" value={categoryForm.sort_order} onChange={(event) => setCategoryForm((current) => ({ ...current, sort_order: Number(event.target.value || 0) }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryModalOpen(false)}>İptal</Button>
            <Button onClick={saveCategory} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{editingCategory ? "Güncelle" : "Oluştur"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{deleteTarget?.kind === "category" ? "Kategoriyi sil" : "Masraf kalemini sil"}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>{deleteTarget?.kind === "category" ? "Bu kategoriyi silmek istediğinize emin misiniz?" : "Bu masraf kalemini silmek istediğinize emin misiniz?"}</p>
            {deleteTarget ? <div className="rounded-md border border-border bg-muted/40 p-3 text-foreground">{deleteTarget.record.name}</div> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>İptal</Button>
            <Button variant="destructive" onClick={confirmDelete}>Sil</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={itemModalOpen} onOpenChange={setItemModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingItem ? "Masraf Kalemi Düzenle" : "Yeni Masraf Kalemi"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Masraf Kalemi Adı *</Label>
              <Input value={itemForm.name} onChange={(event) => setItemForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div>
              <Label>Kategori *</Label>
              <Select value={itemForm.category_id} onValueChange={(value) => setItemForm((current) => ({ ...current, category_id: value }))}>
                <SelectTrigger><SelectValue placeholder="Kategori seçin" /></SelectTrigger>
                <SelectContent>
                  {categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Açıklama</Label>
              <Textarea value={itemForm.description} onChange={(event) => setItemForm((current) => ({ ...current, description: event.target.value }))} rows={3} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Varsayılan Birim</Label>
                <Select value={itemForm.default_unit} onValueChange={(value) => setItemForm((current) => ({ ...current, default_unit: value }))}>
                  <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>{UNIT_OPTIONS.map((unit) => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Varsayılan KDV Oranı</Label>
                <Input type="number" step="0.01" value={itemForm.default_vat_rate} onChange={(event) => setItemForm((current) => ({ ...current, default_vat_rate: event.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Durum</Label>
              <Select value={itemForm.is_active ? "active" : "passive"} onValueChange={(value) => setItemForm((current) => ({ ...current, is_active: value === "active" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="passive">Pasif</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemModalOpen(false)}>İptal</Button>
            <Button onClick={saveItem} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{editingItem ? "Güncelle" : "Oluştur"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
