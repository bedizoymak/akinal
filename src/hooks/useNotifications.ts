import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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

async function ensurePaymentNotifications() {
  // Generate dynamic payment-related notifications based on payment_plans
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
  const todayStr = today.toISOString().slice(0, 10);
  const in7Str = in7.toISOString().slice(0, 10);

  const { data: plans } = await (supabase.from("payment_plans") as any)
    .select("id, title, amount, due_date, status, customer_id, project_id")
    .neq("status", "Ödendi").neq("status", "İptal");
  if (!plans) return;

  const { data: existing } = await (supabase.from("notifications") as any)
    .select("related_payment_plan_id, type, created_at")
    .in("type", ["Yaklaşan Ödeme", "Bugünkü Tahsilat", "Geciken Ödeme"]);
  const existSet = new Set(
    (existing || []).map((n: any) => {
      const d = new Date(n.created_at).toISOString().slice(0, 10);
      return `${n.related_payment_plan_id}|${n.type}|${d}`;
    })
  );

  const toInsert: any[] = [];
  for (const p of plans) {
    let type = "";
    let title = "";
    let message = "";
    let priority = "Orta";
    if (p.due_date < todayStr) {
      type = "Geciken Ödeme";
      title = "Geciken Ödeme";
      message = `${p.title} için vadesi geçen tahsilat bulunmaktadır.`;
      priority = "Kritik";
    } else if (p.due_date === todayStr) {
      type = "Bugünkü Tahsilat";
      title = "Bugünkü Tahsilat";
      message = `${p.title} için bugün tahsilat vadesi bulunmaktadır.`;
      priority = "Yüksek";
    } else if (p.due_date <= in7Str) {
      type = "Yaklaşan Ödeme";
      title = "Yaklaşan Ödeme";
      const days = Math.round((new Date(p.due_date).getTime() - today.getTime()) / 86400000);
      message = `${p.title} için ${days} gün içinde ödeme vadesi bulunuyor.`;
      priority = "Yüksek";
    } else continue;

    const key = `${p.id}|${type}|${todayStr}`;
    if (existSet.has(key)) continue;
    toInsert.push({
      title, message, type, priority,
      related_customer_id: p.customer_id,
      related_project_id: p.project_id,
      related_payment_plan_id: p.id,
    });
  }
  if (toInsert.length) {
    await (supabase.from("notifications") as any).insert(toInsert);
  }
}

export function useNotifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    await ensurePaymentNotifications().catch(() => {});
    const { data } = await (supabase.from("notifications") as any)
      .select("*").order("created_at", { ascending: false }).limit(200);
    setItems((data as Notification[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const unreadCount = items.filter((n) => !n.is_read).length;

  const markRead = async (id: string) => {
    await (supabase.from("notifications") as any).update({ is_read: true }).eq("id", id);
    setItems((s) => s.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };
  const markAllRead = async () => {
    await (supabase.from("notifications") as any).update({ is_read: true }).eq("is_read", false);
    setItems((s) => s.map((n) => ({ ...n, is_read: true })));
  };
  const remove = async (id: string) => {
    await (supabase.from("notifications") as any).delete().eq("id", id);
    setItems((s) => s.filter((n) => n.id !== id));
  };

  return { items, loading, unreadCount, reload, markRead, markAllRead, remove };
}
