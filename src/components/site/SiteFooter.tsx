import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, Instagram, Facebook, Linkedin } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import logoImg from "@/assets/logo.png";

export default function SiteFooter() {
  const { settings } = useSiteSettings();
  return (
    <footer className="bg-gradient-dark text-white mt-24">
      <div className="container-narrow py-16 grid gap-12 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link to="/" className="inline-flex items-center" aria-label="Akınal İnşaat">
            <div className="bg-white rounded-md p-3 shadow-card-soft inline-flex">
              <img src={logoImg} alt="Akınal İnşaat" className="h-12 w-auto object-contain" />
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
            <li><Link to="/" className="text-white/75 hover:text-white">Ana Sayfa</Link></li>
            <li><Link to="/hakkimizda" className="text-white/75 hover:text-white">Hakkımızda</Link></li>
            <li><Link to="/hizmetlerimiz" className="text-white/75 hover:text-white">Hizmetlerimiz</Link></li>
            <li><Link to="/projelerimiz" className="text-white/75 hover:text-white">Projelerimiz</Link></li>
            <li><Link to="/kentsel-donusum" className="text-white/75 hover:text-white">Kentsel Dönüşüm</Link></li>
            <li><Link to="/iletisim" className="text-white/75 hover:text-white">İletişim</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-display text-sm uppercase tracking-widest text-accent mb-5">Hizmetler</h4>
          <ul className="space-y-3 text-sm text-white/75">
            <li>Kentsel Dönüşüm</li>
            <li>Kat Karşılığı İnşaat</li>
            <li>Anahtar Teslim İnşaat</li>
            <li>Proje Geliştirme</li>
            <li>Ruhsat ve Resmi Süreç Takibi</li>
            <li>Riskli Yapı Danışmanlığı</li>
          </ul>
        </div>

        <div>
          <h4 className="font-display text-sm uppercase tracking-widest text-accent mb-5">İletişim</h4>
          <ul className="space-y-3 text-sm text-white/75">
            <li className="flex items-start gap-3"><Phone className="h-4 w-4 mt-0.5 text-accent shrink-0" /> <span>{settings.phone}</span></li>
            <li className="flex items-start gap-3"><Mail className="h-4 w-4 mt-0.5 text-accent shrink-0" /> <span>{settings.email}</span></li>
            <li className="flex items-start gap-3"><MapPin className="h-4 w-4 mt-0.5 text-accent shrink-0" /> <span>{settings.address}</span></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-narrow py-5 text-center text-xs text-white/55">
          © 2026 {settings.company_name}. Tüm hakları saklıdır.
        </div>
      </div>
    </footer>
  );
}
