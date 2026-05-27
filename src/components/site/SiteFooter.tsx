import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, Instagram, Facebook, Linkedin } from "lucide-react";
import { getMapsLink, getTelLink, useSiteSettings } from "@/hooks/useSiteSettings";
import logoImg from "@/assets/logo.png";

const menuLinks = [
  { label: "Ana Sayfa", to: "/" },
  { label: "Hakkımızda", to: "/hakkimizda" },
  { label: "Hizmetlerimiz", to: "/hizmetlerimiz" },
  { label: "Projelerimiz", to: "/projelerimiz" },
  { label: "Kentsel Dönüşüm", to: "/kentsel-donusum" },
  { label: "İletişim", to: "/iletisim" },
];

const serviceLinks = [
  { label: "Kentsel Dönüşüm", to: "/hizmetlerimiz/kentsel-donusum" },
  { label: "Kat Karşılığı İnşaat", to: "/hizmetlerimiz/kat-karsiligi-insaat" },
  { label: "Anahtar Teslim İnşaat", to: "/hizmetlerimiz/anahtar-teslim-insaat" },
  { label: "Proje Geliştirme", to: "/hizmetlerimiz/proje-gelistirme" },
  { label: "Ruhsat ve Resmi Süreç Takibi", to: "/hizmetlerimiz/ruhsat-ve-resmi-surec-takibi" },
  { label: "Riskli Yapı Danışmanlığı", to: "/hizmetlerimiz/riskli-yapi-danismanligi" },
];

const legalLinks = [
  { label: "Gizlilik Politikası", to: "/gizlilik-politikasi" },
  { label: "Çerez Politikası", to: "/cerez-politikasi" },
  { label: "Kullanım Şartları", to: "/kullanim-sartlari" },
];

export default function SiteFooter() {
  const { settings } = useSiteSettings();
  const currentYear = new Date().getFullYear();
  const companyName = settings.company_name || "Şirket";

  return (
    <footer className="relative z-40 bg-gradient-dark text-white mt-24">
      <div className="container-narrow py-16 grid gap-12 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link to="/" className="inline-flex items-center" aria-label={companyName}>
            <div className="bg-white rounded-md p-3 shadow-card-soft inline-flex">
              <img src={logoImg} alt={companyName} className="h-12 w-auto object-contain" />
            </div>
          </Link>
          <p className="mt-5 text-sm text-white/70 leading-relaxed">{settings.footer_description}</p>
          <div className="flex gap-3 mt-5">
            {settings.instagram_url && <a href={settings.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram" className="p-2 rounded-md bg-white/10 hover:bg-accent transition-colors"><Instagram className="h-4 w-4" /></a>}
            {settings.facebook_url && <a href={settings.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook" className="p-2 rounded-md bg-white/10 hover:bg-accent transition-colors"><Facebook className="h-4 w-4" /></a>}
            {settings.linkedin_url && <a href={settings.linkedin_url} target="_blank" rel="noreferrer" aria-label="LinkedIn" className="p-2 rounded-md bg-white/10 hover:bg-accent transition-colors"><Linkedin className="h-4 w-4" /></a>}
          </div>
        </div>

        <div>
          <h4 className="font-display text-sm uppercase tracking-widest text-accent mb-5">Menü</h4>
          <ul className="space-y-3 text-sm">
            {menuLinks.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="text-white/75 hover:text-white transition-colors">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-display text-sm uppercase tracking-widest text-accent mb-5">Hizmetler</h4>
          <ul className="space-y-3 text-sm">
            {serviceLinks.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="text-white/75 hover:text-white transition-colors">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-display text-sm uppercase tracking-widest text-accent mb-5">İletişim</h4>
          <ul className="space-y-3 text-sm text-white/75">
            {settings.phone && <li className="flex items-start gap-3"><Phone className="h-4 w-4 mt-0.5 text-accent shrink-0" /> <a href={getTelLink(settings.phone)} className="hover:text-white">{settings.phone}</a></li>}
            {settings.email && <li className="flex items-start gap-3"><Mail className="h-4 w-4 mt-0.5 text-accent shrink-0" /> <a href={`mailto:${settings.email}`} className="hover:text-white break-all">{settings.email}</a></li>}
            {settings.address && <li className="flex items-start gap-3"><MapPin className="h-4 w-4 mt-0.5 text-accent shrink-0" /> <a href={getMapsLink(settings.address)} target="_blank" rel="noreferrer" className="hover:text-white">{settings.address}</a></li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-narrow py-5 grid gap-3 text-center text-xs text-white/55 md:grid-cols-3 md:items-center md:text-left">
          <p>© {currentYear} Akinal İnşaat Ltd. Şti.</p>
          <nav aria-label="Yasal bağlantılar" className="flex flex-wrap justify-center gap-x-4 gap-y-2">
            {legalLinks.map((item) => (
              <Link key={item.to} to={item.to} className="hover:text-white transition-colors">
                {item.label}
              </Link>
            ))}
          </nav>
          <p className="text-white/40 md:text-right">
            made by{" "}
            <a
              href="https://eclipsemuhendislik.com/?ref=akinal"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white/65"
            >
              Eclipse Mühendislik
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
