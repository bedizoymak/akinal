import { Helmet } from "react-helmet-async";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export default function Seo({ title, description }: { title?: string; description?: string }) {
  const { settings } = useSiteSettings();
  const t = title ? `${title} | ${settings.company_name}` : settings.seo_title;
  const d = description || settings.seo_description;
  return (
    <Helmet>
      <title>{t}</title>
      <meta name="description" content={d} />
      <meta property="og:title" content={t} />
      <meta property="og:description" content={d} />
      <meta property="og:type" content="website" />
      <html lang="tr" />
    </Helmet>
  );
}
