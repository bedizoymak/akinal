import Seo from "@/components/site/Seo";
import { ShieldCheck, Compass, Layers, Award, Users, Target } from "lucide-react";

const VALUES = [
  { icon: ShieldCheck, title: "Güven", text: "Şeffaf iletişim, doğru planlama, sürdürülebilir çözüm." },
  { icon: Compass, title: "Teknik Yaklaşım", text: "Mühendislik temelli proje yönetimi." },
  { icon: Layers, title: "Değer Üretimi", text: "Bölgeye değer katacak yaşam alanları." },
  { icon: Award, title: "Kalite", text: "Uzun ömürlü yapılar için yüksek standart." },
  { icon: Users, title: "Hak Sahibi Memnuniyeti", text: "Sürecin merkezinde insan vardır." },
  { icon: Target, title: "Planlı Teslim", text: "Belirlenen takvimde kontrollü ilerleme." },
];

export default function About() {
  return (
    <>
      <Seo title="Hakkımızda" description="Akınal İnşaat hakkında: kuruluş, vizyon, misyon ve değerler." />
      <section className="py-16 md:py-24 bg-gradient-dark text-white">
        <div className="container-narrow">
          <div className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-3">Hakkımızda</div>
          <h1 className="font-display text-4xl md:text-6xl font-bold leading-tight max-w-3xl">Güvenli yapılar, planlı süreçler, kalıcı değer.</h1>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container-narrow grid lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-6 text-base md:text-lg leading-relaxed text-foreground/85">
            <p>
              Akınal İnşaat; güvenli, estetik ve uzun ömürlü yapılar üretme hedefiyle kentsel dönüşüm ve inşaat projelerinde profesyonel çözümler sunar. Arsa sahipleri, bina sakinleri ve yatırımcılar için sürecin her aşamasında şeffaf, planlı ve teknik bir yaklaşım benimser.
            </p>
            <p>
              Kentsel dönüşüm, kat karşılığı inşaat ve anahtar teslim projelerde fizibiliteden ruhsata, uygulamadan teslime kadar tüm aşamaları tek elden yönetiyor; mülk sahiplerine süreci anlaşılır ve güvenilir hâle getiriyoruz.
            </p>
            <div className="grid sm:grid-cols-2 gap-6 pt-4">
              <div className="p-6 rounded-lg border border-border bg-card">
                <h3 className="font-display text-xl font-bold mb-2 text-accent">Vizyonumuz</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">Türkiye'nin yaşam alanlarını daha güvenli, sürdürülebilir ve değerli hâle getirmek; kentsel dönüşümde güvenilen referans firma olmak.</p>
              </div>
              <div className="p-6 rounded-lg border border-border bg-card">
                <h3 className="font-display text-xl font-bold mb-2 text-accent">Misyonumuz</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">Her projeyi mühendislik disipliniyle ele almak, hak sahipleriyle şeffaf süreç yürütmek ve teslim ettiğimiz her yapının arkasında durmak.</p>
              </div>
            </div>
          </div>
          <aside className="space-y-3">
            {VALUES.map((v) => (
              <div key={v.title} className="flex items-start gap-4 p-4 rounded-lg bg-surface-light border border-border">
                <div className="h-10 w-10 rounded-md bg-accent text-accent-foreground flex items-center justify-center shrink-0">
                  <v.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold">{v.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{v.text}</div>
                </div>
              </div>
            ))}
          </aside>
        </div>
      </section>
    </>
  );
}
