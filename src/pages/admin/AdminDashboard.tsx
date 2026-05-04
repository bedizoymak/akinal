import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FolderKanban, FileEdit, Eye, Star, Inbox } from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ total: 0, published: 0, draft: 0, featured: 0, newReq: 0 });

  useEffect(() => {
    (async () => {
      const [{ count: total }, { count: published }, { count: draft }, { count: featured }, { count: newReq }] = await Promise.all([
        supabase.from("projects").select("*", { count: "exact", head: true }),
        supabase.from("projects").select("*", { count: "exact", head: true }).eq("is_published", true),
        supabase.from("projects").select("*", { count: "exact", head: true }).eq("is_published", false),
        supabase.from("projects").select("*", { count: "exact", head: true }).eq("is_featured", true),
        supabase.from("contact_requests").select("*", { count: "exact", head: true }).eq("status", "Yeni"),
      ]);
      setStats({ total: total || 0, published: published || 0, draft: draft || 0, featured: featured || 0, newReq: newReq || 0 });
    })();
  }, []);

  const cards = [
    { label: "Toplam Proje", value: stats.total, icon: FolderKanban, to: "/admin/projeler" },
    { label: "Yayındaki Projeler", value: stats.published, icon: Eye, to: "/admin/projeler" },
    { label: "Taslak Projeler", value: stats.draft, icon: FileEdit, to: "/admin/projeler" },
    { label: "Öne Çıkan Projeler", value: stats.featured, icon: Star, to: "/admin/projeler" },
    { label: "Yeni İletişim Talebi", value: stats.newReq, icon: Inbox, to: "/admin/talepler" },
  ];

  return (
    <div>
      <h1 className="font-display text-3xl font-bold mb-1">Panel Ana Sayfa</h1>
      <p className="text-muted-foreground mb-8">Hoş geldiniz. Aşağıda site özetiniz yer alır.</p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="p-5 rounded-lg bg-card border border-border hover:border-accent transition-colors">
            <c.icon className="h-5 w-5 text-accent mb-3" />
            <div className="text-3xl font-display font-bold">{c.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{c.label}</div>
          </Link>
        ))}
      </div>

      <div className="mt-10 grid md:grid-cols-2 gap-4">
        <Link to="/admin/projeler/yeni" className="p-6 rounded-lg bg-primary text-primary-foreground hover:bg-primary-glow transition-colors">
          <div className="font-display text-xl font-bold mb-1">Yeni Proje Ekle</div>
          <div className="text-sm opacity-80">Yeni proje, görsel yükleme ve yayınlama.</div>
        </Link>
        <Link to="/admin/ayarlar" className="p-6 rounded-lg bg-accent text-accent-foreground hover:bg-accent-glow transition-colors">
          <div className="font-display text-xl font-bold mb-1">Site Ayarları</div>
          <div className="text-sm opacity-90">Telefon, WhatsApp, e-posta ve hero metinlerini yönet.</div>
        </Link>
      </div>
    </div>
  );
}
