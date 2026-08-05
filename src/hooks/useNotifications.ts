import { useEffect, useState, useCallback } from "react";
import {
  deleteAdminNotification,
  deleteAllAdminNotifications,
  getAdminNotifications,
  markAllAdminNotificationsRead,
  updateAdminNotificationRead,
} from "@/lib/apiClient";

export type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  related_customer_id: string | null;
  related_project_id: string | null;
  related_payment_plan_id: string | null;
  is_read: boolean;
  created_at: string;
  synthetic?: boolean;
};

export const NOTIFICATION_TYPES = [
  "Yaklaşan Ödeme", "Geciken Ödeme", "Yeni İletişim Talebi", "Bugünkü Tahsilat",
  "Bu Ay Beklenen Tahsilat", "Yeni Müşteri", "Yeni Proje", "Gider Kaydı",
] as const;

export const PRIORITIES = ["Düşük", "Orta", "Yüksek", "Kritik"] as const;
export const ADMIN_NOTIFICATIONS_CHANGED_EVENT = "admin-notifications-changed";

export function notifyAdminNotificationsChanged() {
  window.dispatchEvent(new Event(ADMIN_NOTIFICATIONS_CHANGED_EVENT));
}

export function priorityClass(p: string): string {
  switch (p) {
    case "Kritik": return "bg-red-100 text-red-700 border-red-200";
    case "Yüksek": return "bg-orange-100 text-orange-700 border-orange-200";
    case "Orta": return "bg-amber-100 text-amber-700 border-amber-200";
    default: return "bg-emerald-100 text-emerald-700 border-emerald-200";
  }
}

export function useNotifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminNotifications();
      setItems(data.notifications.map((item) => ({ ...item, is_read: !!item.is_read })) as Notification[]);
      setTotalCount(data.total_count ?? data.notifications.length);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(ADMIN_NOTIFICATIONS_CHANGED_EVENT, reload);
    return () => window.removeEventListener(ADMIN_NOTIFICATIONS_CHANGED_EVENT, reload);
  }, [reload]);

  const unreadCount = items.filter((n) => !n.is_read).length;

  const markRead = async (id: string) => {
    await updateAdminNotificationRead(id, true);
    setItems((s) => s.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    notifyAdminNotificationsChanged();
  };
  const markAllRead = async () => {
    await markAllAdminNotificationsRead();
    setItems((s) => s.map((n) => ({ ...n, is_read: true })));
    notifyAdminNotificationsChanged();
  };
  const remove = async (id: string) => {
    await deleteAdminNotification(id);
    setItems((s) => s.filter((n) => n.id !== id));
    setTotalCount((count) => Math.max(0, count - 1));
    notifyAdminNotificationsChanged();
  };
  const removeAll = async () => {
    await deleteAllAdminNotifications();
    setItems([]);
    setTotalCount(0);
    notifyAdminNotificationsChanged();
  };

  return { items, loading, unreadCount, totalCount, reload, markRead, markAllRead, remove, removeAll };
}
