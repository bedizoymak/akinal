import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { displayLabel } from "@/lib/finance";
import { PROJECT_STATUSES, PROJECT_TYPES, turkishSlugify, resolveImageUrl } from "@/lib/projects";
import { districtsForProvince, TURKEY_PROVINCES } from "@/lib/turkeyLocations";
import { ArrowLeft, Upload, Trash2, Star, GripVertical, ExternalLink, Check, ChevronsUpDown } from "lucide-react";
import ImageCropDialog from "@/components/admin/ImageCropDialog";
import { AdminPageHeader } from "@/components/admin/AdminPage";
import { ProjectEmployeeCostPanel } from "@/components/admin/projects/ProjectEmployeeCostPanel";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  createAdminProject,
  createAdminProjectImage,
  deleteAdminProjectImage,
  getAdminProject,
  getAdminProjectImages,
  updateAdminProject,
  updateAdminProjectImage,
  uploadAdminProjectImage,
} from "@/lib/apiClient";

const empty = {
  title: "", slug: "", short_description: "", detailed_description: "",
  project_type: "", project_status: "", location: "", city: "", district: "",
  start_year: "", delivery_year: "", land_area: "", construction_area: "",
  apartment_count: "", floor_count: "", block_count: "",
  cover_image_url: "", is_featured: false, is_published: false, sort_order: 0,
  seo_title: "", seo_description: "",
  contract_total_try: null as number | null,
};

function SearchableLocationSelect({
  value,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled,
  onChange,
}: {
  value: string;
  options: string[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                >
                  <Check className={`mr-2 h-4 w-4 ${value === option ? "opacity-100" : "opacity-0"}`} />
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ImgTile({ img, onDelete, onSetCover, isCover }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: img.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }} className="relative group rounded-md overflow-hidden border border-border bg-muted aspect-[4/3]">
      <img src={resolveImageUrl(img.image_url)} alt="" className="h-full w-full object-cover" />
      {isCover && <div className="absolute top-2 left-2 bg-accent text-accent-foreground text-[10px] font-bold px-2 py-1 rounded">ANA GÖRSEL</div>}
      <button {...attributes} {...listeners} className="absolute top-2 right-2 h-7 w-7 rounded bg-background/90 flex items-center justify-center cursor-grab"><GripVertical className="h-4 w-4" /></button>
      <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="sm" variant="secondary" className="h-7 text-xs flex-1" onClick={onSetCover}><Star className="h-3 w-3 mr-1" /> Ana Yap</Button>
        <Button size="sm" variant="destructive" className="h-7 w-7 p-0" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button>
      </div>
    </div>
  );
}

// Pure validation (P2-1): an image-less/description-less DRAFT is valid; the
// same project is rejected only when wantsPublished is true. Exported for
// direct unit testing of the draft-vs-publish contract without mounting the
// full form.
export function validateProjectSaveFields(
  data: { cover_image_url?: string | null; short_description?: string | null },
  wantsPublished: boolean
): string | null {
  if (wantsPublished && !data.cover_image_url) return "Yayınlamak için ana görsel yüklenmelidir.";
  if (wantsPublished && !(data.short_description || "").trim()) return "Yayınlamak için kısa açıklama zorunludur.";
  return null;
}

export default function AdminProjectEdit() {
  const { id } = useParams();
  const isNew = id === "yeni" || !id;
  const nav = useNavigate();
  const { toast } = useToast();
  const [data, setData] = useState<any>(empty);
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<"cover" | "gallery">("gallery");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (isNew) return;
    (async () => {
      try {
        const p = await getAdminProject(id);
        if (!p) {
          setLoadError("Proje kaydı bulunamadı.");
          return;
        }
        setData(p);
        const imgs = await getAdminProjectImages(id);
        setImages(imgs || []);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Proje bilgileri alınamadı.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isNew]);

  function update(k: string, v: any) {
    setData((d: any) => ({ ...d, [k]: v }));
    if (k === "title" && !slugTouched && isNew) setData((d: any) => ({ ...d, slug: turkishSlugify(v) }));
  }

  function generatedLocation(city: string, district: string) {
    return [district, city].filter(Boolean).join(", ");
  }

  function applyLocation(city: string, district: string) {
    const nextLocation = generatedLocation(city, district);
    setData((current: any) => {
      return {
        ...current,
        city,
        district,
        location: nextLocation || current.location,
      };
    });
  }

  function updateCity(city: string) {
    const allowedDistricts = districtsForProvince(city);
    const nextDistrict = allowedDistricts.includes(data.district) ? data.district : "";
    applyLocation(city, nextDistrict);
  }

  function updateDistrict(district: string) {
    applyLocation(data.city || "", district);
  }

  async function uploadBlob(blob: Blob, name: string): Promise<string> {
    return uploadAdminProjectImage(blob, name);
  }

  function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    // For multiple files: upload directly without crop. For single file: open crop dialog.
    if (arr.length === 1) {
      const file = arr[0];
      const reader = new FileReader();
      reader.onload = () => {
        setPendingFile(file);
        setCropTarget("gallery");
        setCropSrc(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      (async () => {
        for (const f of arr) {
          try {
            const url = await uploadBlob(f, f.name);
            await addImageRecord(url);
          } catch {
            toast({ title: "Görseller yüklenemedi", description: "Görsel yüklenirken bir problem oluştu. Lütfen dosyayı kontrol edip tekrar deneyin.", variant: "destructive" });
          }
        }
        toast({ title: "Görseller yüklendi" });
        if (!isNew) reloadImages();
      })();
    }
  }

  async function addImageRecord(url: string) {
    if (isNew) {
      // Stage in local images list keyed by random id; will save after project create
      setImages((arr) => [...arr, { id: `tmp-${Date.now()}-${Math.random()}`, image_url: url, sort_order: arr.length, _new: true }]);
      if (!data.cover_image_url) setData((d: any) => ({ ...d, cover_image_url: url }));
    } else {
      const row = await createAdminProjectImage({ project_id: id, image_url: url, sort_order: images.length });
      setImages((arr) => [...arr, row]);
      if (!data.cover_image_url) {
        await updateAdminProject({ id, cover_image_url: url });
        setData((d: any) => ({ ...d, cover_image_url: url }));
      }
    }
  }

  async function reloadImages() {
    const imgs = await getAdminProjectImages(id);
    setImages(imgs || []);
  }

  async function onCropSave(blob: Blob) {
    try {
      const url = await uploadBlob(blob, pendingFile?.name || "image.jpg");
      if (cropTarget === "cover") {
        update("cover_image_url", url);
      } else {
        await addImageRecord(url);
      }
      toast({ title: "Görsel kaydedildi" });
    } catch {
      toast({ title: "Görsel kaydedilemedi", description: "Görsel düzenlenirken bir problem oluştu. Lütfen tekrar deneyin.", variant: "destructive" });
    }
    setPendingFile(null);
    setCropSrc(null);
  }

  async function deleteImage(img: any) {
    if (img._new) {
      setImages((a) => a.filter((i) => i.id !== img.id));
      return;
    }
    await deleteAdminProjectImage(img.id);
    setImages((a) => a.filter((i) => i.id !== img.id));
    toast({ title: "Görsel silindi" });
  }

  async function setCover(img: any) {
    update("cover_image_url", img.image_url);
    if (!isNew) {
      await updateAdminProject({ id, cover_image_url: img.image_url });
    }
    toast({ title: "Ana görsel güncellendi" });
  }

  async function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const oldI = images.findIndex((i) => i.id === e.active.id);
    const newI = images.findIndex((i) => i.id === e.over!.id);
    const reordered = arrayMove(images, oldI, newI);
    setImages(reordered);
    if (!isNew) {
      await Promise.all(reordered.map((it, idx) => updateAdminProjectImage({ id: it.id, sort_order: idx })));
    }
  }

  async function save(publish?: boolean) {
    const location = generatedLocation(data.city || "", data.district || "") || String(data.location || "").trim();
    if (!data.title.trim()) { toast({ title: "Hata", description: "Proje adı zorunludur.", variant: "destructive" }); return; }
    if (!data.project_type) { toast({ title: "Hata", description: "Lütfen bir proje türü seçin.", variant: "destructive" }); return; }
    if (!data.project_status) { toast({ title: "Hata", description: "Lütfen bir proje durumu seçin.", variant: "destructive" }); return; }
    if (!location) { toast({ title: "Hata", description: "İl veya ilçe seçimi zorunludur.", variant: "destructive" }); return; }
    const districtOptions = districtsForProvince(data.city);
    if (data.city && districtOptions.length && data.district && !districtOptions.includes(data.district)) {
      toast({ title: "Hata", description: "Seçilen ilçe, seçilen ile ait değil.", variant: "destructive" });
      return;
    }
    // Image and short description are required to PUBLISH, but a draft may be
    // saved without them — the form no longer accepts-then-silently-enforces
    // fields it doesn't visually mark as required for a draft save (P2-1).
    const wantsPublished = publish ?? data.is_published;
    const publishError = validateProjectSaveFields(data, wantsPublished);
    if (publishError) { toast({ title: "Hata", description: publishError, variant: "destructive" }); return; }

    const slug = (data.slug || turkishSlugify(data.title)).trim();
    const payload = { ...data, slug, location, is_published: publish ?? data.is_published };

    setSaving(true);
    try {
      if (isNew) {
        const created = await createAdminProject(payload);
        // Save staged images
        const newImgs = images.filter((i) => i._new);
        if (newImgs.length > 0) {
          await Promise.all(newImgs.map((i, idx) => createAdminProjectImage({ project_id: created.id, image_url: i.image_url, sort_order: idx })));
        }
        toast({ title: "Proje oluşturuldu" });
        nav(`/admin/projeler/${created.id}`);
      } else {
        await updateAdminProject({ ...payload, id });
        toast({ title: "Kaydedildi" });
        setData(payload);
      }
    } catch {
      toast({ title: "Proje kaydedilemedi", description: "Proje bilgileri kaydedilirken bir problem oluştu. Lütfen alanları kontrol edip tekrar deneyin.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-center text-muted-foreground py-12">Yükleniyor...</div>;
  if (loadError) return <div className="rounded-md border border-border bg-card py-12 text-center text-sm text-muted-foreground">{loadError}</div>;

  const projectStatusOptions = data.project_status && !PROJECT_STATUSES.includes(data.project_status)
    ? [data.project_status, ...PROJECT_STATUSES]
    : PROJECT_STATUSES;
  const districtOptions = districtsForProvince(data.city);
  const cityOptions = data.city && !TURKEY_PROVINCES.includes(data.city)
    ? [data.city, ...TURKEY_PROVINCES]
    : [...TURKEY_PROVINCES];
  const availableDistrictOptions = data.district && data.city && districtOptions.length && !districtOptions.includes(data.district)
    ? [data.district, ...districtOptions]
    : districtOptions;
  const locationPreview = generatedLocation(data.city || "", data.district || "") || data.location || "";

  return (
    <div className="max-w-5xl">
      <AdminPageHeader
        eyebrow="Proje Yönetimi"
        title={isNew ? "Yeni Proje" : "Proje Düzenle"}
        description="Projenin yayın bilgilerini, konumunu, teknik detaylarını, görsellerini ve SEO alanlarını yönetin."
        actions={
          <>
          <Button asChild variant="outline" size="sm"><Link to="/admin/projeler"><ArrowLeft className="h-4 w-4" /> Projelere Dön</Link></Button>
          {!isNew && <Button asChild variant="outline" size="sm"><Link to={`/admin/projeler/${id}/onizleme`} target="_blank"><ExternalLink className="h-4 w-4 mr-1" /> Önizle</Link></Button>}
          <Button variant="outline" onClick={() => save(false)} disabled={saving}>Taslak Olarak Kaydet</Button>
          <Button onClick={() => save(true)} disabled={saving} className="bg-accent hover:bg-accent-glow text-accent-foreground">{saving ? "Kaydediliyor..." : "Yayınla"}</Button>
          </>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="p-6 bg-card border border-border rounded-md space-y-4">
            <h2 className="font-display text-lg font-bold">Temel Bilgiler</h2>
            <div><Label>Proje Adı *</Label><Input value={data.title} onChange={(e) => update("title", e.target.value)} /></div>
            <div><Label>URL Adresi (slug)</Label><Input value={data.slug} onChange={(e) => { setSlugTouched(true); update("slug", turkishSlugify(e.target.value)); }} placeholder="ornek-proje-adi" /></div>
            <div><Label>Kısa Açıklama * <span className="font-normal text-xs text-muted-foreground">(yayınlamak için zorunlu)</span></Label><Textarea value={data.short_description} onChange={(e) => update("short_description", e.target.value)} rows={3} /></div>
            <div><Label>Detaylı Açıklama</Label><Textarea value={data.detailed_description || ""} onChange={(e) => update("detailed_description", e.target.value)} rows={8} /></div>
          </section>

          <section className="p-6 bg-card border border-border rounded-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold">Galeri Görselleri * <span className="font-normal text-xs text-muted-foreground">(ilk görsel ana görsel olur — yayınlamak için zorunlu)</span></h2>
              <div className="flex gap-2">
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-1" /> Görsel Yükle</Button>
              </div>
            </div>
            {images.length === 0 ? (
              <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-border rounded-md p-12 text-center cursor-pointer hover:border-accent transition-colors">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <div className="text-sm text-muted-foreground">Görselleri buraya sürükleyin veya tıklayın</div>
                <div className="text-xs text-muted-foreground mt-1">Tek görselde otomatik kırpma açılır. Birden fazla görsel doğrudan yüklenir.</div>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={images.map((i) => i.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {images.map((img) => (
                      <ImgTile key={img.id} img={img} isCover={img.image_url === data.cover_image_url} onSetCover={() => setCover(img)} onDelete={() => deleteImage(img)} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </section>

          <section className="p-6 bg-card border border-border rounded-md space-y-4">
            <h2 className="font-display text-lg font-bold">SEO</h2>
            <div><Label>SEO Başlığı</Label><Input value={data.seo_title || ""} onChange={(e) => update("seo_title", e.target.value)} /></div>
            <div><Label>SEO Açıklaması</Label><Textarea value={data.seo_description || ""} onChange={(e) => update("seo_description", e.target.value)} rows={3} /></div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="p-6 bg-card border border-border rounded-md space-y-4">
            <h2 className="font-display text-lg font-bold">Yayın</h2>
            <div className="flex items-center justify-between"><Label>Yayında</Label><Switch checked={data.is_published} onCheckedChange={(v) => update("is_published", v)} /></div>
            <div className="flex items-center justify-between"><Label>Öne Çıkan</Label><Switch checked={data.is_featured} onCheckedChange={(v) => update("is_featured", v)} /></div>
            <div><Label>Sıralama</Label><Input type="number" value={data.sort_order || 0} onChange={(e) => update("sort_order", Number(e.target.value))} /></div>
          </section>

          <section className="p-6 bg-card border border-border rounded-md space-y-4">
            <h2 className="font-display text-lg font-bold">Finansal</h2>
            <div>
              <Label>Sözleşme Toplam Bedeli</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={data.contract_total_try != null ? String(data.contract_total_try) : ""}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  if (v === "") { update("contract_total_try", null); return; }
                  const n = parseFloat(v);
                  update("contract_total_try", isNaN(n) ? null : n);
                }}
                placeholder="örn. 12500000"
              />
              <p className="mt-1 text-xs text-muted-foreground">TL cinsinden. Boş bırakılabilir.</p>
            </div>
          </section>

          <section className="p-6 bg-card border border-border rounded-md space-y-4">
            <h2 className="font-display text-lg font-bold">Sınıflandırma</h2>
            <div><Label>Proje Türü *</Label>
              <Select value={data.project_type} onValueChange={(v) => update("project_type", v)}><SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger><SelectContent>{PROJECT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><Label>Proje Durumu *</Label>
              <Select value={data.project_status} onValueChange={(v) => update("project_status", v)}><SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger><SelectContent>{projectStatusOptions.map((t) => <SelectItem key={t} value={t}>{displayLabel(t)}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>İl</Label>
                <SearchableLocationSelect
                  value={data.city || ""}
                  options={cityOptions}
                  placeholder="İl seçin"
                  searchPlaceholder="İl ara..."
                  emptyText="İl bulunamadı."
                  onChange={updateCity}
                />
              </div>
              <div>
                <Label>İlçe</Label>
                {data.city && districtOptions.length === 0 ? (
                  <Input value={data.district || ""} onChange={(e) => updateDistrict(e.target.value)} placeholder="İlçe yazın" />
                ) : (
                  <SearchableLocationSelect
                    value={data.district || ""}
                    options={availableDistrictOptions}
                    placeholder={data.city ? "İlçe seçin" : "Önce il seçin"}
                    searchPlaceholder="İlçe ara..."
                    emptyText={data.city ? "Bu il için ilçe bulunamadı." : "Önce il seçin."}
                    disabled={!data.city || availableDistrictOptions.length === 0}
                    onChange={updateDistrict}
                  />
                )}
              </div>
            </div>
            <div>
              <Label>Konum</Label>
              <Input value={locationPreview} readOnly className="bg-muted" placeholder="İl / ilçe seçimine göre otomatik oluşur" />
            </div>
            <p className="text-xs text-muted-foreground">Konum, ilçe ve il seçiminden otomatik oluşturulur. Eski projelerde il/ilçe yoksa kayıtlı konum korunur.</p>
          </section>

          {!isNew && id && (
            <section className="p-6 bg-card border border-border rounded-md">
              <ProjectEmployeeCostPanel projectId={id} />
            </section>
          )}

          <section className="p-6 bg-card border border-border rounded-md space-y-3">
            <h2 className="font-display text-lg font-bold">Teknik Bilgiler</h2>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Başlangıç Yılı</Label><Input value={data.start_year || ""} onChange={(e) => update("start_year", e.target.value)} /></div>
              <div><Label>Teslim Yılı</Label><Input value={data.delivery_year || ""} onChange={(e) => update("delivery_year", e.target.value)} /></div>
              <div><Label>Arsa Alanı</Label><Input value={data.land_area || ""} onChange={(e) => update("land_area", e.target.value)} /></div>
              <div><Label>İnşaat Alanı</Label><Input value={data.construction_area || ""} onChange={(e) => update("construction_area", e.target.value)} /></div>
              <div><Label>Daire Sayısı</Label><Input value={data.apartment_count || ""} onChange={(e) => update("apartment_count", e.target.value)} /></div>
              <div><Label>Kat Sayısı</Label><Input value={data.floor_count || ""} onChange={(e) => update("floor_count", e.target.value)} /></div>
              <div><Label>Blok Sayısı</Label><Input value={data.block_count || ""} onChange={(e) => update("block_count", e.target.value)} /></div>
            </div>
          </section>
        </aside>
      </div>

      {cropSrc && (
        <ImageCropDialog open={!!cropSrc} onOpenChange={(o) => !o && (setCropSrc(null), setPendingFile(null))} src={cropSrc} onSave={onCropSave} />
      )}
    </div>
  );
}
