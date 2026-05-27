import { Link, useParams } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import Seo from "@/components/site/Seo";
import { Button } from "@/components/ui/button";

type ServiceDetail = {
  title: string;
  description: string;
  points: string[];
  process: string[];
};

const services: Record<string, ServiceDetail> = {
  "kentsel-donusum": {
    title: "Kentsel Dönüşüm",
    description:
      "Riskli yapıların güvenli, modern ve değer kazandıran yaşam alanlarına dönüşmesi için proje, resmi süreç ve uygulama adımlarını birlikte yönetiyoruz.",
    points: [
      "Riskli yapı sürecinin doğru planlanması",
      "Kat malikleriyle şeffaf iletişim ve teklif yönetimi",
      "Modern mimari, sağlam mühendislik ve kontrollü uygulama",
      "Teslim sonrasına kadar düzenli süreç takibi",
    ],
    process: ["Ön inceleme", "Teklif ve mutabakat", "Projelendirme", "Ruhsat süreci", "Uygulama ve teslim"],
  },
  "kat-karsiligi-insaat": {
    title: "Kat Karşılığı İnşaat",
    description:
      "Arsa sahipleri için güvenilir, şeffaf ve değer odaklı kat karşılığı inşaat çözümleri geliştiriyoruz.",
    points: [
      "Arsa ve imar durumuna uygun proje değerlendirmesi",
      "Paylaşım modeli ve teslim kapsamının netleştirilmesi",
      "Mimari, statik ve uygulama süreçlerinin koordinasyonu",
      "Kaliteli malzeme ve zamanında teslim yaklaşımı",
    ],
    process: ["Arsa analizi", "Fizibilite", "Sözleşme hazırlığı", "Proje ve ruhsat", "İnşaat ve teslim"],
  },
  "anahtar-teslim-insaat": {
    title: "Anahtar Teslim İnşaat",
    description:
      "Tasarım, ruhsat, kaba inşaat, ince işler ve teslim aşamalarını tek elden planlayarak anahtar teslim yapı çözümleri sunuyoruz.",
    points: [
      "Başlangıçtan teslimata kadar tek sorumlu yapı",
      "Bütçe, süre ve kalite kontrolünün birlikte yönetilmesi",
      "Konut ve ticari alanlara uygun uygulama planı",
      "Şantiye sürecinde düzenli bilgilendirme",
    ],
    process: ["İhtiyaç analizi", "Proje planı", "Bütçe ve takvim", "Uygulama", "Kontrol ve teslim"],
  },
  "proje-gelistirme": {
    title: "Proje Geliştirme",
    description:
      "Arsa, yapı ve yatırım hedeflerini birlikte değerlendirerek uygulanabilir, estetik ve ekonomik projeler geliştiriyoruz.",
    points: [
      "Lokasyon ve potansiyel değerlendirmesi",
      "İmar koşullarına uygun konsept oluşturma",
      "Maliyet, satış ve uygulama dengesi",
      "Yatırım değerini artıran proje yaklaşımı",
    ],
    process: ["Potansiyel analizi", "Konsept çalışma", "Fizibilite", "Projelendirme", "Uygulama hazırlığı"],
  },
  "ruhsat-ve-resmi-surec-takibi": {
    title: "Ruhsat ve Resmi Süreç Takibi",
    description:
      "İnşaat projelerinde gerekli resmi başvuru, belge ve ruhsat süreçlerinin düzenli şekilde takip edilmesine destek oluyoruz.",
    points: [
      "İmar ve mevzuat kontrollerinin yapılması",
      "Gerekli evrak ve başvuru adımlarının planlanması",
      "Belediye ve ilgili kurum süreçlerinin takibi",
      "Proje ilerleyişi için düzenli bilgilendirme",
    ],
    process: ["Dosya kontrolü", "Başvuru hazırlığı", "Kurum takibi", "Eksiklerin tamamlanması", "Ruhsat süreci"],
  },
  "riskli-yapi-danismanligi": {
    title: "Riskli Yapı Danışmanlığı",
    description:
      "Riskli yapı sürecinde mülk sahiplerinin doğru bilgiyle hareket edebilmesi için teknik ve süreç odaklı danışmanlık sağlıyoruz.",
    points: [
      "Mevcut yapının süreç açısından değerlendirilmesi",
      "Hak sahipleri için anlaşılır bilgilendirme",
      "Kentsel dönüşüm seçeneklerinin karşılaştırılması",
      "Güvenli dönüşüm için yol haritası hazırlanması",
    ],
    process: ["Ön görüşme", "Belge inceleme", "Süreç planı", "Teklif değerlendirme", "Uygulama yönlendirmesi"],
  },
};

export default function ServiceDetailPage() {
  const { slug } = useParams();
  const service = slug ? services[slug] : undefined;

  if (!service) {
    return (
      <main className="pt-28">
        <section className="container-narrow py-20 text-center">
          <p className="text-sm uppercase tracking-widest text-primary font-semibold">Hizmetlerimiz</p>
          <h1 className="font-display text-4xl mt-3 text-foreground">Hizmet bulunamadı</h1>
          <p className="mt-4 text-muted-foreground">Aradığınız hizmet sayfası taşınmış veya yayından kaldırılmış olabilir.</p>
          <Button asChild className="mt-8">
            <Link to="/hizmetlerimiz">Tüm Hizmetleri Gör</Link>
          </Button>
        </section>
      </main>
    );
  }

  return (
    <>
      <Seo
        title={`${service.title} | AKİNAL İNŞAAT`}
        description={service.description}
        breadcrumbs={[
          { name: "Ana Sayfa", path: "/" },
          { name: "Hizmetlerimiz", path: "/hizmetlerimiz" },
          { name: service.title, path: `/hizmetlerimiz/${slug}` },
        ]}
      />
      <main className="pt-28">
        <section className="bg-secondary/60 border-b border-border/70">
          <div className="container-narrow py-16 md:py-20">
            <p className="text-sm uppercase tracking-widest text-primary font-semibold">Hizmetlerimiz</p>
            <h1 className="font-display text-4xl md:text-6xl font-bold text-foreground mt-4">{service.title}</h1>
            <p className="mt-6 max-w-3xl text-lg text-muted-foreground leading-relaxed">{service.description}</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg">
                <Link to="/iletisim">
                  Teklif ve Bilgi Al
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/projelerimiz">Projeleri İncele</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="container-narrow py-16 grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h2 className="font-display text-3xl font-semibold text-foreground">Bu hizmette neler yapıyoruz?</h2>
            <div className="mt-6 grid gap-4">
              {service.points.map((point) => (
                <div key={point} className="flex gap-3 rounded-lg border border-border bg-card p-4 shadow-card-soft">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground leading-relaxed">{point}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-lg border border-border bg-card p-6 shadow-card-soft h-fit">
            <h2 className="font-display text-2xl font-semibold text-foreground">Süreç nasıl ilerler?</h2>
            <ol className="mt-6 space-y-4">
              {service.process.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <span className="text-sm text-muted-foreground pt-1">{step}</span>
                </li>
              ))}
            </ol>
          </aside>
        </section>
      </main>
    </>
  );
}
