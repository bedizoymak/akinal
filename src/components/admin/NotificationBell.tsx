import { Link } from "react-router-dom";
import { Bell, Check, Trash2 } from "lucide-react";
import { useNotifications, priorityClass } from "@/hooks/useNotifications";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDate } from "@/lib/finance";

export default function NotificationBell() {
  const { items, unreadCount, markRead, markAllRead, remove } = useNotifications();
  const recent = items.slice(0, 8);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-md hover:bg-muted/60" aria-label="Bildirimler">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold flex items-center justify-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="font-display font-semibold">Bildirim Merkezi</div>
          <button onClick={markAllRead} className="text-xs text-accent hover:underline">Tümünü okundu yap</button>
        </div>
        <ScrollArea className="max-h-[420px]">
          {recent.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground text-center">Henüz bildirim bulunmuyor.</div>
          )}
          {recent.map((n) => (
            <div key={n.id} className={`px-4 py-3 border-b last:border-0 ${n.is_read ? "" : "bg-accent/5"}`}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold truncate">{n.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${priorityClass(n.priority)}`}>{n.priority}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                  <div className="text-[10px] text-muted-foreground mt-1">{formatDate(n.created_at)}</div>
                </div>
                <div className="flex flex-col gap-1">
                  {!n.is_read && (
                    <button onClick={() => markRead(n.id)} title="Okundu yap" className="p-1 hover:text-accent"><Check className="h-3.5 w-3.5" /></button>
                  )}
                  <button onClick={() => remove(n.id)} title="Sil" className="p-1 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </ScrollArea>
        <div className="p-2 border-t">
          <Button asChild variant="ghost" className="w-full text-sm">
            <Link to="/admin/bildirimler">Tüm Bildirimleri Gör</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
