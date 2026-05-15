import { Helmet } from "react-helmet-async";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export default function Seo({ title, description }: { title?: string; description?: string }) {
  const { settings } = useSiteSettings();
  const t = title ? `${title} | ${settings.company_name}` : settings.seo_title;
  const d = description || settings.seo_description;
  const canonicalUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}`
      : undefined;

  return (
    <Helmet>
      <title>{t}</title>
      <meta name="description" content={d} />
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      <meta property="og:title" content={t} />
      <meta property="og:description" content={d} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={settings.company_name} />
      <meta property="og:locale" content="tr_TR" />
      <meta name="twitter:card" content="summary" />
      <html lang="tr" />
    </Helmet>
  );
}
