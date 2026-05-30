import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getAdminDashboard } from "@/lib/apiClient";

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;
    getAdminDashboard()
      .then((dashboard) => {
        if (active) setUnreadCount(dashboard.summary.unread_notifications || 0);
      })
      .catch(() => {
        if (active) setUnreadCount(0);
      });
    return () => {
      active = false;
    };
  }, []);

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
          <Link to="/admin/bildirimler" className="text-xs text-accent hover:underline">Tümünü gör</Link>
        </div>
        <ScrollArea className="max-h-[420px]">
          {unreadCount === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">Henüz okunmamış bildirim bulunmuyor.</div>
          ) : (
            <div className="p-6 text-sm text-muted-foreground text-center">{unreadCount} okunmamış bildirim var.</div>
          )}
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
