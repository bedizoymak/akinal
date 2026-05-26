import { useEffect, useState } from "react";
import { Cookie, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "akinal_cookie_consent_v1";

type ConsentStatus = "accepted" | "rejected" | "managed";

type ConsentChoice = {
  consent_status: ConsentStatus;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    setVisible(!localStorage.getItem(STORAGE_KEY));
  }, []);

  async function saveConsent(choice: ConsentChoice) {
    const payload = {
      ...choice,
      user_agent: navigator.userAgent,
      created_at: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setVisible(false);
    setManageOpen(false);

    await supabase.from("cookie_consents").insert(payload);
  }

  if (!visible) return null;

  return (
    <>
      <section
        aria-label="Çerez bildirimi"
        className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-5xl rounded-xl border border-white/10 bg-secondary/95 p-4 text-white shadow-elegant backdrop-blur md:bottom-5 md:p-5"
      >
        <div className="grid gap-4 lg:grid-cols-[auto_1fr_auto] lg:items-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Cookie className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-white">Çerez Tercihleriniz</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/75">
              Web sitemizde zorunlu çerezlerin yanında, deneyimi iyileştirmek ve site kullanımını anlamak için analitik ve pazarlama çerezleri kullanabiliriz. Tercihlerinizi dilediğiniz şekilde yönetebilirsiniz.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:w-[520px]">
            <Button
              type="button"
              className="bg-accent text-accent-foreground hover:bg-accent-glow"
              onClick={() => saveConsent({ consent_status: "accepted", necessary: true, analytics: true, marketing: true })}
            >
              Tüm Çerezleri Kabul Et
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-white/25 bg-transparent text-white hover:bg-white hover:text-secondary"
              onClick={() => saveConsent({ consent_status: "rejected", necessary: true, analytics: false, marketing: false })}
            >
              Tüm Çerezleri Reddet
            </Button>
            <Button type="button" variant="secondary" className="bg-white/12 text-white hover:bg-white/20" onClick={() => setManageOpen(true)}>
              Çerezleri Yönet
            </Button>
          </div>
        </div>
      </section>

      {manageOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-3 sm:items-center">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-manage-title"
            className="w-full max-w-lg rounded-xl border border-border bg-background p-5 shadow-elegant sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h2 id="cookie-manage-title" className="font-display text-2xl font-bold">Çerezleri Yönet</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Zorunlu çerezler sitenin çalışması için gereklidir. Diğer çerez kategorilerini tercihinize göre açıp kapatabilirsiniz.
                </p>
              </div>
              <button
                type="button"
                aria-label="Pencereyi kapat"
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => setManageOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-light p-4">
                <div>
                  <div className="font-semibold">Zorunlu Çerezler</div>
                  <p className="mt-1 text-xs text-muted-foreground">Güvenlik ve temel site işlevleri için her zaman aktiftir.</p>
                </div>
                <Switch checked disabled aria-label="Zorunlu Çerezler" />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
                <div>
                  <div className="font-semibold">Analitik Çerezler</div>
                  <p className="mt-1 text-xs text-muted-foreground">Site kullanımını anlamamıza ve deneyimi iyileştirmemize yardımcı olur.</p>
                </div>
                <Switch checked={analytics} onCheckedChange={setAnalytics} aria-label="Analitik Çerezler" />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
                <div>
                  <div className="font-semibold">Pazarlama Çerezleri</div>
                  <p className="mt-1 text-xs text-muted-foreground">İlgi alanınıza daha uygun iletişim ve içerik sunmak için kullanılabilir.</p>
                </div>
                <Switch checked={marketing} onCheckedChange={setMarketing} aria-label="Pazarlama Çerezleri" />
              </div>
            </div>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                className="bg-accent text-accent-foreground hover:bg-accent-glow"
                onClick={() => saveConsent({ consent_status: "managed", necessary: true, analytics, marketing })}
              >
                Tercihlerimi Kaydet
              </Button>
              <Button type="button" variant="outline" onClick={() => setManageOpen(false)}>
                Geri Dön
              </Button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
