import { useState } from "react";
import { Check, FolderPlus, Loader2, Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import type { MediaAlbum, AdminMediaImage } from "@/lib/apiClient";
import {
  assignMediaToAlbum,
  createAdminMediaAlbum,
  removeMediaFromAlbum,
} from "@/lib/apiClient";
import { cn } from "@/lib/utils";

interface Props {
  image: AdminMediaImage;
  albums: MediaAlbum[];
  onAlbumsChanged: (updatedAlbums: MediaAlbum[]) => void;
  onImageAlbumsChanged: (imageId: string, albumIds: string[]) => void;
}

export default function MediaAlbumPopover({ image, albums, onAlbumsChanged, onImageAlbumsChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");
  const [saving, setSaving] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const mediaId = image.id ?? "";
  const albumIds = image.album_ids ?? [];

  const favAlbum = albums.find((a) => a.is_favorite);
  const isFavorite = favAlbum ? albumIds.includes(favAlbum.id) : false;

  async function toggleAlbum(album: MediaAlbum) {
    if (!mediaId || saving) return;
    const isIn = albumIds.includes(album.id);
    setSaving(album.id);
    try {
      if (isIn) {
        await removeMediaFromAlbum(album.id, mediaId);
        onImageAlbumsChanged(mediaId, albumIds.filter((id) => id !== album.id));
        onAlbumsChanged(albums.map((a) => a.id === album.id ? { ...a, item_count: Math.max(0, a.item_count - 1) } : a));
      } else {
        await assignMediaToAlbum(album.id, mediaId);
        onImageAlbumsChanged(mediaId, [...albumIds, album.id]);
        onAlbumsChanged(albums.map((a) => a.id === album.id ? { ...a, item_count: a.item_count + 1 } : a));
      }
    } catch {
      toast({ title: "İşlem başarısız.", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  }

  async function toggleFavorite(event: React.MouseEvent) {
    event.stopPropagation();
    if (!favAlbum || !mediaId || saving) return;
    setSaving(favAlbum.id);
    try {
      if (isFavorite) {
        await removeMediaFromAlbum(favAlbum.id, mediaId);
        onImageAlbumsChanged(mediaId, albumIds.filter((id) => id !== favAlbum.id));
        onAlbumsChanged(albums.map((a) => a.id === favAlbum.id ? { ...a, item_count: Math.max(0, a.item_count - 1) } : a));
      } else {
        await assignMediaToAlbum(favAlbum.id, mediaId);
        onImageAlbumsChanged(mediaId, [...albumIds, favAlbum.id]);
        onAlbumsChanged(albums.map((a) => a.id === favAlbum.id ? { ...a, item_count: a.item_count + 1 } : a));
      }
    } catch {
      toast({ title: "İşlem başarısız.", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name || submitting) return;
    setSubmitting(true);
    try {
      const album = await createAdminMediaAlbum(name, newColor);
      const updated = [...albums, album];
      onAlbumsChanged(updated);
      // Immediately assign to this image
      await assignMediaToAlbum(album.id, mediaId);
      onImageAlbumsChanged(mediaId, [...albumIds, album.id]);
      onAlbumsChanged(updated.map((a) => a.id === album.id ? { ...a, item_count: 1 } : a));
      setNewName("");
      setCreating(false);
      toast({ title: `"${name}" albümü oluşturuldu.` });
    } catch (err) {
      toast({
        title: "Albüm oluşturulamadı.",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const nonFavoriteAlbums = albums.filter((a) => !a.is_favorite);

  return (
    <div className="flex items-center gap-1">
      {/* Favorite star — always visible on card */}
      <button
        type="button"
        onClick={toggleFavorite}
        disabled={!favAlbum || saving === favAlbum?.id}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md border transition-colors",
          isFavorite
            ? "border-amber-400 bg-amber-50 text-amber-500 hover:bg-amber-100"
            : "border-border bg-transparent text-muted-foreground hover:border-amber-400 hover:text-amber-400",
        )}
        title={isFavorite ? "Favorilerden çıkar" : "Favorilere ekle"}
      >
        {saving === favAlbum?.id
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <Star className={cn("h-3.5 w-3.5", isFavorite && "fill-amber-400")} />}
      </button>

      {/* Album popover trigger */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-transparent text-muted-foreground transition-colors hover:border-accent hover:text-accent"
            title="Albümleri düzenle"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-64 p-0" sideOffset={6}>
          <div className="border-b border-border px-3 py-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Albümler</p>
          </div>

          <div className="max-h-52 overflow-y-auto py-1">
            {nonFavoriteAlbums.length === 0 && !creating && (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">Henüz albüm yok</p>
            )}
            {nonFavoriteAlbums.map((album) => {
              const isIn = albumIds.includes(album.id);
              const isLoading = saving === album.id;
              return (
                <button
                  key={album.id}
                  type="button"
                  disabled={!!saving}
                  onClick={() => toggleAlbum(album)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-accent/10 disabled:opacity-60"
                >
                  <span
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors"
                    style={isIn ? { background: album.color ?? "#6366f1", borderColor: album.color ?? "#6366f1" } : {}}
                  >
                    {isLoading
                      ? <Loader2 className="h-2.5 w-2.5 animate-spin text-white" />
                      : isIn && <Check className="h-2.5 w-2.5 text-white" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left">{album.name}</span>
                  <span className="text-xs text-muted-foreground">{album.item_count}</span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-border p-2">
            {creating ? (
              <form onSubmit={handleCreate} className="space-y-2">
                <Input
                  autoFocus
                  placeholder="Albüm adı..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-8 text-sm"
                  maxLength={255}
                />
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent p-0.5"
                    title="Renk seç"
                  />
                  <div className="flex flex-1 gap-1">
                    <Button type="submit" size="sm" className="flex-1 h-8 text-xs" disabled={!newName.trim() || submitting}>
                      {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Oluştur"}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setCreating(false); setNewName(""); }}>
                      Vazgeç
                    </Button>
                  </div>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                Yeni Albüm
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
