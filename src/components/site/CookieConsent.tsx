import { useEffect, useState } from "react";
import { Cookie, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { submitCookieConsent } from "@/lib/apiClient";

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

    try {
      await submitCookieConsent(choice);
    } catch (error) {
      console.error("Cookie consent could not be stored", error);
    }
  }

  if (!visible) return null;

  return (
    <>
      <section
        aria-label="Çerez bildirimi"
        className="fixed inset-x-0 bottom-3 z-[60] px-3 text-white sm:px-4 md:bottom-5"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 rounded-lg border border-white/10 bg-secondary/95 p-3 shadow-elegant backdrop-blur md:flex-row md:items-center md:p-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent sm:h-10 sm:w-10">
              <Cookie className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold leading-tight text-white">Çerez Tercihleriniz</h2>
              <p className="mt-1 text-xs leading-relaxed text-white/75 sm:text-sm">
                Web sitemizde zorunlu çerezlerin yanında, deneyimi iyileştirmek ve site kullanımını anlamak için analitik ve pazarlama çerezleri kullanabiliriz.
              </p>
            </div>
          </div>
          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap md:w-auto md:justify-end">
            <Button
              type="button"
              className="h-auto min-h-10 whitespace-normal bg-accent px-3 py-2 text-sm leading-tight text-accent-foreground hover:bg-accent-glow"
              onClick={() => saveConsent({ consent_status: "accepted", necessary: true, analytics: true, marketing: true })}
            >
              Tüm Çerezleri Kabul Et
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-10 whitespace-normal border-white/25 bg-transparent px-3 py-2 text-sm leading-tight text-white hover:bg-white hover:text-secondary"
              onClick={() => saveConsent({ consent_status: "rejected", necessary: true, analytics: false, marketing: false })}
            >
              Tüm Çerezleri Reddet
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-auto min-h-10 whitespace-normal bg-white/12 px-3 py-2 text-sm leading-tight text-white hover:bg-white/20"
              onClick={() => setManageOpen(true)}
            >
              Çerezleri Yönet
            </Button>
          </div>
        </div>
      </section>

      {manageOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center overflow-y-auto bg-black/60 px-3 py-4 sm:items-center sm:px-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-manage-title"
            className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-lg border border-border bg-background p-4 shadow-elegant sm:p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h2 id="cookie-manage-title" className="font-display text-xl font-bold leading-tight sm:text-2xl">Çerezleri Yönet</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
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

            <div className="mt-4 space-y-2.5">
              <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-light p-3">
                <div className="min-w-0">
                  <div className="font-semibold">Zorunlu Çerezler</div>
                  <p className="mt-1 text-xs text-muted-foreground">Güvenlik ve temel site işlevleri için her zaman aktiftir.</p>
                </div>
                <Switch checked disabled aria-label="Zorunlu Çerezler" />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                <div className="min-w-0">
                  <div className="font-semibold">Analitik Çerezler</div>
                  <p className="mt-1 text-xs text-muted-foreground">Site kullanımını anlamamıza ve deneyimi iyileştirmemize yardımcı olur.</p>
                </div>
                <Switch checked={analytics} onCheckedChange={setAnalytics} aria-label="Analitik Çerezler" />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                <div className="min-w-0">
                  <div className="font-semibold">Pazarlama Çerezleri</div>
                  <p className="mt-1 text-xs text-muted-foreground">İlgi alanınıza daha uygun iletişim ve içerik sunmak için kullanılabilir.</p>
                </div>
                <Switch checked={marketing} onCheckedChange={setMarketing} aria-label="Pazarlama Çerezleri" />
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                className="h-auto min-h-10 whitespace-normal bg-accent px-3 py-2 text-accent-foreground hover:bg-accent-glow"
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
