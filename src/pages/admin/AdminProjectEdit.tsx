import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { displayLabel } from "@/lib/finance";
import { PROJECT_STATUSES, PROJECT_TYPES, turkishSlugify, resolveImageUrl } from "@/lib/projects";
import { ArrowLeft, Upload, Trash2, Star, Crop, GripVertical, ExternalLink } from "lucide-react";
import ImageCropDialog from "@/components/admin/ImageCropDialog";
import { AdminPageHeader } from "@/components/admin/AdminPage";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const empty = {
  title: "", slug: "", short_description: "", detailed_description: "",
  project_type: "", project_status: "", location: "", city: "", district: "",
  start_year: "", delivery_year: "", land_area: "", construction_area: "",
  apartment_count: "", floor_count: "", block_count: "",
  cover_image_url: "", is_featured: false, is_published: false, sort_order: 0,
  seo_title: "", seo_description: "",
};

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

export default function AdminProjectEdit() {
  const { id } = useParams();
  const isNew = id === "yeni" || !id;
  const nav = useNavigate();
  const { toast } = useToast();
  const [data, setData] = useState<any>(empty);
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(!isNew);
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
      const { data: p } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
      if (p) setData(p);
      const { data: imgs } = await supabase.from("project_images").select("*").eq("project_id", id).order("sort_order");
      setImages(imgs || []);
      setLoading(false);
    })();
  }, [id, isNew]);

  function update(k: string, v: any) {
    setData((d: any) => ({ ...d, [k]: v }));
    if (k === "title" && !slugTouched && isNew) setData((d: any) => ({ ...d, slug: turkishSlugify(v) }));
  }

  async function uploadBlob(blob: Blob, name: string): Promise<string> {
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${name}`;
    const { error } = await supabase.storage.from("project-images").upload(path, blob, { contentType: blob.type || "image/jpeg" });
    if (error) throw error;
    return supabase.storage.from("project-images").getPublicUrl(path).data.publicUrl;
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
      const { data: row } = await supabase.from("project_images").insert({ project_id: id, image_url: url, sort_order: images.length }).select().single();
      if (row) setImages((arr) => [...arr, row]);
      if (!data.cover_image_url) {
        await supabase.from("projects").update({ cover_image_url: url }).eq("id", id);
        setData((d: any) => ({ ...d, cover_image_url: url }));
      }
    }
  }

  async function reloadImages() {
    const { data: imgs } = await supabase.from("project_images").select("*").eq("project_id", id).order("sort_order");
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
    await supabase.from("project_images").delete().eq("id", img.id);
    setImages((a) => a.filter((i) => i.id !== img.id));
    toast({ title: "Görsel silindi" });
  }

  async function setCover(img: any) {
    update("cover_image_url", img.image_url);
    if (!isNew) {
      await supabase.from("projects").update({ cover_image_url: img.image_url }).eq("id", id);
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
      await Promise.all(reordered.map((it, idx) => supabase.from("project_images").update({ sort_order: idx }).eq("id", it.id)));
    }
  }

  async function save(publish?: boolean) {
    if (!data.title.trim()) { toast({ title: "Hata", description: "Proje adı zorunludur.", variant: "destructive" }); return; }
    if (!data.project_type) { toast({ title: "Hata", description: "Lütfen bir proje türü seçin.", variant: "destructive" }); return; }
    if (!data.project_status) { toast({ title: "Hata", description: "Lütfen bir proje durumu seçin.", variant: "destructive" }); return; }
    if (!data.location.trim()) { toast({ title: "Hata", description: "Konum zorunludur.", variant: "destructive" }); return; }
    if (!data.cover_image_url) { toast({ title: "Hata", description: "Ana görsel yüklenmelidir.", variant: "destructive" }); return; }
    if (!data.short_description.trim()) { toast({ title: "Hata", description: "Kısa açıklama zorunludur.", variant: "destructive" }); return; }

    const slug = (data.slug || turkishSlugify(data.title)).trim();
    const payload = { ...data, slug, is_published: publish ?? data.is_published };

    setSaving(true);
    try {
      if (isNew) {
        const { data: created, error } = await supabase.from("projects").insert(payload).select().single();
        if (error) throw error;
        // Save staged images
        const newImgs = images.filter((i) => i._new);
        if (newImgs.length > 0) {
          await supabase.from("project_images").insert(newImgs.map((i, idx) => ({ project_id: created.id, image_url: i.image_url, sort_order: idx })));
        }
        toast({ title: "Proje oluşturuldu" });
        nav(`/admin/projeler/${created.id}`);
      } else {
        const { error } = await supabase.from("projects").update(payload).eq("id", id);
        if (error) throw error;
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

  const projectStatusOptions = data.project_status && !PROJECT_STATUSES.includes(data.project_status)
    ? [data.project_status, ...PROJECT_STATUSES]
    : PROJECT_STATUSES;

  return (
    <div className="max-w-5xl">
      <AdminPageHeader
        eyebrow="Proje Yönetimi"
        title={isNew ? "Yeni Proje" : "Proje Düzenle"}
        description="Projenin yayın bilgilerini, konumunu, teknik detaylarını, görsellerini ve SEO alanlarını yönetin."
        actions={
          <>
          <Button asChild variant="outline" size="sm"><Link to="/admin/projeler"><ArrowLeft className="h-4 w-4" /> Projelere Dön</Link></Button>
          {!isNew && data.slug && <Button asChild variant="outline" size="sm"><Link to={`/projelerimiz/${data.slug}`} target="_blank"><ExternalLink className="h-4 w-4 mr-1" /> Önizle</Link></Button>}
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
            <div><Label>Kısa Açıklama *</Label><Textarea value={data.short_description} onChange={(e) => update("short_description", e.target.value)} rows={3} /></div>
            <div><Label>Detaylı Açıklama</Label><Textarea value={data.detailed_description || ""} onChange={(e) => update("detailed_description", e.target.value)} rows={8} /></div>
          </section>

          <section className="p-6 bg-card border border-border rounded-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold">Galeri Görselleri</h2>
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
            <h2 className="font-display text-lg font-bold">Sınıflandırma</h2>
            <div><Label>Proje Türü *</Label>
              <Select value={data.project_type} onValueChange={(v) => update("project_type", v)}><SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger><SelectContent>{PROJECT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><Label>Proje Durumu *</Label>
              <Select value={data.project_status} onValueChange={(v) => update("project_status", v)}><SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger><SelectContent>{projectStatusOptions.map((t) => <SelectItem key={t} value={t}>{displayLabel(t)}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><Label>Konum *</Label><Input value={data.location} onChange={(e) => update("location", e.target.value)} placeholder="Örn: Kadıköy, İstanbul" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>İl</Label><Input value={data.city || ""} onChange={(e) => update("city", e.target.value)} /></div>
              <div><Label>İlçe</Label><Input value={data.district || ""} onChange={(e) => update("district", e.target.value)} /></div>
            </div>
          </section>

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
