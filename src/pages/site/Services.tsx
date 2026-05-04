import Seo from "@/components/site/Seo";
import { HardHat, Building, Hammer, ClipboardList, FileCheck, ShieldCheck, Home as HomeIcon, Store } from "lucide-react";

const SERVICES = [
  { icon: HardHat, title: "Kentsel Dönüşüm", text: "Riskli yapıların yenilenmesi, fizibilite çalışmaları, hak sahipleriyle süreç yönetimi ve uygulama desteği." },
  { icon: Building, title: "Kat Karşılığı İnşaat", text: "Arsa sahipleri için güvenilir, şeffaf ve kazanç odaklı kat karşılığı proje geliştirme çözümleri." },
  { icon: Hammer, title: "Anahtar Teslim İnşaat", text: "Planlamadan teslim aşamasına kadar tüm inşaat sürecinin tek elden profesyonel yönetimi." },
  { icon: ClipboardList, title: "Proje Geliştirme", text: "Arsa, konum, imar durumu ve yatırım potansiyeline göre uygulanabilir proje senaryolarının oluşturulması." },
  { icon: FileCheck, title: "Ruhsat ve Resmi Süreç Takibi", text: "Belediye, ruhsat, proje onay ve yasal süreçlerin düzenli ve kontrollü şekilde takip edilmesi." },
  { icon: ShieldCheck, title: "Riskli Yapı Danışmanlığı", text: "Bina sahipleri için ön değerlendirme, süreç bilgilendirme ve dönüşüm yol haritası desteği." },
  { icon: HomeIcon, title: "Konut Projeleri", text: "Modern, güvenli ve fonksiyonel konut projelerinin geliştirilmesi ve uygulaması." },
  { icon: Store, title: "Ticari Projeler", text: "Ofis, mağaza ve karma kullanımlı ticari projelerin planlanması ve inşası." },
];

export default function Services() {
  return (
    <>
      <Seo title="Hizmetlerimiz" description="Kentsel dönüşüm, kat karşılığı inşaat, anahtar teslim ve proje geliştirme hizmetleri." />
      <section className="py-16 md:py-24 bg-gradient-dark text-white">
        <div className="container-narrow">
          <div className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-3">Hizmetlerimiz</div>
          <h1 className="font-display text-4xl md:text-6xl font-bold leading-tight max-w-3xl">Süreç odaklı, mühendislik temelli profesyonel hizmetler.</h1>
        </div>
      </section>
      <section className="py-16 md:py-24">
        <div className="container-narrow grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {SERVICES.map((s) => (
            <div key={s.title} className="p-7 rounded-lg border border-border bg-card hover:border-accent/40 hover:shadow-card-soft transition-all">
              <div className="h-12 w-12 rounded-md bg-primary text-primary-foreground flex items-center justify-center mb-5">
                <s.icon className="h-6 w-6" />
              </div>
              <h3 className="font-display text-xl font-bold mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
