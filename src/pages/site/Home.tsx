import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ShieldCheck,
  Compass,
  Layers,
  HardHat,
  Building,
  FileCheck,
  Hammer,
  ClipboardList,
  Search,
  FileSignature,
  Stamp,
  Package,
  MessageCircle,
  Phone as PhoneIcon,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPublishedProjects } from "@/lib/apiClient";
import ProjectCard, { ProjectCardData } from "@/components/site/ProjectCard";
import Seo from "@/components/site/Seo";
import { useSiteSettings, getWhatsAppLink, getTelLink } from "@/hooks/useSiteSettings";
import heroImg from "@/assets/hero-construction.jpg";
import sampleProject1 from "@/assets/sample-project-1.jpg";
import sampleProject2 from "@/assets/sample-project-2.jpg";
import sampleProject3 from "@/assets/sample-project-3.jpg";
import blueprintPattern from "@/assets/homepage/blueprint-pattern.svg";
import urbanSilhouette from "@/assets/homepage/urban-silhouette.svg";

const TRUST = ["Kentsel Dönüşüm Uzmanlığı", "Şeffaf Süreç Yönetimi", "Anahtar Teslim Çözümler", "Teknik ve Güvenilir Yaklaşım"];

const VALUES = [
  { title: "Güven", text: "Her projede şeffaf iletişim, doğru planlama ve kontrollü süreç yönetimi.", icon: ShieldCheck },
  { title: "Teknik Yaklaşım", text: "Ruhsat, proje geliştirme ve uygulama aşamalarında mühendislik temelli karar alma.", icon: Compass },
  { title: "Değer Üretimi", text: "Yaşam alanlarını yenilerken bulunduğu çevreye uzun vadeli değer katma hedefi.", icon: Layers },
];

const SERVICES = [
  { title: "Kentsel Dönüşüm", slug: "kentsel-donusum", text: "Riskli yapıların yenilenmesi, fizibilite çalışmaları, hak sahipleriyle süreç yönetimi ve uygulama desteği.", icon: HardHat },
  { title: "Kat Karşılığı İnşaat", slug: "kat-karsiligi-insaat", text: "Arsa sahipleri için güvenilir, şeffaf ve değer odaklı kat karşılığı proje geliştirme çözümleri.", icon: Building },
  { title: "Anahtar Teslim İnşaat", slug: "anahtar-teslim-insaat", text: "Planlamadan teslim aşamasına kadar tüm inşaat sürecinin tek elden profesyonel yönetimi.", icon: Hammer },
  { title: "Proje Geliştirme", slug: "proje-gelistirme", text: "Arsa, konum, imar durumu ve yatırım potansiyeline göre uygulanabilir proje senaryolarının oluşturulması.", icon: ClipboardList },
  { title: "Ruhsat ve Resmi Süreç Takibi", slug: "ruhsat-ve-resmi-surec-takibi", text: "Belediye, ruhsat, proje onay ve yasal süreçlerin düzenli ve kontrollü şekilde takip edilmesi.", icon: FileCheck },
  { title: "Riskli Yapı Danışmanlığı", slug: "riskli-yapi-danismanligi", text: "Bina sahipleri için ön değerlendirme, süreç bilgilendirme ve dönüşüm yol haritası desteği.", icon: ShieldCheck },
];

const STEPS = [
  { title: "Ön Görüşme", text: "Bina, arsa veya proje ihtiyacı hakkında ilk kapsam ve beklenti değerlendirmesi yapılır.", icon: MessageCircle },
  { title: "Yerinde İnceleme", text: "Mevcut yapı, konum, imar durumu ve proje potansiyeli teknik açıdan analiz edilir.", icon: Search },
  { title: "Fizibilite Çalışması", text: "Teknik, mali ve yasal uygunluk değerlendirilerek uygulanabilir yol haritası hazırlanır.", icon: ClipboardList },
  { title: "Sözleşme ve Planlama", text: "Hak sahipleriyle şeffaf anlaşma zemini oluşturulur ve süreç planı netleştirilir.", icon: FileSignature },
  { title: "Ruhsat ve Uygulama", text: "Resmi süreçler takip edilir, inşaat uygulaması kontrollü şekilde yürütülür.", icon: Stamp },
  { title: "Teslim", text: "Proje tamamlanır, yaşam alanları kullanıma hazır şekilde teslim edilir.", icon: Package },
];

const REASONS = [
  { title: "Şeffaf Süreç Yönetimi", text: "Her aşamada açık iletişim, düzenli bilgilendirme ve karar süreçlerinde netlik sağlanır." },
  { title: "Teknik ve Planlı Yaklaşım", text: "Mühendislik temelli planlama ile proje başlamadan önce kritik başlıklar kontrol altına alınır." },
  { title: "Kentsel Dönüşüm Odağı", text: "Riskli yapı süreçlerinde güvenli, uygulanabilir ve hak sahiplerini gözeten yol haritaları oluşturulur." },
  { title: "Malzeme ve İşçilik Disiplini", text: "Uzun ömürlü yapılar için uygulama kalitesi, saha takibi ve detay çözümü önceliklendirilir." },
  { title: "Kontrollü Teslim Hedefi", text: "Süreç, belirlenen plan doğrultusunda izlenir; olası riskler erken aşamada yönetilir." },
];

const APPROACH = [
  { title: "Teknik Ön Değerlendirme", text: "Proje başlamadan önce arsa, yapı, imar ve ihtiyaç başlıkları birlikte ele alınır.", icon: Search },
  { title: "Şeffaf Süreç Yönetimi", text: "Hak sahipleri ve yatırımcılar için anlaşılır, takip edilebilir bir süreç dili kurulur.", icon: FileCheck },
  { title: "Güvenilir Uygulama", text: "Saha uygulaması, planlama ve kalite odağıyla kontrollü şekilde yürütülür.", icon: HardHat },
  { title: "Teslim Sonrası Destek", text: "Proje tamamlandıktan sonra da ihtiyaç duyulan yönlendirme ve iletişim sürdürülür.", icon: Package },
];

export default function Home() {
  const { settings } = useSiteSettings();
  const [projects, setProjects] = useState<ProjectCardData[]>([]);
  const experienceYears = new Date().getFullYear() - 2011;

  useEffect(() => {
    getPublishedProjects()
      .then((data) => {
        const sorted = [...data].sort(
          (a, b) =>
            Number(b.is_featured) - Number(a.is_featured) ||
            (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
            b.created_at.localeCompare(a.created_at)
        );
        setProjects(sorted.slice(0, 6) as ProjectCardData[]);
      })
      .catch((error) => {
        console.error("Projects API error:", error);
        setProjects([]);
      });
  }, []);

  return (
    <>
      <Seo canonical="/" />

      {/* HERO */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        <img src={heroImg} alt="Akinal İnşaat — Modern inşaat projesi" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="container-narrow relative z-10 py-24 text-white">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur border border-white/20 text-xs font-semibold uppercase tracking-widest text-accent mb-6 reveal-up">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" /> Akinal İnşaat
            </div>
            <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-extrabold leading-[1.05] mb-6 reveal-up">
              {settings.hero_title}
            </h1>
            <p className="text-base md:text-lg text-white/85 max-w-2xl leading-relaxed mb-8 reveal-up">
              {settings.hero_subtitle}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 reveal-up">
              <Button asChild size="lg" className="bg-accent hover:bg-accent-glow text-accent-foreground font-semibold shadow-accent-glow">
                <Link to="/iletisim">Ücretsiz Ön Görüşme Al <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="bg-white/5 border-white/30 text-white hover:bg-white hover:text-primary backdrop-blur">
                <Link to="/projelerimiz">Projelerimizi İnceleyin</Link>
              </Button>
            </div>
            <div className="mt-12 grid max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
              <div className="flex min-w-0 items-center gap-2 text-xs leading-snug text-white/80 xl:text-sm">
                <ShieldCheck className="h-4 w-4 text-accent shrink-0" /> {experienceYears}+ yıllık sektör deneyimi
              </div>
              {TRUST.map((t) => (
                <div key={t} className="flex min-w-0 items-center gap-2 text-xs leading-snug text-white/80 xl:text-sm">
                  <ShieldCheck className="h-4 w-4 text-accent shrink-0" /> {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section className="relative overflow-hidden py-20 md:py-28">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-surface-light/40 to-background" />
        <div className="container-narrow relative">
          <div className="grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">Hakkımızda</div>
              <h2 className="mb-6 font-display text-3xl font-bold leading-tight md:text-5xl">Güvenli yapılar için planlı, teknik ve şeffaf yaklaşım</h2>
              <p className="text-base leading-relaxed text-muted-foreground md:text-lg">
                Akinal İnşaat; 2011'den bu yana süren saha deneyimiyle kentsel dönüşüm, kat karşılığı inşaat ve anahtar teslim projelerde süreci yalnızca inşa etmekle değil, doğru kararlarla yönetmekle ele alır. Arsa sahipleri, bina sakinleri ve yatırımcılar için her adımda anlaşılır, kontrollü ve güven veren bir çalışma modeli sunar.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild className="bg-primary text-primary-foreground hover:bg-primary-glow">
                  <Link to="/hakkimizda">Akinal İnşaat Yaklaşımını İnceleyin <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="outline" className="border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground">
                  <Link to="/iletisim">Ön Görüşme Planlayın</Link>
                </Button>
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {VALUES.map((value) => (
                  <div key={value.title} className="rounded-lg border border-border bg-card p-4 shadow-card-soft transition-all duration-300 hover:-translate-y-1 hover:border-accent/35">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-accent/10 text-accent">
                      <value.icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-display text-lg font-bold">{value.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{value.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 hidden rounded-lg border border-accent/15 lg:block" />
              <div className="relative overflow-hidden rounded-lg border border-border bg-card shadow-elegant">
                <img src={sampleProject1} alt="Akinal İnşaat proje uygulama yaklaşımı" loading="lazy" className="aspect-[4/3] w-full object-cover" />
                <div className="border-t border-border bg-card p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Akinal İnşaat Yaklaşımı</div>
                  <div className="mt-1 font-display text-xl font-bold text-foreground">Projeye başlamadan önce netlik sağlarız.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="relative overflow-hidden bg-surface-light py-20 md:py-28">
        <div className="container-narrow relative">
          <div className="mb-14 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">Hizmetlerimiz</div>
              <h2 className="font-display text-3xl font-bold leading-tight md:text-5xl">İnşaat sürecinin her aşaması için profesyonel çözümler</h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              İhtiyaç analizinden resmi süreçlere, uygulamadan teslim aşamasına kadar bütüncül bir çalışma disipliniyle ilerliyoruz.
            </p>
          </div>

          <div className="mb-10 overflow-hidden rounded-lg border border-border bg-card shadow-elegant">
            <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
              <img src={sampleProject3} alt="Akinal İnşaat hizmet kapsamı" loading="lazy" className="aspect-[16/10] h-full w-full object-cover lg:aspect-auto" />
              <div className="flex flex-col justify-center p-6 md:p-8 lg:p-10">
                <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                  <Building className="h-3.5 w-3.5" /> Uçtan Uca Hizmet
                </div>
                <h3 className="font-display text-2xl font-bold leading-tight md:text-4xl">Teknik plan, resmi süreç ve saha uygulaması birlikte yönetilir.</h3>
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
                  Projenin başlangıç kararlarından teslim aşamasına kadar her başlık aynı kalite çizgisinde ele alınır.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((service) => (
              <Link key={service.title} to={`/hizmetlerimiz/${service.slug}`} className="group relative rounded-lg border border-border bg-card p-6 shadow-card-soft transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-elegant focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">
                <div className="absolute inset-x-0 top-0 h-1 bg-accent/70 opacity-70 transition-opacity group-hover:opacity-100" />
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-md bg-primary/5 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <service.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-xl font-bold">{service.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{service.text}</p>
                <div className="mt-6 flex items-center text-xs font-semibold uppercase tracking-[0.16em] text-accent opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100">
                  Detaylı bilgi <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* KENTSEL DÖNÜŞÜM TIMELINE */}
      <section className="relative overflow-hidden py-20 md:py-28">
        <img src={blueprintPattern} alt="" aria-hidden="true" className="absolute -right-40 top-10 hidden h-[560px] w-[680px] object-cover opacity-[0.045] lg:block" />
        <div className="container-narrow relative">
          <div className="mb-14 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">Kentsel Dönüşüm</div>
              <h2 className="font-display text-3xl font-bold leading-tight md:text-5xl">Dönüşüm sürecini anlaşılır bir yol haritasına çeviriyoruz</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Kentsel dönüşüm yalnızca eski bir binanın yenilenmesi değildir. Doğru fizibilite, doğru sözleşme, doğru planlama ve güvenilir uygulama ile hem güvenli hem de değerli yaşam alanları oluşturulur.
            </p>
          </div>

          <div className="relative">
            <div className="absolute left-6 top-8 hidden h-[calc(100%-4rem)] w-px bg-border md:block lg:left-0 lg:top-1/2 lg:h-px lg:w-full" />
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {STEPS.map((step, index) => (
                <div key={step.title} className="relative rounded-lg border border-border bg-card p-5 shadow-card-soft transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-elegant">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-md bg-accent text-accent-foreground shadow-accent-glow">
                      <step.icon className="h-5 w-5" />
                    </div>
                    <div className="font-display text-2xl font-bold text-accent/30">{String(index + 1).padStart(2, "0")}</div>
                  </div>
                  <h3 className="font-display text-lg font-bold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* WHY US — DARK */}
      <section className="relative overflow-hidden bg-gradient-dark py-20 text-white md:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,hsl(var(--accent)/0.18),transparent_32%)]" />
        <img src={urbanSilhouette} alt="" aria-hidden="true" className="absolute inset-x-0 bottom-0 h-64 w-full object-cover opacity-[0.18] mix-blend-screen" />
        <div className="container-narrow relative">
          <div className="mb-14 max-w-3xl">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">Neden Akinal İnşaat?</div>
            <h2 className="font-display text-3xl font-bold leading-tight md:text-5xl">Güven, teknik disiplin ve şeffaf yönetim aynı masada</h2>
            <p className="mt-5 text-white/70 leading-relaxed">
              Her proje; hak sahipleri, yatırımcılar ve kullanıcılar için netlik gerektirir. Akinal İnşaat bu netliği tasarım, resmi süreç, saha uygulaması ve iletişim başlıklarında birlikte kurar.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-5">
            {REASONS.map((reason, index) => (
              <div key={reason.title} className="rounded-lg border border-white/10 bg-white/[0.06] p-6 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:bg-white/[0.09]">
                <div className="mb-5 font-display text-3xl font-bold text-accent">{String(index + 1).padStart(2, "0")}</div>
                <h3 className="font-display text-lg font-bold">{reason.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/70">{reason.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROJECTS */}
      <section className="py-20 md:py-28">
        <div className="container-narrow">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
            <div className="max-w-2xl">
              <div className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-3">Projelerimiz</div>
              <h2 className="font-display text-3xl md:text-5xl font-bold leading-tight">Tamamlanan ve Süren Projelerimiz</h2>
            </div>
            <Button asChild variant="outline" className="self-start md:self-auto">
              <Link to="/projelerimiz">Tüm Projeler <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
          {projects.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-12 border border-dashed border-border rounded-lg">
              Henüz yayınlanmış proje bulunmuyor. Güncel projelerimiz yakında burada paylaşılacaktır.
            </div>
          )}
        </div>
      </section>

      {/* APPROACH */}
      <section className="relative overflow-hidden bg-surface-light py-20 md:py-28">
        <div className="container-narrow relative">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.05fr] lg:items-center">
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-elegant">
              <img src={sampleProject3} alt="Akinal İnşaat proje değerlendirme yaklaşımı" loading="lazy" className="aspect-[4/3] w-full object-cover" />
              <div className="border-t border-border bg-card p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Başlangıç Netliği</div>
                <div className="mt-1 font-display text-xl font-bold">Teknik çerçeve sade, anlaşılır ve uygulanabilir şekilde kurulur.</div>
              </div>
            </div>

            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">Akinal İnşaat Yaklaşımı</div>
              <h2 className="font-display text-3xl font-bold leading-tight md:text-5xl">Projeye başlamadan önce netlik sağlarız</h2>
              <p className="mt-5 text-muted-foreground leading-relaxed">
                Güven veren bir inşaat süreci, ilk görüşmeden itibaren doğru soruları sormakla başlar. Teknik değerlendirme, resmi süreç ve uygulama planı aynı çerçevede ele alınır.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {APPROACH.map((item) => (
                  <div key={item.title} className="rounded-lg border border-border bg-card p-6 shadow-card-soft transition-all duration-300 hover:-translate-y-1 hover:border-accent/40">
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-primary/5 text-primary">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-display text-lg font-bold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN CTA */}
      <section className="relative w-full overflow-hidden bg-primary py-14 text-primary-foreground md:py-20">
        <img src={sampleProject2} alt="Akinal İnşaat iletişim ve ön değerlendirme" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-16" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/92 to-primary-glow/80" />
        <div className="container-narrow relative">
          <div className="rounded-lg border border-white/15 bg-white/[0.07] p-5 shadow-elegant backdrop-blur md:p-8">
            <div className="grid gap-7 lg:grid-cols-[1fr_0.78fr] lg:items-center">
              <div>
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">Ön Değerlendirme</div>
                <h2 className="font-display text-3xl font-bold leading-tight md:text-5xl">Binanız veya arsanız için doğru yol haritasını birlikte çıkaralım</h2>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-primary-foreground/82 md:text-base">
                  Kentsel dönüşüm, kat karşılığı inşaat veya proje geliştirme ihtiyaçlarınız için Akinal İnşaat ile iletişime geçin. Ekibimiz, projeniz için en uygun başlangıç adımını belirlemek üzere sizinle görüşsün.
                </p>
              </div>
              <div className="rounded-lg border border-white/20 bg-white/[0.12] p-5 text-white shadow-elegant backdrop-blur md:p-6">
                <div className="mb-5 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground shadow-accent-glow">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-display text-2xl font-bold leading-tight">Görüşme kanalı seçin</div>
                    <p className="mt-1 text-sm text-white/70">Size en uygun kanaldan hızlıca ulaşın.</p>
                  </div>
                </div>
                <div className="grid gap-3">
                  {settings.whatsapp_number && (
                    <Button asChild size="lg" className="justify-center bg-[#25D366] text-white shadow-accent-glow hover:bg-[#20BD5C]">
                      <a href={getWhatsAppLink(settings.whatsapp_number, settings.whatsapp_message)} target="_blank" rel="noreferrer">
                        <MessageCircle className="mr-2 h-5 w-5" /> WhatsApp ile Görüş
                      </a>
                    </Button>
                  )}
                  {settings.phone && (
                    <Button asChild size="lg" className="justify-center border border-white/15 bg-white/12 text-white shadow-sm hover:bg-white hover:text-primary">
                      <a href={getTelLink(settings.phone)}><PhoneIcon className="mr-2 h-5 w-5" /> Telefonla Ara</a>
                    </Button>
                  )}
                  <Button asChild size="lg" variant="outline" className="justify-center border-white/25 bg-transparent text-white shadow-sm hover:bg-white hover:text-primary">
                    <Link to="/iletisim"><Mail className="mr-2 h-5 w-5" /> İletişim Formu Doldur</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
