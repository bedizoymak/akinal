import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck, Compass, Layers, HardHat, Building, FileCheck, Hammer, ClipboardList, Search, FileSignature, Stamp, Package, MessageCircle, Phone as PhoneIcon, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import ProjectCard, { ProjectCardData } from "@/components/site/ProjectCard";
import Seo from "@/components/site/Seo";
import { useSiteSettings, getWhatsAppLink, getTelLink } from "@/hooks/useSiteSettings";
import heroImg from "@/assets/hero-construction.jpg";

const TRUST = ["Kentsel Dönüşüm Uzmanlığı", "Şeffaf Süreç Yönetimi", "Anahtar Teslim Çözümler", "Teknik ve Güvenilir Yaklaşım"];

const VALUES = [
  { title: "Güven", text: "Her projede şeffaf iletişim, doğru planlama ve sürdürülebilir çözüm anlayışı.", icon: ShieldCheck },
  { title: "Teknik Yaklaşım", text: "Proje geliştirme, ruhsat ve uygulama süreçlerinde mühendislik temelli yönetim.", icon: Compass },
  { title: "Değer Üretimi", text: "Yaşam alanlarını yalnızca yenilemek değil, bulunduğu bölgeye değer katacak şekilde geliştirmek.", icon: Layers },
];

const SERVICES = [
  { title: "Kentsel Dönüşüm", text: "Riskli yapıların yenilenmesi, fizibilite çalışmaları, hak sahipleriyle süreç yönetimi ve uygulama desteği.", icon: HardHat },
  { title: "Kat Karşılığı İnşaat", text: "Arsa sahipleri için güvenilir, şeffaf ve kazanç odaklı kat karşılığı proje geliştirme çözümleri.", icon: Building },
  { title: "Anahtar Teslim İnşaat", text: "Planlamadan teslim aşamasına kadar tüm inşaat sürecinin tek elden profesyonel yönetimi.", icon: Hammer },
  { title: "Proje Geliştirme", text: "Arsa, konum, imar durumu ve yatırım potansiyeline göre uygulanabilir proje senaryolarının oluşturulması.", icon: ClipboardList },
  { title: "Ruhsat ve Resmi Süreç Takibi", text: "Belediye, ruhsat, proje onay ve yasal süreçlerin düzenli ve kontrollü şekilde takip edilmesi.", icon: FileCheck },
  { title: "Riskli Yapı Danışmanlığı", text: "Bina sahipleri için ön değerlendirme, süreç bilgilendirme ve dönüşüm yol haritası desteği.", icon: ShieldCheck },
];

const STEPS = [
  { title: "Ön Görüşme", text: "Bina, arsa veya proje ihtiyacı hakkında ilk değerlendirme yapılır.", icon: MessageCircle },
  { title: "Yerinde İnceleme", text: "Mevcut yapı, konum, imar durumu ve proje potansiyeli analiz edilir.", icon: Search },
  { title: "Fizibilite Çalışması", text: "Teknik, mali ve yasal uygunluk değerlendirilerek uygulanabilir yol haritası hazırlanır.", icon: ClipboardList },
  { title: "Sözleşme ve Planlama", text: "Hak sahipleriyle şeffaf anlaşma zemini oluşturulur ve proje takvimi belirlenir.", icon: FileSignature },
  { title: "Ruhsat ve Uygulama", text: "Resmi süreçler takip edilir, inşaat uygulaması kontrollü şekilde yürütülür.", icon: Stamp },
  { title: "Teslim", text: "Proje tamamlanır, yaşam alanları kullanıma hazır şekilde teslim edilir.", icon: Package },
];

const REASONS = [
  { title: "Şeffaf Süreç Yönetimi", text: "Her aşamada açık iletişim, düzenli raporlama ve hak sahiplerini bilgilendirme önceliğimizdir." },
  { title: "Teknik ve Planlı Yaklaşım", text: "Mühendislik temelli planlama ile her detay önceden değerlendirilir ve kontrol altında tutulur." },
  { title: "Kentsel Dönüşüm Deneyimi", text: "Riskli yapı süreçlerinde edinilen deneyim, projelerde güvenli ve doğru kararlar alınmasını sağlar." },
  { title: "Kaliteli Malzeme ve İşçilik", text: "Uzun ömürlü yapılar için seçilmiş malzemeler ve titiz işçilik standartları uygulanır." },
  { title: "Zamanında ve Kontrollü Teslim Hedefi", text: "Belirlenen takvim doğrultusunda planlı ilerleyerek teslim sürelerine sadık kalınır." },
];

export default function Home() {
  const { settings } = useSiteSettings();
  const [projects, setProjects] = useState<ProjectCardData[]>([]);

  useEffect(() => {
    supabase
      .from("projects")
      .select("id,title,slug,short_description,project_type,project_status,location,cover_image_url,is_featured,sort_order,created_at")
      .eq("is_published", true)
      .order("is_featured", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data }) => setProjects((data as any) || []));
  }, []);

  return (
    <>
      <Seo />

      {/* HERO */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        <img src={heroImg} alt="Akınal İnşaat — Modern inşaat projesi" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="container-narrow relative z-10 py-24 text-white">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur border border-white/20 text-xs font-semibold uppercase tracking-widest text-accent mb-6 reveal-up">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" /> Akınal İnşaat
            </div>
            <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.05] mb-6 reveal-up">
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
            <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl">
              {TRUST.map((t) => (
                <div key={t} className="flex items-center gap-2 text-sm text-white/80">
                  <ShieldCheck className="h-4 w-4 text-accent shrink-0" /> {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section className="py-20 md:py-28">
        <div className="container-narrow">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-3">Hakkımızda</div>
              <h2 className="font-display text-3xl md:text-5xl font-bold leading-tight mb-6">Akınal İnşaat Hakkında</h2>
              <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
                Akınal İnşaat; güvenli, estetik ve uzun ömürlü yapılar üretme hedefiyle kentsel dönüşüm ve inşaat projelerinde profesyonel çözümler sunar. Arsa sahipleri, bina sakinleri ve yatırımcılar için sürecin her aşamasında şeffaf, planlı ve teknik bir yaklaşım benimser.
              </p>
              <Button asChild variant="outline" className="mt-8 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground">
                <Link to="/hakkimizda">Daha Fazla Bilgi <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
            <div className="grid sm:grid-cols-1 gap-4">
              {VALUES.map((v) => (
                <div key={v.title} className="group p-6 rounded-lg border border-border bg-card hover:border-accent/50 hover:shadow-card-soft transition-all">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-md bg-primary/5 text-primary flex items-center justify-center group-hover:bg-accent group-hover:text-accent-foreground transition-colors shrink-0">
                      <v.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-display text-xl font-bold mb-2">{v.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{v.text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="py-20 md:py-28 bg-surface-light">
        <div className="container-narrow">
          <div className="max-w-2xl mb-14">
            <div className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-3">Hizmetlerimiz</div>
            <h2 className="font-display text-3xl md:text-5xl font-bold leading-tight">Sunduğumuz Profesyonel Çözümler</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {SERVICES.map((s) => (
              <div key={s.title} className="group p-7 rounded-lg bg-card border border-border hover:border-accent/40 hover:-translate-y-1 transition-all duration-300 shadow-card-soft">
                <div className="h-12 w-12 rounded-md bg-primary text-primary-foreground flex items-center justify-center mb-5 group-hover:bg-accent transition-colors">
                  <s.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-xl font-bold mb-3">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* KENTSEL DÖNÜŞÜM TIMELINE */}
      <section className="py-20 md:py-28">
        <div className="container-narrow">
          <div className="max-w-3xl mb-14">
            <div className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-3">Kentsel Dönüşüm</div>
            <h2 className="font-display text-3xl md:text-5xl font-bold leading-tight mb-5">Kentsel Dönüşüm Sürecini Sizin İçin Yönetiyoruz</h2>
            <p className="text-muted-foreground leading-relaxed">
              Kentsel dönüşüm yalnızca eski bir binanın yenilenmesi değildir. Doğru fizibilite, doğru sözleşme, doğru planlama ve güvenilir uygulama ile hem güvenli hem de değerli yaşam alanları oluşturulur.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative p-6 rounded-lg border border-border bg-card hover:shadow-card-soft transition-shadow">
                <div className="absolute -top-3 -right-3 h-10 w-10 rounded-full bg-accent text-accent-foreground font-display font-bold flex items-center justify-center text-sm shadow-accent-glow">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <s.icon className="h-7 w-7 text-accent mb-4" />
                <h3 className="font-display text-lg font-bold mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY US — DARK */}
      <section className="py-20 md:py-28 bg-gradient-dark text-white">
        <div className="container-narrow">
          <div className="max-w-2xl mb-14">
            <div className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-3">Neden Biz?</div>
            <h2 className="font-display text-3xl md:text-5xl font-bold leading-tight">Neden Akınal İnşaat?</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {REASONS.map((r, i) => (
              <div key={r.title} className="p-6 rounded-lg bg-white/5 backdrop-blur border border-white/10 hover:border-accent/40 transition-colors">
                <div className="font-display text-accent text-3xl font-bold mb-3">{String(i + 1).padStart(2, "0")}</div>
                <h3 className="font-display text-lg font-bold mb-2">{r.title}</h3>
                <p className="text-sm text-white/70 leading-relaxed">{r.text}</p>
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
              Henüz yayınlanmış proje bulunmuyor. Yöneticiler admin panelinden proje ekleyebilir.
            </div>
          )}
        </div>
      </section>

      {/* MAIN CTA */}
      <section className="py-20 md:py-28 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at 80% 20%, hsl(var(--accent)) 0%, transparent 50%)" }} />
        <div className="container-narrow relative">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-display text-3xl md:text-5xl font-bold leading-tight mb-5">Binanız veya Arsanız İçin Ön Değerlendirme Alın</h2>
            <p className="text-primary-foreground/80 text-base md:text-lg leading-relaxed mb-9">
              Kentsel dönüşüm, kat karşılığı inşaat veya proje geliştirme ihtiyaçlarınız için Akınal İnşaat ile iletişime geçin. Ekibimiz, projeniz için en uygun yol haritasını belirlemek üzere sizinle görüşsün.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" className="bg-[#25D366] hover:bg-[#20BD5C] text-white font-semibold">
                <a href={getWhatsAppLink(settings.whatsapp_number, settings.whatsapp_message)} target="_blank" rel="noreferrer">
                  <MessageCircle className="mr-2 h-5 w-5" /> WhatsApp ile Görüş
                </a>
              </Button>
              <Button asChild size="lg" className="bg-accent hover:bg-accent-glow text-accent-foreground font-semibold">
                <a href={getTelLink(settings.phone)}><PhoneIcon className="mr-2 h-5 w-5" /> Telefonla Ara</a>
              </Button>
              <Button asChild size="lg" variant="outline" className="bg-transparent border-white/40 text-white hover:bg-white hover:text-primary">
                <Link to="/iletisim"><Mail className="mr-2 h-5 w-5" /> İletişim Formu Doldur</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
