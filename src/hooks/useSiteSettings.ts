import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const CONTACT_ADDRESS = "Molla Gürani, Sarı Musa Sk. No:49/A, 34349 Fatih, İstanbul, Türkiye";
const CONTACT_PHONE = "0532 622 67 29";
const CONTACT_MAP_EMBED_URL = `https://www.google.com/maps?hl=tr&q=${encodeURIComponent(CONTACT_ADDRESS)}&z=17&output=embed`;

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
  company_name: "AKİNAL İNŞAAT",
  phone: CONTACT_PHONE,
  whatsapp_number: CONTACT_PHONE,
  email: "info@akinalinsaat.com",
  address: CONTACT_ADDRESS,
  map_embed_url: CONTACT_MAP_EMBED_URL,
  instagram_url: null,
  facebook_url: null,
  linkedin_url: null,
  footer_description: "AKİNAL İNŞAAT; kentsel dönüşüm ve inşaat projelerinde güvenilir, planlı ve teknik çözümler sunar.",
  hero_title: "Güvenli Yapılar, Değerli Yaşam Alanları",
  hero_subtitle: "AKİNAL İNŞAAT olarak kentsel dönüşüm, kat karşılığı inşaat ve anahtar teslim projelerde; planlama, ruhsat, uygulama ve teslim süreçlerini profesyonel şekilde yönetiyoruz.",
  whatsapp_message: "Merhaba, kentsel dönüşüm / inşaat hizmetleriniz hakkında bilgi almak istiyorum.",
  seo_title: "AKİNAL İNŞAAT | Kentsel Dönüşüm ve İnşaat Hizmetleri",
  seo_description: "AKİNAL İNŞAAT; kentsel dönüşüm, kat karşılığı inşaat, anahtar teslim inşaat ve proje geliştirme alanlarında güvenilir çözümler sunar.",
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
        if (data) {
          setSettings({
            ...defaults,
            ...data,
            phone: CONTACT_PHONE,
            whatsapp_number: data.whatsapp_number || CONTACT_PHONE,
            address: CONTACT_ADDRESS,
            map_embed_url: CONTACT_MAP_EMBED_URL,
          });
        }
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

export function getMapsLink(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || "")}`;
}
