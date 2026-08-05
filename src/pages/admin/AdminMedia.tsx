import { type DragEvent, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Copy,
  FolderOpen,
  Image as ImageIcon,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AdminEmptyState, AdminPageHeader } from "@/components/admin/AdminPage";
import MediaAlbumPopover from "@/components/admin/MediaAlbumPopover";
import { useToast } from "@/hooks/use-toast";
import {
  type AdminMediaImage,
  type MediaAlbum,
  createAdminMediaAlbum,
  deleteAdminMediaAlbum,
  deleteAdminMediaImage,
  deleteAdminMediaPath,
  getAdminMedia,
  getAdminMediaAlbums,
  updateAdminMediaAlbum,
  uploadAdminMediaImage,
} from "@/lib/apiClient";
import { resolveImageUrl } from "@/lib/projects";
import { cn } from "@/lib/utils";

// ─── helpers ───────────────────────────────────────────────────────────────

// P1-5: "in use" (is_protected) and "file actually exists" (file_missing)
// are orthogonal — a row can be referenced by a project/setting while its
// physical file is gone. isMissing combines the server-confirmed check
// (local uploads only) with a client-side fallback (brokenUrls, populated
// by the <img> onError handler) for anything the server couldn't verify —
// e.g. external URLs, or the SPA's index.html masquerading as the image.
export function isMediaImageMissing(image: Pick<AdminMediaImage, "file_missing" | "image_url">, brokenUrls: Set<string>): boolean {
  return image.file_missing === true || brokenUrls.has(image.image_url);
}

function sourceLabel(image: AdminMediaImage) {
  if (image.source_label) return image.source_label;
  if (image.source_type === "filesystem") return "Yüklenen Dosya";
  if (image.source_type === "site_setting") return "Site Ayarı";
  if (image.source_type === "project_cover") return "Proje Görseli";
  return "Proje Galerisi";
}

function displayName(image: AdminMediaImage) {
  return image.file_name || image.title || image.alt_text || image.image_url.split("/").pop() || "Görsel";
}

const PRESET_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];

// ─── sidebar ────────────────────────────────────────────────────────────────

type Filter = "all" | "favorites" | { albumId: string };

interface SidebarProps {
  albums: MediaAlbum[];
  filter: Filter;
  onFilterChange: (f: Filter) => void;
  totalCount: number;
  onAlbumsChanged: (albums: MediaAlbum[]) => void;
  onNewAlbum: () => void;
}

function AlbumSidebar({ albums, filter, onFilterChange, totalCount, onAlbumsChanged, onNewAlbum }: SidebarProps) {
  const { toast } = useToast();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<MediaAlbum | null>(null);

  const favAlbum = albums.find((a) => a.is_favorite);
  const userAlbums = albums.filter((a) => !a.is_favorite);

  const activeClass = "bg-accent/15 text-accent font-semibold";
  const rowClass = "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent/10 cursor-pointer text-left";

  async function commitRename(album: MediaAlbum) {
    const name = renameValue.trim();
    if (!name || name === album.name) { setRenamingId(null); return; }
    try {
      const updated = await updateAdminMediaAlbum(album.id, { name });
      onAlbumsChanged(albums.map((a) => a.id === album.id ? updated : a));
    } catch {
      toast({ title: "Yeniden adlandırılamadı.", variant: "destructive" });
    }
    setRenamingId(null);
  }

  async function handleDelete(album: MediaAlbum) {
    try {
      await deleteAdminMediaAlbum(album.id);
      const next = albums.filter((a) => a.id !== album.id);
      onAlbumsChanged(next);
      // If the deleted album was active, go back to all
      if (typeof filter === "object" && filter.albumId === album.id) {
        onFilterChange("all");
      }
      toast({ title: `"${album.name}" albümü silindi.` });
    } catch {
      toast({ title: "Albüm silinemedi.", variant: "destructive" });
    }
    setDeleteTarget(null);
  }

  return (
    <>
      <aside className="flex w-52 shrink-0 flex-col gap-1">
        {/* All images */}
        <button
          type="button"
          onClick={() => onFilterChange("all")}
          className={cn(rowClass, filter === "all" && activeClass)}
        >
          <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate">Tüm Görseller</span>
          <span className="text-xs text-muted-foreground">{totalCount}</span>
        </button>

        {/* Favorites */}
        {favAlbum && (
          <button
            type="button"
            onClick={() => onFilterChange("favorites")}
            className={cn(rowClass, filter === "favorites" && activeClass)}
          >
            <Star className={cn("h-3.5 w-3.5 shrink-0", filter === "favorites" ? "fill-amber-400 text-amber-400" : "text-amber-400")} />
            <span className="flex-1 truncate">{favAlbum.name}</span>
            <span className="text-xs text-muted-foreground">{favAlbum.item_count}</span>
          </button>
        )}

        {/* Divider + Albums heading */}
        {userAlbums.length > 0 && (
          <div className="my-1 border-t border-border" />
        )}

        {userAlbums.map((album) => {
          const isActive = typeof filter === "object" && filter.albumId === album.id;
          if (renamingId === album.id) {
            return (
              <form
                key={album.id}
                onSubmit={(e) => { e.preventDefault(); commitRename(album); }}
                className="flex items-center gap-1 px-1"
              >
                <Input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(album)}
                  onKeyDown={(e) => e.key === "Escape" && setRenamingId(null)}
                  className="h-7 text-sm"
                  maxLength={255}
                />
              </form>
            );
          }

          return (
            <div key={album.id} className={cn("group flex items-center gap-1 rounded-md", isActive && "bg-accent/15")}>
              <button
                type="button"
                onClick={() => onFilterChange({ albumId: album.id })}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent/10",
                  isActive && "text-accent font-semibold",
                )}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: album.color ?? "#6366f1" }}
                />
                <span className="flex-1 truncate">{album.name}</span>
                <span className="text-xs text-muted-foreground">{album.item_count}</span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-accent/20 group-hover:opacity-100"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => { setRenamingId(album.id); setRenameValue(album.name); }}>
                    <Pencil className="h-3.5 w-3.5" />
                    Yeniden Adlandır
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteTarget(album)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Albümü Sil
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}

        {/* New album button */}
        <button
          type="button"
          onClick={onNewAlbum}
          className={cn(rowClass, "mt-1 text-muted-foreground")}
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          <span>Yeni Albüm</span>
        </button>
      </aside>

      {/* Delete confirm */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Albüm silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>"{deleteTarget?.name}"</strong> albümü silinecek. Görseller silinmez, sadece albüm ilişkileri kaldırılır.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Albümü Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── new album quick-create dialog ──────────────────────────────────────────

interface NewAlbumFormProps {
  albums: MediaAlbum[];
  onCreated: (albums: MediaAlbum[]) => void;
  onClose: () => void;
}

function NewAlbumForm({ albums, onCreated, onClose }: NewAlbumFormProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const album = await createAdminMediaAlbum(trimmed, color);
      onCreated([...albums, album]);
      toast({ title: `"${trimmed}" albümü oluşturuldu.` });
      onClose();
    } catch (err) {
      toast({
        title: "Albüm oluşturulamadı.",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-card-soft">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Yeni Albüm</p>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          autoFocus
          placeholder="Albüm adı..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={255}
        />
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">Renk</p>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                  color === c ? "border-foreground" : "border-transparent",
                )}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={!name.trim() || saving} className="flex-1 bg-accent text-accent-foreground hover:bg-accent-glow">
            {saving ? "Oluşturuluyor..." : "Oluştur"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onClose}>Vazgeç</Button>
        </div>
      </form>
    </div>
  );
}

// ─── album badges on card ───────────────────────────────────────────────────

function AlbumBadges({ albumIds, albums }: { albumIds: string[]; albums: MediaAlbum[] }) {
  const matched = albumIds
    .map((id) => albums.find((a) => a.id === id && !a.is_favorite))
    .filter(Boolean) as MediaAlbum[];

  if (matched.length === 0) return null;

  const visible = matched.slice(0, 3);
  const extra = matched.length - visible.length;

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((album) => (
        <span
          key={album.id}
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
          style={{ background: album.color ?? "#6366f1" }}
        >
          <FolderOpen className="h-2.5 w-2.5" />
          {album.name}
        </span>
      ))}
      {extra > 0 && (
        <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
          +{extra}
        </span>
      )}
    </div>
  );
}

// ─── main page ──────────────────────────────────────────────────────────────

export default function AdminMedia() {
  const [items, setItems] = useState<AdminMediaImage[]>([]);
  const [albums, setAlbums] = useState<MediaAlbum[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminMediaImage | null>(null);
  const [showNewAlbumForm, setShowNewAlbumForm] = useState(false);
  // Client-side fallback detection (P1-5): catches broken images the server
  // couldn't verify (external URLs) or a browser-level load failure — the
  // SPA's index.html fallback for a missing local file is HTML, not an
  // image, so <img> reliably fires onError for it.
  const [brokenUrls, setBrokenUrls] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    try {
      const [media, albumList] = await Promise.all([getAdminMedia(), getAdminMediaAlbums()]);
      setItems(media);
      setAlbums(albumList);
    } catch {
      toast({ title: "Medya yüklenemedi.", description: "Görseller alınırken bir problem oluştu.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function handleImageAlbumsChanged(imageId: string, albumIds: string[]) {
    setItems((prev) => prev.map((img) => (img.id === imageId ? { ...img, album_ids: albumIds } : img)));
  }

  // Apply filter + search
  const favAlbum = albums.find((a) => a.is_favorite);

  const filtered = items.filter((image) => {
    // Album filter
    if (filter === "favorites") {
      if (!favAlbum || !(image.album_ids ?? []).includes(favAlbum.id)) return false;
    } else if (typeof filter === "object") {
      if (!(image.album_ids ?? []).includes(filter.albumId)) return false;
    }
    // Search
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

  const filterLabel =
    filter === "all" ? null
    : filter === "favorites" ? "Favoriler"
    : albums.find((a) => typeof filter === "object" && a.id === filter.albumId)?.name ?? null;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Proje Yönetimi"
        title="Medya"
        description="Projelerde kullanılan görselleri merkezi olarak inceleyin, albümlere ekleyin veya silin."
        actions={
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="bg-accent text-accent-foreground hover:bg-accent-glow">
            <UploadCloud className="h-4 w-4" />
            {uploading ? "Yükleniyor..." : "Yeni Görsel Yükle"}
          </Button>
        }
      />

      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && uploadFiles(e.target.files)} />

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
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

      {/* New album quick form (above gallery) */}
      {showNewAlbumForm && (
        <NewAlbumForm
          albums={albums}
          onCreated={(updated) => setAlbums(updated)}
          onClose={() => setShowNewAlbumForm(false)}
        />
      )}

      {/* Main layout: sidebar + gallery */}
      <div className="flex gap-6">
        {/* Sidebar */}
        <AlbumSidebar
          albums={albums}
          filter={filter}
          onFilterChange={setFilter}
          totalCount={items.length}
          onAlbumsChanged={setAlbums}
          onNewAlbum={() => setShowNewAlbumForm(true)}
        />

        {/* Gallery column */}
        <div className="min-w-0 flex-1 space-y-4">
          {/* Search + count */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Dosya, proje veya URL ara..." value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              {filterLabel && (
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className="flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/20"
                >
                  {filterLabel}
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="text-sm text-muted-foreground">{filtered.length} / {items.length} görsel</div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Yükleniyor...</div>
          ) : filtered.length === 0 ? (
            <AdminEmptyState
              title="Görsel bulunamadı"
              description={
                filter !== "all"
                  ? "Bu albümde görsel yok. Bir görselin kartındaki albüm ikonuna tıklayarak ekleyebilirsiniz."
                  : "Yeni bir görsel yükleyerek medya kütüphanesini oluşturmaya başlayabilirsiniz."
              }
              icon={ImageIcon}
              action={
                filter === "all"
                  ? <Button onClick={() => fileInputRef.current?.click()}><UploadCloud className="h-4 w-4" /> Yeni Görsel Yükle</Button>
                  : <Button variant="outline" onClick={() => setFilter("all")}><X className="h-4 w-4" /> Filtreyi Temizle</Button>
              }
            />
          ) : (
            <TooltipProvider>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                {filtered.map((image) => {
                  const isMissing = isMediaImageMissing(image, brokenUrls);
                  return (
                  <div key={image.id || image.image_url} className="overflow-hidden rounded-md border border-border bg-card shadow-card-soft">
                    <div className="relative aspect-square bg-muted">
                      {isMissing ? (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-destructive">
                          <AlertTriangle className="h-6 w-6" />
                          <span className="text-[11px] font-semibold">Dosya eksik</span>
                        </div>
                      ) : (
                        <img
                          src={resolveImageUrl(image.image_url)}
                          alt={image.alt_text || image.title || ""}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          onError={() => setBrokenUrls((prev) => (prev.has(image.image_url) ? prev : new Set(prev).add(image.image_url)))}
                        />
                      )}
                      <div className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-1 text-[11px] font-semibold text-white">
                        {sourceLabel(image)}
                      </div>
                      {image.is_protected && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="absolute right-2 top-2 rounded-md bg-amber-500 px-2 py-1 text-[11px] font-semibold text-white">
                              Kullanımda
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {isMissing
                              ? "Bu görsel bir yerde referans gösteriliyor ancak fiziksel dosyası bulunamadı — önce yeniden yükleyin veya referansı kaldırın."
                              : (image.protected_reason || "Bu görsel önce ilgili ayardan/projeden kaldırılmalı")}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>

                    <div className="space-y-2 p-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold" title={displayName(image)}>{displayName(image)}</div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground" title={image.projects?.title || image.project_title || image.image_url}>
                          {image.projects?.title || image.project_title || image.image_url}
                        </div>
                      </div>

                      {/* Album badges */}
                      <AlbumBadges albumIds={image.album_ids ?? []} albums={albums} />

                      {/* Actions row */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-w-0 flex-1"
                          onClick={() => { navigator.clipboard.writeText(image.image_url); toast({ title: "URL kopyalandı" }); }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Kopyala
                        </Button>

                        {/* Album popover: star + folder */}
                        {image.id && (
                          <MediaAlbumPopover
                            image={image}
                            albums={albums}
                            onAlbumsChanged={setAlbums}
                            onImageAlbumsChanged={handleImageAlbumsChanged}
                          />
                        )}

                        {/* Delete */}
                        {image.can_delete !== false && !image.is_protected && (
                          <Button size="sm" variant="destructive" className="h-9 w-9 p-0" onClick={() => setDeleteTarget(image)} title="Sil">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Delete image confirm */}
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
