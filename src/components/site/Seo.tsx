import { Helmet } from "react-helmet-async";
import { useSiteSettings } from "@/hooks/useSiteSettings";

type JsonLd = Record<string, unknown>;

export type SeoBreadcrumb = {
  name: string;
  path?: string;
  url?: string;
};

type SeoProps = {
  title?: string;
  description?: string;
  canonical?: string;
  noIndex?: boolean;
  structuredData?: JsonLd | JsonLd[];
  breadcrumbs?: SeoBreadcrumb[];
};

const DEFAULT_SITE_URL = "https://akinalinsaat.com";
const TITLE_BRAND = "Akinal İnşaat";

const NAVIGATION_ITEMS = [
  { name: "Ana Sayfa", path: "/" },
  { name: "Hakkımızda", path: "/hakkimizda" },
  { name: "Hizmetlerimiz", path: "/hizmetlerimiz" },
  { name: "Projelerimiz", path: "/projelerimiz" },
  { name: "Kentsel Dönüşüm", path: "/kentsel-donusum" },
  { name: "İletişim", path: "/iletisim" },
];

function getOrigin() {
  if (typeof window !== "undefined") return window.location.origin;
  return DEFAULT_SITE_URL;
}

function getCurrentPath() {
  if (typeof window !== "undefined") return window.location.pathname;
  return "/";
}

function toAbsoluteUrl(value: string | undefined, origin: string) {
  try {
    return new URL(value || "/", origin).toString();
  } catch {
    return origin;
  }
}

function stripEmpty(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripEmpty).filter((item) => item !== undefined);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, item]) => [key, stripEmpty(item)] as const)
        .filter(([, item]) => item !== undefined)
    );
  }

  if (value === null || value === undefined || value === "") return undefined;
  return value;
}

function asJsonLdArray(data?: JsonLd | JsonLd[]) {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

export default function Seo({ title, description, canonical, noIndex, structuredData, breadcrumbs }: SeoProps) {
  const { settings } = useSiteSettings();
  const origin = getOrigin();
  const canonicalUrl = toAbsoluteUrl(canonical || getCurrentPath(), origin);
  const pageTitle = title ? `${TITLE_BRAND} | ${title}` : settings.seo_title;
  const pageDescription = description || settings.seo_description;
  const sameAs = [settings.instagram_url, settings.facebook_url, settings.linkedin_url].filter(Boolean);

  const organizationSchema = stripEmpty({
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${origin}/#organization`,
    name: settings.company_name,
    url: origin,
    telephone: settings.phone,
    email: settings.email,
    address: settings.address
      ? {
          "@type": "PostalAddress",
          streetAddress: settings.address,
          addressCountry: "TR",
        }
      : undefined,
    sameAs: sameAs.length > 0 ? sameAs : undefined,
  }) as JsonLd;

  const websiteSchema = stripEmpty({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    name: settings.company_name,
    url: origin,
    inLanguage: "tr-TR",
    publisher: {
      "@id": `${origin}/#organization`,
    },
  }) as JsonLd;

  const navigationSchema = stripEmpty({
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${origin}/#site-navigation`,
    itemListElement: NAVIGATION_ITEMS.map((item, index) => ({
      "@type": "SiteNavigationElement",
      position: index + 1,
      name: item.name,
      url: toAbsoluteUrl(item.path, origin),
    })),
  }) as JsonLd;

  const breadcrumbSchema = breadcrumbs?.length
    ? (stripEmpty({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbs.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: toAbsoluteUrl(item.url || item.path, origin),
        })),
      }) as JsonLd)
    : undefined;

  const jsonLd = [organizationSchema, websiteSchema, navigationSchema, breadcrumbSchema, ...asJsonLdArray(structuredData)].filter(Boolean) as JsonLd[];

  return (
    <Helmet>
      <html lang="tr" />
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content={settings.company_name} />
      <meta property="og:locale" content="tr_TR" />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDescription} />
      {jsonLd.map((item, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(item)}
        </script>
      ))}
    </Helmet>
  );
}
