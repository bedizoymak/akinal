import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AdminPageHeader } from "@/components/admin/AdminPage";

export default function AdminSettings() {
  const [data, setData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    supabase.from("site_settings").select("*").limit(1).maybeSingle().then(({ data }) => setData(data));
  }, []);

  if (!data) return <div className="text-center text-muted-foreground py-12">Yükleniyor...</div>;

  function up(k: string, v: any) { setData((d: any) => ({ ...d, [k]: v })); }

  async function save() {
    setSaving(true);
    const { id, updated_at, ...rest } = data;
    const { error } = await supabase.from("site_settings").update(rest).eq("id", id);
    setSaving(false);
    if (error) toast({ title: "Hata", description: error.message, variant: "destructive" });
    else toast({ title: "Site ayarları kaydedildi" });
  }

  const fields: [string, string, "input" | "textarea"][] = [
    ["company_name", "Firma Adı", "input"],
    ["phone", "Telefon", "input"],
    ["whatsapp_number", "WhatsApp Numarası", "input"],
    ["email", "E-posta", "input"],
    ["address", "Adres", "input"],
    ["map_embed_url", "Google Maps Embed Linki", "input"],
    ["instagram_url", "Instagram Linki", "input"],
    ["facebook_url", "Facebook Linki", "input"],
    ["linkedin_url", "LinkedIn Linki", "input"],
    ["footer_description", "Footer Açıklaması", "textarea"],
    ["hero_title", "Ana Sayfa Hero Başlığı", "input"],
    ["hero_subtitle", "Ana Sayfa Hero Alt Başlığı", "textarea"],
    ["whatsapp_message", "WhatsApp Hazır Mesajı", "textarea"],
    ["seo_title", "SEO Başlığı", "input"],
    ["seo_description", "SEO Açıklaması", "textarea"],
  ];

  return (
    <div className="max-w-3xl">
      <AdminPageHeader
        eyebrow="Sistem"
        title="Ayarlar"
        description="Web sitesinin iletişim bilgileri, sosyal medya bağlantıları, ana sayfa metinleri ve SEO alanlarını yönetin."
      />
      <div className="space-y-4 bg-card border border-border rounded-md p-6">
        {fields.map(([k, label, type]) => (
          <div key={k}>
            <Label>{label}</Label>
            {type === "input" ? (
              <Input value={data[k] || ""} onChange={(e) => up(k, e.target.value)} />
            ) : (
              <Textarea rows={3} value={data[k] || ""} onChange={(e) => up(k, e.target.value)} />
            )}
          </div>
        ))}
        <Button onClick={save} disabled={saving} className="bg-accent hover:bg-accent-glow text-accent-foreground">{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
      </div>
    </div>
  );
}
