import { Link, useParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeCheck,
  Building,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Compass,
  FileCheck2,
  FileSignature,
  Hammer,
  HardHat,
  Home,
  Landmark,
  MessageCircle,
  Route,
  Ruler,
  ShieldCheck,
  Sparkles,
  Stamp,
  Users,
} from "lucide-react";
import Seo from "@/components/site/Seo";
import { Button } from "@/components/ui/button";
import heroConstruction from "@/assets/hero-construction.jpg";

type Feature = {
  icon: LucideIcon;
  title: string;
  text: string;
};

type ServiceDetail = {
  title: string;
  heroTitle: string;
  subtitle: string;
  description: string;
  scope: Feature[];
  process: string[];
  values: Feature[];
};

const trustItems: Feature[] = [
  {
    icon: Users,
    title: "Uzman ekip",
    text: "Mimari, mühendislik ve saha koordinasyonu aynı hedef etrafında planlanır.",
  },
  {
    icon: FileCheck2,
    title: "Yasal süreç takibi",
    text: "Başvuru, ruhsat ve resmi kurum adımları düzenli biçimde izlenir.",
  },
  {
    icon: MessageCircle,
    title: "Şeffaf iletişim",
    text: "Süreç boyunca kararlar, ilerleme ve kritik başlıklar açık şekilde paylaşılır.",
  },
];

const services: Record<string, ServiceDetail> = {
  "kentsel-donusum": {
    title: "Kentsel Dönüşüm",
    heroTitle: "Kentsel Dönüşüm Hizmetleri",
    subtitle: "Riskli yapıları güvenli, modern ve değerli yaşam alanlarına dönüştüren kontrollü süreç yönetimi.",
    description:
      "Kentsel dönüşüm; mevcut yapının teknik, hukuki ve ekonomik açıdan değerlendirilmesiyle başlayan, proje geliştirme, hak sahipleriyle mutabakat, ruhsat ve uygulama adımlarıyla ilerleyen kapsamlı bir yenileme sürecidir. Akinal İnşaat olarak bu süreci yalnızca inşaat uygulaması olarak değil, güven, planlama ve iletişim gerektiren bütüncül bir hizmet olarak ele alıyoruz.",
    scope: [
      { icon: ShieldCheck, title: "Riskli yapı planlaması", text: "Mevcut durum, hak sahipleri ve uygulama koşulları birlikte değerlendirilir." },
      { icon: Users, title: "Hak sahibi iletişimi", text: "Kat malikleriyle anlaşılır, düzenli ve güven veren bir iletişim dili kurulur." },
      { icon: Ruler, title: "Mimari ve teknik çözüm", text: "Yeni yapının kullanım değeri, güvenliği ve proje verimliliği birlikte düşünülür." },
      { icon: ClipboardCheck, title: "Uygulama kontrolü", text: "Ruhsattan teslim aşamasına kadar saha süreci kontrollü şekilde ilerletilir." },
    ],
    process: ["Ön görüşme ve yapı değerlendirmesi", "Fizibilite ve teklif modeli", "Hak sahipleriyle mutabakat", "Proje, ruhsat ve resmi süreçler", "İnşaat uygulaması ve teslim"],
    values: [
      { icon: BadgeCheck, title: "Güvenli dönüşüm yaklaşımı", text: "Kararları teknik gereklilikler, mevzuat ve uzun vadeli kullanım değeriyle birlikte ele alırız." },
      { icon: Route, title: "Net yol haritası", text: "Sürecin her aşamasında ne yapılacağını, hangi adımın neden gerekli olduğunu açıklarız." },
      { icon: Sparkles, title: "Değer artıran sonuç", text: "Yeni yapının estetik, fonksiyon ve yatırım değerini güçlendiren çözümler üretiriz." },
    ],
  },
  "kat-karsiligi-insaat": {
    title: "Kat Karşılığı İnşaat",
    heroTitle: "Kat Karşılığı İnşaat Hizmetleri",
    subtitle: "Arsa sahipleri için güvenilir, şeffaf ve değer odaklı proje geliştirme modeli.",
    description:
      "Kat karşılığı inşaat, arsa sahibinin taşınmaz değerini doğru projelendirme ve güvenilir uygulama ile geliştiren stratejik bir iş birliği modelidir. Bu süreçte imar durumu, lokasyon, paylaşım modeli, sözleşme kapsamı ve teslim kalitesi birlikte değerlendirilmelidir.",
    scope: [
      { icon: Landmark, title: "Arsa analizi", text: "Konum, imar koşulları ve proje potansiyeli teknik açıdan incelenir." },
      { icon: FileSignature, title: "Sözleşme hazırlığı", text: "Paylaşım modeli, teslim kapsamı ve sorumluluklar netleştirilir." },
      { icon: Building, title: "Proje geliştirme", text: "Arsanın değerini artıracak mimari ve ticari senaryolar oluşturulur." },
      { icon: Hammer, title: "Kontrollü uygulama", text: "İnşaat süreci kalite, zaman ve iletişim odağıyla yürütülür." },
    ],
    process: ["Arsa ve beklenti analizi", "Fizibilite ve paylaşım modeli", "Sözleşme ve kapsam netliği", "Proje ve ruhsat hazırlığı", "İnşaat, kontrol ve teslim"],
    values: [
      { icon: BadgeCheck, title: "Şeffaf teklif modeli", text: "Arsa sahibi için paylaşım ve teslim başlıklarını anlaşılır hale getiririz." },
      { icon: Compass, title: "Doğru proje kurgusu", text: "Konuma ve pazar beklentisine uygun, uygulanabilir proje senaryosu geliştiririz." },
      { icon: Home, title: "Teslim odaklı yönetim", text: "Taahhüt edilen kapsamın sahada karşılık bulması için süreci yakından takip ederiz." },
    ],
  },
  "anahtar-teslim-insaat": {
    title: "Anahtar Teslim İnşaat",
    heroTitle: "Anahtar Teslim İnşaat Hizmetleri",
    subtitle: "Tasarım, ruhsat, uygulama ve teslim adımlarını tek merkezden yöneten kapsamlı yapı çözümü.",
    description:
      "Anahtar teslim inşaat; işverenin proje boyunca farklı ekipleri ayrı ayrı yönetme yükünü azaltan, planlama ve uygulama sorumluluğunu bütüncül şekilde ele alan bir hizmettir. Bütçe, süre, malzeme kalitesi ve saha koordinasyonu tek plan üzerinden ilerler.",
    scope: [
      { icon: ClipboardList, title: "Kapsam planlaması", text: "İhtiyaçlar, bütçe ve teslim beklentisi başlangıçta netleştirilir." },
      { icon: Ruler, title: "Proje koordinasyonu", text: "Mimari, statik ve uygulama detayları bütünlüklü şekilde yönetilir." },
      { icon: Hammer, title: "Saha uygulaması", text: "Kaba inşaat ve ince işler kontrollü bir iş programıyla ilerletilir." },
      { icon: CheckCircle2, title: "Teslim kontrolü", text: "Son kontroller tamamlanarak yapı kullanıma hazır şekilde teslim edilir." },
    ],
    process: ["İhtiyaç analizi", "Bütçe ve iş programı", "Proje ve ruhsat koordinasyonu", "Kaba ve ince inşaat uygulaması", "Kontrol, eksik tamamlama ve teslim"],
    values: [
      { icon: Route, title: "Tek muhatap kolaylığı", text: "İşveren için süreç takibini sadeleştirir, kararları düzenli hale getiririz." },
      { icon: ShieldCheck, title: "Kalite kontrol disiplini", text: "Malzeme, işçilik ve uygulama detaylarını teslim hedefiyle birlikte denetleriz." },
      { icon: MessageCircle, title: "Düzenli bilgilendirme", text: "Saha ilerleyişi ve kritik kararlar hakkında anlaşılır bilgi akışı sağlarız." },
    ],
  },
  "proje-gelistirme": {
    title: "Proje Geliştirme",
    heroTitle: "Proje Geliştirme Hizmetleri",
    subtitle: "Arsa, konum ve yatırım hedeflerini uygulanabilir mimari fikirlere dönüştüren stratejik yaklaşım.",
    description:
      "Proje geliştirme, bir arsa veya yapının yalnızca mevcut durumuna değil, taşıdığı potansiyele bakmayı gerektirir. İmar koşulları, hedef kullanıcı, maliyet dengesi, satış değeri ve uygulama kabiliyeti birlikte değerlendirilerek güçlü bir proje omurgası oluşturulur.",
    scope: [
      { icon: Compass, title: "Potansiyel analizi", text: "Lokasyon, imar ve hedef kullanım bakımından güçlü yönler belirlenir." },
      { icon: Sparkles, title: "Konsept geliştirme", text: "Projenin mimari fikri, hedef kitlesi ve değer önerisi kurgulanır." },
      { icon: ClipboardCheck, title: "Fizibilite çalışması", text: "Maliyet, süre ve uygulanabilirlik başlıkları birlikte değerlendirilir." },
      { icon: Building, title: "Uygulama hazırlığı", text: "Projenin sahaya taşınabilmesi için teknik ve resmi adımlar planlanır." },
    ],
    process: ["Arsa ve hedef analizi", "Konsept ve kullanım senaryosu", "Maliyet ve değer fizibilitesi", "Projelendirme planı", "Uygulama ve pazarlama hazırlığı"],
    values: [
      { icon: BadgeCheck, title: "Gerçekçi fizibilite", text: "Sadece iyi görünen değil, uygulanabilir ve sürdürülebilir projeler geliştiririz." },
      { icon: Ruler, title: "Mimari değer", text: "Fonksiyon, estetik ve kullanıcı deneyimini proje kararlarının merkezine alırız." },
      { icon: Landmark, title: "Yatırım odağı", text: "Projenin bölge, hedef kitle ve değer artışı potansiyelini birlikte ele alırız." },
    ],
  },
  "ruhsat-ve-resmi-surec-takibi": {
    title: "Ruhsat ve Resmi Süreç Takibi",
    heroTitle: "Ruhsat ve Resmi Süreç Takibi",
    subtitle: "İnşaat projelerinde resmi başvuru, belge ve onay adımlarını düzenli şekilde takip eden süreç desteği.",
    description:
      "Ruhsat ve resmi süreçler, inşaat projelerinin zamanında ve doğru ilerlemesi için kritik öneme sahiptir. Eksik belge, yanlış başvuru veya takip edilmeyen kurum adımları projenin takvimini etkileyebilir. Bu nedenle süreç baştan planlanmalı ve düzenli izlenmelidir.",
    scope: [
      { icon: FileCheck2, title: "Belge kontrolü", text: "Gerekli evrak, proje dosyası ve başvuru hazırlıkları gözden geçirilir." },
      { icon: Landmark, title: "Kurum takibi", text: "Belediye ve ilgili kurum süreçleri düzenli şekilde izlenir." },
      { icon: ClipboardList, title: "Eksik tamamlama", text: "Talep edilen düzeltme ve ek belgeler kontrollü biçimde yönetilir." },
      { icon: Stamp, title: "Onay süreci", text: "Ruhsat ve resmi onay adımlarının ilerleyişi şeffaf biçimde raporlanır." },
    ],
    process: ["Mevcut dosya incelemesi", "Başvuru planı ve evrak listesi", "Kurum başvuruları", "Revizyon ve eksiklerin tamamlanması", "Ruhsat ve onay takibi"],
    values: [
      { icon: Route, title: "Planlı resmi süreç", text: "Hangi adımın ne zaman ve hangi belgeyle ilerleyeceğini netleştiririz." },
      { icon: MessageCircle, title: "Düzenli bilgilendirme", text: "Başvuru ve kurum süreçlerinde gelişmeleri anlaşılır şekilde paylaşırız." },
      { icon: ShieldCheck, title: "Mevzuat hassasiyeti", text: "Projenin resmi gerekliliklerle uyumlu ilerlemesine özen gösteririz." },
    ],
  },
  "riskli-yapi-danismanligi": {
    title: "Riskli Yapı Danışmanlığı",
    heroTitle: "Riskli Yapı Danışmanlığı",
    subtitle: "Mülk sahipleri için teknik, yasal ve süreç odaklı anlaşılır dönüşüm rehberliği.",
    description:
      "Riskli yapı süreci, mülk sahiplerinin doğru bilgiyle karar almasını gerektirir. Yapının durumu, resmi süreçler, hak sahiplerinin beklentileri ve dönüşüm alternatifleri birlikte değerlendirilerek güvenli bir yol haritası oluşturulmalıdır.",
    scope: [
      { icon: ShieldCheck, title: "Ön değerlendirme", text: "Yapının süreç açısından hangi başlıklarda incelenmesi gerektiği belirlenir." },
      { icon: Users, title: "Hak sahibi bilgilendirmesi", text: "Teknik ve resmi konular anlaşılır bir dille aktarılır." },
      { icon: ClipboardCheck, title: "Seçenek karşılaştırması", text: "Dönüşüm, yenileme ve proje geliştirme alternatifleri değerlendirilir." },
      { icon: Route, title: "Yol haritası", text: "Karar, başvuru ve uygulama adımları için takip edilebilir plan hazırlanır." },
    ],
    process: ["Ön görüşme", "Belge ve yapı bilgisi inceleme", "Süreç seçeneklerinin değerlendirilmesi", "Hak sahipleri için bilgilendirme", "Uygulama modeline yönlendirme"],
    values: [
      { icon: BadgeCheck, title: "Anlaşılır danışmanlık", text: "Karmaşık teknik ve resmi başlıkları sade, karar alınabilir hale getiririz." },
      { icon: FileCheck2, title: "Resmi süreç farkındalığı", text: "Başvuru, belge ve kurum adımlarında dikkat edilmesi gerekenleri planlarız." },
      { icon: Home, title: "Güvenli gelecek odağı", text: "Amaç yalnızca süreci başlatmak değil, doğru dönüşüm kararına ulaşmaktır." },
    ],
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
        title={service.title}
        description={service.subtitle}
        breadcrumbs={[
          { name: "Ana Sayfa", path: "/" },
          { name: "Hizmetlerimiz", path: "/hizmetlerimiz" },
          { name: service.title, path: `/hizmetlerimiz/${slug}` },
        ]}
      />
      <main>
        <section
          className="relative overflow-hidden bg-secondary text-white"
          style={{
            backgroundImage: `linear-gradient(115deg, rgba(9, 18, 14, 0.94) 0%, rgba(12, 34, 23, 0.82) 52%, rgba(12, 34, 23, 0.42) 100%), url(${heroConstruction})`,
            backgroundPosition: "center",
            backgroundSize: "cover",
          }}
        >
          <div className="container-narrow py-16 md:py-24">
            <div className="max-w-4xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Hizmetlerimiz</p>
              <h1 className="mt-4 font-display text-4xl font-bold leading-tight md:text-6xl">{service.heroTitle}</h1>
              <p className="mt-6 max-w-3xl text-base leading-relaxed text-white/82 md:text-lg">{service.subtitle}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="bg-accent hover:bg-accent-glow text-accent-foreground">
                  <Link to="/iletisim">
                    Bizimle İletişime Geçin
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="border-white/30 bg-white/10 text-white hover:bg-white hover:text-foreground">
                  <Link to="/projelerimiz">Projeleri İncele</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="container-narrow py-14 md:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Hizmet nedir?</p>
              <h2 className="mt-3 font-display text-3xl font-semibold text-foreground md:text-4xl">{service.title} kapsamında nasıl çalışıyoruz?</h2>
            </div>
            <div className="rounded-lg border border-border bg-card p-6 shadow-card-soft md:p-8">
              <p className="text-base leading-relaxed text-muted-foreground">{service.description}</p>
            </div>
          </div>
        </section>

        <section className="bg-surface-light py-14 md:py-20">
          <div className="container-narrow">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Neleri kapsar?</p>
              <h2 className="mt-3 font-display text-3xl font-semibold text-foreground md:text-4xl">Başlıca hizmet kapsamı</h2>
            </div>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {service.scope.map((item) => (
                <article key={item.title} className="rounded-lg border border-border bg-card p-6 shadow-card-soft">
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 font-display text-xl font-bold text-foreground">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="container-narrow py-14 md:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Süreç nasıl işler?</p>
              <h2 className="mt-3 font-display text-3xl font-semibold text-foreground md:text-4xl">Planlı, takip edilebilir ve şeffaf ilerleme</h2>
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground md:text-base">
                Her hizmette ilk değerlendirmeden teslim veya yönlendirme aşamasına kadar net adımlar belirler, süreci karar alınabilir hale getiririz.
              </p>
            </div>
            <ol className="space-y-4">
              {service.process.map((step, index) => (
                <li key={step} className="flex gap-4 rounded-lg border border-border bg-card p-5 shadow-card-soft">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold text-foreground">{step}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Bu adımda ihtiyaçlar netleştirilir, sorumluluklar belirlenir ve bir sonraki aşama için hazırlık yapılır.</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bg-gradient-dark py-14 text-white md:py-20">
          <div className="container-narrow">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Neden bizi tercih etmelisiniz?</p>
              <h2 className="mt-3 font-display text-3xl font-semibold md:text-4xl">Teknik disiplin, güçlü iletişim ve güvenilir süreç yönetimi</h2>
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {service.values.map((item) => (
                <article key={item.title} className="rounded-lg border border-white/10 bg-white/[0.06] p-6">
                  <item.icon className="h-8 w-8 text-accent" />
                  <h3 className="mt-5 font-display text-xl font-bold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-white/70">{item.text}</p>
                </article>
              ))}
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {trustItems.map((item) => (
                <article key={item.title} className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
                  <div className="flex items-center gap-3">
                    <item.icon className="h-5 w-5 text-accent" />
                    <h3 className="font-semibold">{item.title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-white/65">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="container-narrow py-14 md:py-20">
          <div className="rounded-lg bg-gradient-accent p-8 text-white shadow-accent-glow md:p-10 lg:flex lg:items-center lg:justify-between lg:gap-10">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Teklif ve ön değerlendirme</p>
              <h2 className="mt-3 font-display text-3xl font-bold md:text-4xl">Projeniz için teklif alın</h2>
              <p className="mt-4 text-sm leading-relaxed text-white/82 md:text-base">
                İhtiyacınızı birlikte değerlendirelim, projeniz için en doğru başlangıç adımını netleştirelim.
              </p>
            </div>
            <Button asChild size="lg" className="mt-7 bg-white text-primary hover:bg-white/90 lg:mt-0">
              <Link to="/iletisim">
                İletişime Geç
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>
    </>
  );
}
