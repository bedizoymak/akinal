import { Link, useLocation } from "react-router-dom";
import Seo from "@/components/site/Seo";
import { useSiteSettings } from "@/hooks/useSiteSettings";

type LegalContent = {
  title: string;
  description: string;
  sections: Array<{ title: string; body: string }>;
};

const legalPages: Record<string, LegalContent> = {
  "/gizlilik-politikasi": {
    title: "Gizlilik Politikası",
    description: "Akinal İnşaat ile paylaşılan bilgilerin nasıl değerlendirildiğine ilişkin temel bilgilendirme.",
    sections: [
      {
        title: "Şirket unvanı",
        body: "COMPANY_NAME",
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
    description: "Web sitesinde kullanılan çerez türleri ve tercihlerinize ilişkin kısa bilgilendirme.",
    sections: [
      {
        title: "Şirket unvanı",
        body: "COMPANY_NAME",
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
    description: "Akinal İnşaat web sitesinin kullanımına ilişkin temel şartlar.",
    sections: [
      {
        title: "Şirket unvanı",
        body: "COMPANY_NAME",
      },
      {
        title: "Site içeriği",
        body: "Bu web sitesindeki proje, hizmet ve bilgilendirme içerikleri genel tanıtım amacı taşır. Detaylı teklif ve uygulama koşulları proje özelinde değerlendirilir.",
      },
      {
        title: "Bağlantılar ve sorumluluk",
        body: "Sitede yer alan iletişim, harita ve yönlendirme bağlantıları kullanıcı kolaylığı için sunulur. Dış servislerde oluşabilecek teknik aksaklıklardan Akinal İnşaat sorumlu değildir.",
      },
      {
        title: "Güncellemeler",
        body: "Akinal İnşaat, web sitesi içeriklerini ve kullanım şartlarını gerektiğinde güncelleme hakkını saklı tutar.",
      },
    ],
  },
};

export default function LegalPage() {
  const { pathname } = useLocation();
  const { settings } = useSiteSettings();
  const content = legalPages[pathname] ?? legalPages["/gizlilik-politikasi"];
  const companyName = settings.company_name || "Şirket";

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
      <main className="pt-28">
        <section className="container-narrow py-16 md:py-20">
          <p className="text-sm uppercase tracking-widest text-primary font-semibold">Yasal Bilgilendirme</p>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mt-4">{content.title}</h1>
          <p className="mt-5 max-w-3xl text-muted-foreground leading-relaxed">{content.description}</p>

          <div className="mt-10 grid gap-5">
            {content.sections.map((section) => (
              <article key={section.title} className="rounded-lg border border-border bg-card p-6 shadow-card-soft">
                <h2 className="font-display text-2xl font-semibold text-foreground">{section.title}</h2>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{section.body.replace("COMPANY_NAME", companyName)}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 rounded-lg bg-secondary p-6 text-sm text-muted-foreground">
            Güncel bilgi ve talepleriniz için{" "}
            <Link to="/iletisim" className="font-semibold text-primary hover:underline">
              iletişim sayfası
            </Link>{" "}
            üzerinden bize ulaşabilirsiniz.
          </div>
        </section>
      </main>
    </>
  );
}
