import { useEffect, useState } from "react";
import { getSiteSettings } from "@/lib/apiClient";
import type { SiteSettings as ApiSiteSettings } from "@/lib/apiTypes";

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
  favicon_url: string | null;
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
  favicon_url: "/favicon.png",
  whatsapp_message: "",
  seo_title: "İnşaat ve Kentsel Dönüşüm",
  seo_description: "İnşaat, kentsel dönüşüm ve proje geliştirme hizmetleri.",
};

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(defaults);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    getSiteSettings()
      .then((data) => {
        if (!alive) return;
        if (data) {
          const nextSettings = {
            ...defaults,
            ...(data as ApiSiteSettings),
            company_name: data.company_name || defaults.company_name,
            phone: data.phone || defaults.phone,
            email: data.email || defaults.email,
            address: data.address || defaults.address,
            whatsapp_number: data.whatsapp_number || data.phone || "",
            footer_description: data.footer_description || defaults.footer_description,
            hero_title: data.hero_title || defaults.hero_title,
            hero_subtitle: data.hero_subtitle || defaults.hero_subtitle,
            favicon_url: data.favicon_url || defaults.favicon_url,
            whatsapp_message: data.whatsapp_message || defaults.whatsapp_message,
            seo_title: data.seo_title || defaults.seo_title,
            seo_description: data.seo_description || defaults.seo_description,
          };
          setSettings(nextSettings);
          applyFavicon(nextSettings.favicon_url);
        }
      })
      .catch((error) => {
        console.error("Site settings API error:", error);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
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

function applyFavicon(faviconUrl: string | null) {
  if (typeof document === "undefined") return;
  const href = faviconUrl || "/favicon.png";
  const extension = href.split("?")[0].split(".").pop()?.toLowerCase();
  const type = extension === "svg" ? "image/svg+xml" : extension === "ico" ? "image/x-icon" : extension === "webp" ? "image/webp" : "image/png";
  const selectors = ['link[rel="icon"]', 'link[rel="shortcut icon"]'];
  let link = document.querySelector<HTMLLinkElement>(selectors.join(", "));
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = type;
  link.href = href;
}

export function getMapsLink(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || "")}`;
}
