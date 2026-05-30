import { useEffect, useState, useCallback } from "react";
import { deleteAdminNotification, getAdminNotifications, markAllAdminNotificationsRead, updateAdminNotificationRead } from "@/lib/apiClient";

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
};

export const NOTIFICATION_TYPES = [
  "Yaklaşan Ödeme", "Geciken Ödeme", "Yeni İletişim Talebi", "Bugünkü Tahsilat",
  "Bu Ay Beklenen Tahsilat", "Yeni Müşteri", "Yeni Proje", "Gider Kaydı",
] as const;

export const PRIORITIES = ["Düşük", "Orta", "Yüksek", "Kritik"] as const;

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

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminNotifications();
      setItems(data.map((item) => ({ ...item, is_read: !!item.is_read })) as Notification[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const unreadCount = items.filter((n) => !n.is_read).length;

  const markRead = async (id: string) => {
    await updateAdminNotificationRead(id, true);
    setItems((s) => s.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };
  const markAllRead = async () => {
    await markAllAdminNotificationsRead();
    setItems((s) => s.map((n) => ({ ...n, is_read: true })));
  };
  const remove = async (id: string) => {
    await deleteAdminNotification(id);
    setItems((s) => s.filter((n) => n.id !== id));
  };

  return { items, loading, unreadCount, reload, markRead, markAllRead, remove };
}
