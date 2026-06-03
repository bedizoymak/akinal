import Seo from "@/components/site/Seo";
import { Link } from "react-router-dom";
import { ArrowRight, HardHat, Building, Hammer, ClipboardList, FileCheck, ShieldCheck } from "lucide-react";

const SERVICES = [
  { icon: HardHat, slug: "kentsel-donusum", title: "Kentsel Dönüşüm", text: "Riskli yapıların yenilenmesi, fizibilite çalışmaları, hak sahipleriyle süreç yönetimi ve uygulama desteği." },
  { icon: Building, slug: "kat-karsiligi-insaat", title: "Kat Karşılığı İnşaat", text: "Arsa sahipleri için güvenilir, şeffaf ve değer odaklı kat karşılığı proje geliştirme çözümleri." },
  { icon: Hammer, slug: "anahtar-teslim-insaat", title: "Anahtar Teslim İnşaat", text: "Planlamadan teslim aşamasına kadar tüm inşaat sürecinin tek elden profesyonel yönetimi." },
  { icon: ClipboardList, slug: "proje-gelistirme", title: "Proje Geliştirme", text: "Arsa, konum, imar durumu ve yatırım potansiyeline göre uygulanabilir proje senaryolarının oluşturulması." },
  { icon: FileCheck, slug: "ruhsat-ve-resmi-surec-takibi", title: "Ruhsat ve Resmi Süreç Takibi", text: "Belediye, ruhsat, proje onay ve yasal süreçlerin düzenli ve kontrollü şekilde takip edilmesi." },
  { icon: ShieldCheck, slug: "riskli-yapi-danismanligi", title: "Riskli Yapı Danışmanlığı", text: "Bina sahipleri için ön değerlendirme, süreç bilgilendirme ve dönüşüm yol haritası desteği." },
];

export default function Services() {
  return (
    <>
      <Seo
        title="Hizmetlerimiz"
        description="Akinal İnşaat'ın kentsel dönüşüm, kat karşılığı inşaat, anahtar teslim inşaat ve proje geliştirme hizmetlerini inceleyin."
        canonical="/hizmetlerimiz"
        breadcrumbs={[
          { name: "Ana Sayfa", path: "/" },
          { name: "Hizmetlerimiz", path: "/hizmetlerimiz" },
        ]}
      />
      <section className="py-16 md:py-24 bg-gradient-dark text-white">
        <div className="container-narrow">
          <div className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-3">Hizmetlerimiz</div>
          <h1 className="font-display text-4xl md:text-6xl font-bold leading-tight max-w-3xl">Süreç odaklı, mühendislik temelli profesyonel hizmetler.</h1>
        </div>
      </section>
      <section className="py-16 md:py-24">
        <div className="container-narrow grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {SERVICES.map((s) => (
            <Link key={s.title} to={`/hizmetlerimiz/${s.slug}`} className="group p-7 rounded-lg border border-border bg-card hover:border-accent/40 hover:shadow-card-soft transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">
              <div className="h-12 w-12 rounded-md bg-primary text-primary-foreground flex items-center justify-center mb-5">
                <s.icon className="h-6 w-6" />
              </div>
              <h3 className="font-display text-xl font-bold mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.text}</p>
              <span className="mt-5 inline-flex items-center text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                Detaylı bilgi <ArrowRight className="ml-2 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
