import { type DragEvent, useEffect, useRef, useState } from "react";
import { Copy, Image as ImageIcon, Search, Trash2, UploadCloud } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminEmptyState, AdminPageHeader } from "@/components/admin/AdminPage";
import { useToast } from "@/hooks/use-toast";
import { deleteAdminMediaImage, deleteAdminMediaPath, getAdminMedia, type AdminMediaImage, uploadAdminMediaImage } from "@/lib/apiClient";
import { resolveImageUrl } from "@/lib/projects";
import { cn } from "@/lib/utils";

function sourceLabel(image: AdminMediaImage) {
  if (image.source_label) return image.source_label;
  if (image.source_type === "filesystem") return "Yükleme";
  if (image.source_type === "site_setting") return "Site ayarı";
  return "Proje";
}

function displayName(image: AdminMediaImage) {
  return image.file_name || image.title || image.alt_text || image.image_url.split("/").pop() || "Görsel";
}

export default function AdminMedia() {
  const [items, setItems] = useState<AdminMediaImage[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminMediaImage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    try {
      setItems(await getAdminMedia());
    } catch {
      toast({ title: "Medya yüklenemedi.", description: "Görseller alınırken bir problem oluştu.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = items.filter((image) => {
    if (!q) return true;
    const haystack = [
      image.title,
      image.alt_text,
      image.file_name,
      image.image_url,
      image.project_title,
      image.projects?.title,
      sourceLabel(image),
    ].filter(Boolean).join(" ").toLocaleLowerCase("tr-TR");
    return haystack.includes(q.toLocaleLowerCase("tr-TR"));
  });

  async function uploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
    if (!files.length) {
      toast({ title: "Görsel seçilmedi.", description: "JPG, PNG, WEBP veya GIF dosyası yükleyebilirsiniz.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      await Promise.all(files.map((file) => uploadAdminMediaImage(file)));
      toast({ title: files.length === 1 ? "Görsel yüklendi." : `${files.length} görsel yüklendi.` });
      await load();
    } catch {
      toast({ title: "Yükleme başarısız.", description: "Görsel yüklenirken bir problem oluştu.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (uploading) return;
    uploadFiles(event.dataTransfer.files);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.id) {
        await deleteAdminMediaImage(deleteTarget.id);
      } else {
        await deleteAdminMediaPath(deleteTarget.image_url);
      }
      toast({ title: "Görsel silindi." });
      setDeleteTarget(null);
      await load();
    } catch {
      toast({ title: "Silinemedi.", description: "Görsel silinirken bir problem oluştu.", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Proje Yönetimi"
        title="Medya"
        description="Projelerde kullanılan görselleri merkezi olarak inceleyin, URL kopyalayın veya gereksiz görselleri temizleyin."
        actions={
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="bg-accent text-accent-foreground hover:bg-accent-glow">
            <UploadCloud className="h-4 w-4" />
            {uploading ? "Yükleniyor..." : "Yeni Görsel Yükle"}
          </Button>
        }
      />

      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => event.target.files && uploadFiles(event.target.files)} />

      <div
        onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "rounded-md border border-dashed border-border bg-card p-5 transition-colors",
          isDragging && "border-accent bg-accent/5",
        )}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-accent/10 text-accent">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-base font-bold tracking-normal">Görselleri buraya sürükleyin</div>
              <p className="text-sm text-muted-foreground">JPG, PNG, WEBP veya GIF dosyaları `/uploads/project-images/` klasörüne yüklenir.</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            Dosya Seç
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Dosya, proje veya URL ara..." value={q} onChange={(event) => setQ(event.target.value)} />
        </div>
        <div className="text-sm text-muted-foreground">{filtered.length} / {items.length} görsel</div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Yükleniyor...</div>
      ) : filtered.length === 0 ? (
        <AdminEmptyState
          title="Görsel bulunamadı"
          description="Yeni bir görsel yükleyerek medya kütüphanesini oluşturmaya başlayabilirsiniz."
          icon={ImageIcon}
          action={<Button onClick={() => fileInputRef.current?.click()}><UploadCloud className="h-4 w-4" /> Yeni Görsel Yükle</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {filtered.map((image) => (
            <div key={image.id || image.image_url} className="overflow-hidden rounded-md border border-border bg-card shadow-card-soft">
              <div className="relative aspect-square bg-muted">
                <img src={resolveImageUrl(image.image_url)} alt={image.alt_text || image.title || ""} className="h-full w-full object-cover" loading="lazy" />
                <div className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-1 text-[11px] font-semibold text-white">
                  {sourceLabel(image)}
                </div>
              </div>
              <div className="space-y-3 p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold" title={displayName(image)}>{displayName(image)}</div>
                  <div className="mt-1 truncate text-xs text-muted-foreground" title={image.projects?.title || image.project_title || image.image_url}>
                    {image.projects?.title || image.project_title || image.image_url}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="min-w-0 flex-1" onClick={() => { navigator.clipboard.writeText(image.image_url); toast({ title: "URL kopyalandı" }); }}>
                    <Copy className="h-3.5 w-3.5" />
                    Kopyala
                  </Button>
                  {image.can_delete !== false && (
                    <Button size="sm" variant="destructive" className="h-9 w-9 p-0" onClick={() => setDeleteTarget(image)} title="Sil">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Görsel silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              Bu işlem seçili medya kaydını ve güvenli yükleme klasöründeyse dosyanın kendisini siler. İşlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
