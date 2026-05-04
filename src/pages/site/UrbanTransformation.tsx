import Seo from "@/components/site/Seo";
import { MessageCircle, Search, ClipboardList, FileSignature, Stamp, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const STEPS = [
  { icon: MessageCircle, title: "Ön Görüşme", text: "Bina, arsa veya proje ihtiyacı hakkında ilk değerlendirme yapılır." },
  { icon: Search, title: "Yerinde İnceleme", text: "Mevcut yapı, konum, imar durumu ve proje potansiyeli analiz edilir." },
  { icon: ClipboardList, title: "Fizibilite Çalışması", text: "Teknik, mali ve yasal uygunluk değerlendirilerek uygulanabilir yol haritası hazırlanır." },
  { icon: FileSignature, title: "Sözleşme ve Planlama", text: "Hak sahipleriyle şeffaf anlaşma zemini oluşturulur ve proje takvimi belirlenir." },
  { icon: Stamp, title: "Ruhsat ve Uygulama", text: "Resmi süreçler takip edilir, inşaat uygulaması kontrollü şekilde yürütülür." },
  { icon: Package, title: "Teslim", text: "Proje tamamlanır, yaşam alanları kullanıma hazır şekilde teslim edilir." },
];

export default function UrbanTransformation() {
  return (
    <>
      <Seo title="Kentsel Dönüşüm" description="Riskli yapı dönüşüm sürecini Akınal İnşaat ile yönetin." />
      <section className="py-16 md:py-24 bg-gradient-dark text-white">
        <div className="container-narrow max-w-4xl">
          <div className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-3">Kentsel Dönüşüm</div>
          <h1 className="font-display text-4xl md:text-6xl font-bold leading-tight mb-5">Kentsel Dönüşüm Sürecini Sizin İçin Yönetiyoruz</h1>
          <p className="text-white/80 text-base md:text-lg leading-relaxed">
            Kentsel dönüşüm yalnızca eski bir binanın yenilenmesi değildir. Doğru fizibilite, doğru sözleşme, doğru planlama ve güvenilir uygulama ile hem güvenli hem de değerli yaşam alanları oluşturulur.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container-narrow">
          <ol className="relative border-l-2 border-border ml-3 space-y-10">
            {STEPS.map((s, i) => (
              <li key={s.title} className="pl-8 relative">
                <div className="absolute -left-[22px] h-10 w-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-display font-bold shadow-accent-glow">{i + 1}</div>
                <div className="p-6 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-3 mb-2">
                    <s.icon className="h-5 w-5 text-accent" />
                    <h3 className="font-display text-xl font-bold">{s.title}</h3>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-16 text-center">
            <Button asChild size="lg" className="bg-accent hover:bg-accent-glow text-accent-foreground">
              <Link to="/iletisim">Ücretsiz Ön Değerlendirme Al</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
