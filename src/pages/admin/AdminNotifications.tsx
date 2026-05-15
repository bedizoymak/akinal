import { useMemo, useState } from "react";
import { useNotifications, NOTIFICATION_TYPES, PRIORITIES, priorityClass } from "@/hooks/useNotifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Check, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/finance";
import { AdminPageHeader } from "@/components/admin/AdminPage";

export default function AdminNotifications() {
  const { items, loading, markRead, markAllRead, remove } = useNotifications();
  const [type, setType] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => items.filter((n) => {
    if (type !== "all" && n.type !== type) return false;
    if (priority !== "all" && n.priority !== priority) return false;
    if (unreadOnly && n.is_read) return false;
    if (q && !(`${n.title} ${n.message}`).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [items, type, priority, unreadOnly, q]);

  return (
    <div>
      <AdminPageHeader
        eyebrow="Operasyon"
        title="Bildirimler"
        description="Sistem bildirimlerini, tahsilat hatırlatmalarını ve operasyon sinyallerini filtreleyin."
        actions={<Button onClick={markAllRead} variant="outline"><Bell className="h-4 w-4" /> Tümünü Okundu Yap</Button>}
      />

      <Card className="mb-4">
        <CardContent className="p-4 grid md:grid-cols-4 gap-3">
          <Input placeholder="Bildirimde ara..." value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue placeholder="Tür" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm türler</SelectItem>
              {NOTIFICATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger><SelectValue placeholder="Öncelik" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm öncelikler</SelectItem>
              {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
            Sadece okunmamış
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Bildirimler ({filtered.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading && <div className="p-6 text-muted-foreground text-sm">Yükleniyor...</div>}
          {!loading && filtered.length === 0 && (
            <div className="p-10 text-center text-muted-foreground">Bildirim bulunamadı.</div>
          )}
          <div className="divide-y">
            {filtered.map((n) => (
              <div key={n.id} className={`p-4 flex items-start gap-3 ${n.is_read ? "" : "bg-accent/5"}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-1">
                    <span className="font-semibold">{n.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${priorityClass(n.priority)}`}>{n.priority}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded border bg-muted text-muted-foreground">{n.type}</span>
                    {!n.is_read && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-600 text-white">Okunmadı</span>}
                  </div>
                  <p className="text-sm text-muted-foreground">{n.message}</p>
                  <div className="text-xs text-muted-foreground mt-1">{formatDate(n.created_at)}</div>
                </div>
                <div className="flex gap-1">
                  {!n.is_read && (
                    <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}><Check className="h-4 w-4" /></Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => remove(n.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
