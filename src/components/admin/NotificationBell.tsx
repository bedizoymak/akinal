import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getAdminNotifications, updateAdminNotificationRead } from "@/lib/apiClient";
import type { AdminNotification } from "@/lib/apiTypes";
import { formatDate } from "@/lib/finance";
import { ADMIN_NOTIFICATIONS_CHANGED_EVENT, notifyAdminNotificationsChanged } from "@/hooks/useNotifications";

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadNotifications() {
    setLoading(true);
    try {
      const data = await getAdminNotifications(5);
      setNotifications(data.notifications.map((item) => ({ ...item, is_read: !!item.is_read })));
      setUnreadCount(data.unread_count || 0);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
    window.addEventListener(ADMIN_NOTIFICATIONS_CHANGED_EVENT, loadNotifications);
    return () => {
      window.removeEventListener(ADMIN_NOTIFICATIONS_CHANGED_EVENT, loadNotifications);
    };
  }, []);

  async function handleNotificationClick(notification: AdminNotification) {
    if (!notification.is_read) {
      await updateAdminNotificationRead(notification.id, true);
      setNotifications((current) => current.map((item) => (item.id === notification.id ? { ...item, is_read: true } : item)));
      setUnreadCount((count) => Math.max(0, count - 1));
      notifyAdminNotificationsChanged();
    }
  }

  return (
    <Popover onOpenChange={(open) => { if (open) loadNotifications(); }}>
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
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground text-center">Yükleniyor...</div>
          ) : notifications.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">Henüz bildirim bulunmuyor</div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <Link
                  key={notification.id}
                  to="/admin/bildirimler"
                  onClick={() => handleNotificationClick(notification)}
                  className={`block px-4 py-3 transition-colors hover:bg-muted/60 ${notification.is_read ? "" : "bg-accent/5"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="line-clamp-1 text-sm font-semibold">{notification.title}</div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{notification.message}</p>
                      <div className="mt-1 text-[11px] text-muted-foreground">{formatDate(notification.created_at)}</div>
                    </div>
                    {!notification.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-600" aria-label="Okunmadı" />}
                  </div>
                </Link>
              ))}
            </div>
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
