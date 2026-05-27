import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_SITE_ADDRESS = "Molla Gürani Mah. Sarı Musa Sk. NO:49/A 34349 Fatih/İstanbul/Türkiye";

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
  company_name: "",
  phone: "",
  whatsapp_number: "",
  email: "",
  address: DEFAULT_SITE_ADDRESS,
  map_embed_url: null,
  instagram_url: null,
  facebook_url: null,
  linkedin_url: null,
  footer_description: "",
  hero_title: "",
  hero_subtitle: "",
  whatsapp_message: "",
  seo_title: "İnşaat ve Kentsel Dönüşüm",
  seo_description: "İnşaat, kentsel dönüşüm ve proje geliştirme hizmetleri.",
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
            address: data.address || defaults.address,
            whatsapp_number: data.whatsapp_number || data.phone || "",
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
