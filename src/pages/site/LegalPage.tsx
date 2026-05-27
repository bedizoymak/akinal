import { Link, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Cookie, FileText, Info, Lock, Mail, Scale, ShieldCheck } from "lucide-react";
import Seo from "@/components/site/Seo";

type LegalContent = {
  title: string;
  description: string;
  eyebrow: string;
  icon: LucideIcon;
  sections: Array<{ title: string; body: string }>;
};

const COMPANY_LEGAL_NAME = "Akinal İnşaat LTD. ŞTİ.";

const legalPages: Record<string, LegalContent> = {
  "/gizlilik-politikasi": {
    title: "Gizlilik Politikası",
    eyebrow: "Kişisel veriler ve gizlilik",
    icon: Lock,
    description: `${COMPANY_LEGAL_NAME} ile paylaşılan bilgilerin nasıl değerlendirildiğine ilişkin temel bilgilendirme.`,
    sections: [
      {
        title: "Şirket unvanı",
        body: COMPANY_LEGAL_NAME,
      },
      {
        title: "Toplanan bilgiler",
        body: "İletişim formu üzerinden ad, soyad, telefon, e-posta ve mesaj bilgileri alınabilir. Bu bilgiler yalnızca talebinizi değerlendirmek ve sizinle iletişime geçmek amacıyla kullanılır.",
      },
      {
        title: "Kullanım amacı",
        body: "Paylaştığınız bilgiler proje, teklif, danışmanlık veya iletişim taleplerinize yanıt vermek için işlenir. Bilgileriniz izniniz dışında pazarlama amacıyla üçüncü kişilerle paylaşılmaz.",
      },
      {
        title: "İletişim",
        body: "Gizlilik kapsamındaki talepleriniz için bizimle iletişim sayfasındaki telefon veya e-posta bilgileri üzerinden görüşebilirsiniz.",
      },
    ],
  },
  "/cerez-politikasi": {
    title: "Çerez Politikası",
    eyebrow: "Çerezler ve tercihler",
    icon: Cookie,
    description: "Web sitesinde kullanılan çerez türleri ve tercihlerinize ilişkin kısa bilgilendirme.",
    sections: [
      {
        title: "Şirket unvanı",
        body: COMPANY_LEGAL_NAME,
      },
      {
        title: "Zorunlu çerezler",
        body: "Sitenin güvenli ve doğru şekilde çalışması için gerekli olan temel çerezlerdir. Bu çerezler kapatılamaz.",
      },
      {
        title: "Analitik ve pazarlama çerezleri",
        body: "Onay vermeniz halinde site kullanımını anlamak ve iletişim çalışmalarını iyileştirmek amacıyla analitik veya pazarlama çerezleri kullanılabilir.",
      },
      {
        title: "Tercih yönetimi",
        body: "Çerez tercihlerinizi banner üzerinde yönetebilir veya tarayıcı ayarlarınızdan çerezleri silebilirsiniz.",
      },
    ],
  },
  "/kullanim-sartlari": {
    title: "Kullanım Şartları",
    eyebrow: "Site kullanımı ve sorumluluklar",
    icon: Scale,
    description: `${COMPANY_LEGAL_NAME} web sitesinin kullanımına ilişkin temel şartlar.`,
    sections: [
      {
        title: "Şirket unvanı",
        body: COMPANY_LEGAL_NAME,
      },
      {
        title: "Site içeriği",
        body: "Bu web sitesindeki proje, hizmet ve bilgilendirme içerikleri genel tanıtım amacı taşır. Detaylı teklif ve uygulama koşulları proje özelinde değerlendirilir.",
      },
      {
        title: "Bağlantılar ve sorumluluk",
        body: `Sitede yer alan iletişim, harita ve yönlendirme bağlantıları kullanıcı kolaylığı için sunulur. Dış servislerde oluşabilecek teknik aksaklıklardan ${COMPANY_LEGAL_NAME} sorumlu değildir.`,
      },
      {
        title: "Güncellemeler",
        body: `${COMPANY_LEGAL_NAME}, web sitesi içeriklerini ve kullanım şartlarını gerektiğinde güncelleme hakkını saklı tutar.`,
      },
    ],
  },
};

const assuranceItems = [
  { icon: ShieldCheck, title: "Güvenli yaklaşım", text: "Paylaşılan bilgiler yalnızca ilgili talep ve süreçler kapsamında değerlendirilir." },
  { icon: FileText, title: "Açık bilgilendirme", text: "Yasal metinler sade, okunabilir ve profesyonel bir dille sunulur." },
  { icon: Info, title: "Güncel içerik", text: "Politika ve şartlar ihtiyaç halinde yenilenebilir; en güncel metin bu sayfada yer alır." },
];

export default function LegalPage() {
  const { pathname } = useLocation();
  const content = legalPages[pathname] ?? legalPages["/gizlilik-politikasi"];
  const PageIcon = content.icon;

  return (
    <>
      <Seo
        title={content.title}
        description={content.description}
        breadcrumbs={[
          { name: "Ana Sayfa", path: "/" },
          { name: content.title, path: pathname },
        ]}
      />
      <main>
        <section className="relative overflow-hidden border-b border-border bg-surface-light">
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/10 to-transparent" aria-hidden="true" />
          <div className="container-narrow relative py-16 md:py-20">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary shadow-card-soft">
                <PageIcon className="h-4 w-4" />
                {content.eyebrow}
              </div>
              <h1 className="mt-6 font-display text-4xl font-bold leading-tight text-foreground md:text-6xl">{content.title}</h1>
              <p className="mt-5 max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">{content.description}</p>
            </div>
          </div>
        </section>

        <section className="container-narrow py-14 md:py-20">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
            <aside className="rounded-lg border border-border bg-card p-6 shadow-card-soft">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Yasal bilgi notu</p>
              <h2 className="mt-3 font-display text-2xl font-semibold text-foreground">{COMPANY_LEGAL_NAME}</h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Bu sayfa, web sitesi kullanımı ve iletişim süreçleri hakkında temel bilgilendirme amacıyla hazırlanmıştır.
              </p>
              <div className="mt-6 rounded-md bg-muted p-4 text-sm text-muted-foreground">
                Detaylı talepleriniz için iletişim kanallarımız üzerinden bizimle görüşebilirsiniz.
              </div>
            </aside>

            <div className="grid gap-5">
            {content.sections.map((section) => (
              <article key={section.title} className="rounded-lg border border-border bg-card p-6 shadow-card-soft md:p-7">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl font-semibold text-foreground">{section.title}</h2>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">{section.body}</p>
                  </div>
                </div>
              </article>
            ))}
            </div>
          </div>
        </section>

        <section className="bg-surface-light py-14 md:py-20">
          <div className="container-narrow">
            <div className="grid gap-5 md:grid-cols-3">
              {assuranceItems.map((item) => (
                <article key={item.title} className="rounded-lg border border-border bg-white p-6 shadow-card-soft">
                  <item.icon className="h-7 w-7 text-primary" />
                  <h3 className="mt-4 font-display text-xl font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                </article>
              ))}
            </div>

            <div className="mt-8 rounded-lg border border-primary/15 bg-white p-6 shadow-card-soft md:flex md:items-center md:justify-between md:gap-8 md:p-8">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Mail className="h-4 w-4" />
                  Bilgi ve talepleriniz için
                </div>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                  Güncel bilgi, başvuru veya yasal metinlerle ilgili sorularınız için iletişim sayfası üzerinden bize ulaşabilirsiniz.
                </p>
              </div>
              <Link
                to="/iletisim"
                className="mt-5 inline-flex items-center justify-center rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-glow md:mt-0"
              >
                İletişime Geç
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
