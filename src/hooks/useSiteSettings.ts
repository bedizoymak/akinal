import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SiteSettings {
  id: string;
  company_name: string;
  phone: string;
  whatsapp_number: string;
  email: string;
  address: string;
  map_embed_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  linkedin_url: string | null;
  footer_description: string;
  hero_title: string;
  hero_subtitle: string;
  whatsapp_message: string;
  seo_title: string;
  seo_description: string;
}

const defaults: SiteSettings = {
  id: "",
  company_name: "Akınal İnşaat",
  phone: "+90 000 000 00 00",
  whatsapp_number: "+90 000 000 00 00",
  email: "info@akinalinsaat.com",
  address: "İstanbul, Türkiye",
  map_embed_url: null,
  instagram_url: null,
  facebook_url: null,
  linkedin_url: null,
  footer_description: "Akınal İnşaat; kentsel dönüşüm ve inşaat projelerinde güvenilir, planlı ve teknik çözümler sunar.",
  hero_title: "Güvenli Yapılar, Değerli Yaşam Alanları",
  hero_subtitle: "Akınal İnşaat olarak kentsel dönüşüm, kat karşılığı inşaat ve anahtar teslim projelerde; planlama, ruhsat, uygulama ve teslim süreçlerini profesyonel şekilde yönetiyoruz.",
  whatsapp_message: "Merhaba, kentsel dönüşüm / inşaat hizmetleriniz hakkında bilgi almak istiyorum.",
  seo_title: "Akınal İnşaat | Kentsel Dönüşüm ve İnşaat Hizmetleri",
  seo_description: "Akınal İnşaat; kentsel dönüşüm, kat karşılığı inşaat, anahtar teslim inşaat ve proje geliştirme alanlarında güvenilir çözümler sunar.",
};

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(defaults);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("site_settings")
      .select("*")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSettings({ ...defaults, ...data });
        setLoading(false);
      });
  }, []);

  return { settings, loading };
}

export function getWhatsAppLink(num: string, message: string) {
  const digits = (num || "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message || "")}`;
}

export function getTelLink(num: string) {
  return `tel:${(num || "").replace(/\s/g, "")}`;
}
