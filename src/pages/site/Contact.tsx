import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Phone, MessageCircle, Mail, MapPin } from "lucide-react";
import Seo from "@/components/site/Seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSiteSettings, getWhatsAppLink, getTelLink, getMapsLink } from "@/hooks/useSiteSettings";
import { SERVICE_OPTIONS } from "@/lib/projects";
import { submitContactRequest } from "@/lib/apiClient";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: {
        sitekey: string;
        callback: (token: string) => void;
        "error-callback"?: () => void;
        "expired-callback"?: () => void;
        theme?: string;
        [key: string]: unknown;
      }) => number;
      reset: (widgetId: number) => void;
    };
  }
}

const schema = z.object({
  full_name: z.string().trim().min(2, "Ad Soyad zorunludur.").max(100, "Ad Soyad en fazla 100 karakter olabilir."),
  phone: z.string().trim().min(7, "Telefon numarası zorunludur.").max(30, "Telefon numarası en fazla 30 karakter olabilir."),
  email: z.string().trim().email("Geçerli bir e-posta giriniz.").max(255, "E-posta en fazla 255 karakter olabilir.").optional().or(z.literal("")),
  service_type: z.string().min(1, "Lütfen bir hizmet seçin."),
  message: z.string().trim().min(5, "Mesajınızı yazınız.").max(2000, "Mesajınız en fazla 2000 karakter olabilir."),
});

export default function Contact() {
  const { settings } = useSiteSettings();
  const { toast } = useToast();
  const experienceYears = new Date().getFullYear() - 2011;
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", service_type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<number | null>(null);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey) {
      setTurnstileError("Güvenlik doğrulaması yapılandırılmamış. Lütfen telefon veya WhatsApp üzerinden bize ulaşın.");
      return;
    }

    // Hard timeout: if the Cloudflare script/widget never becomes ready (blocked
    // by network policy, ad blocker, or a CSP mismatch, none of which reliably
    // fire the script's own load/error events), stop showing "yükleniyor..."
    // forever and surface an actionable, retryable failure state instead.
    const readyTimeout = window.setTimeout(() => {
      setTurnstileReady((ready) => {
        if (!ready) {
          setTurnstileError("Güvenlik doğrulaması yüklenemedi. Lütfen tekrar deneyin.");
        }
        return ready;
      });
    }, 10000);

    let renderTimeout: number | undefined;
    function renderTurnstile() {
      if (!turnstileRef.current || !window.turnstile) {
        // script present but turnstile not available yet; wait a short time
        renderTimeout = window.setTimeout(() => {
          if (window.turnstile && turnstileRef.current && siteKey) {
            try {
              widgetId.current = window.turnstile.render(turnstileRef.current, {
                sitekey: siteKey,
                callback: (token: string) => {
                  setTurnstileToken(token);
                  setTurnstileError(null);
                },
                "error-callback": () => {
                  setTurnstileToken("");
                  setTurnstileError("Güvenlik doğrulaması tamamlanamadı. Lütfen tekrar deneyin.");
                },
                "expired-callback": () => {
                  setTurnstileToken("");
                  setTurnstileError("Güvenlik doğrulamasının süresi doldu. Lütfen tekrar deneyin.");
                },
              });
              setTurnstileReady(true);
            } catch {
              const msg = "Güvenlik doğrulaması yüklenemedi. Lütfen sayfayı yenileyin.";
              setTurnstileError(msg);
            }
          } else {
            const msg = "Güvenlik doğrulaması yüklenemedi. Lütfen sayfayı yenileyin.";
            setTurnstileError(msg);
          }
        }, 800);
        return;
      }

      // normal render path
      try {
        if (siteKey) {
          widgetId.current = window.turnstile.render(turnstileRef.current, {
            sitekey: siteKey,
            callback: (token: string) => {
              setTurnstileToken(token);
              setTurnstileError(null);
            },
            "error-callback": () => {
              setTurnstileToken("");
              setTurnstileError("Güvenlik doğrulaması tamamlanamadı. Lütfen tekrar deneyin.");
            },
            "expired-callback": () => {
              setTurnstileToken("");
              setTurnstileError("Güvenlik doğrulamasının süresi doldu. Lütfen tekrar deneyin.");
            },
          });
          setTurnstileReady(true);
        } else {
          const msg = "Güvenlik doğrulaması yapılandırılmamış. Lütfen telefon veya WhatsApp üzerinden bize ulaşın.";
          setTurnstileError(msg);
        }
      } catch {
        const msg = "Güvenlik doğrulaması yüklenemedi. Lütfen sayfayı yenileyin.";
        setTurnstileError(msg);
      } finally {
        if (renderTimeout) window.clearTimeout(renderTimeout);
      }
    }

    if (window.turnstile) {
      renderTurnstile();
      return;
    }

    const existingScript = document.querySelector('script[src="https://challenges.cloudflare.com/turnstile/v0/api.js"]') as HTMLScriptElement | null;
    if (existingScript) {
      // If already loaded, try to render immediately
      if ((existingScript as any).hasAttribute && existingScript.getAttribute('data-loaded') === '1') {
        renderTurnstile();
        return;
      }
      existingScript.addEventListener("load", () => {
        try { existingScript.setAttribute('data-loaded', '1'); } catch (_) {}
        renderTurnstile();
      });
      existingScript.addEventListener("error", () => {
        const msg = "Güvenlik doğrulaması yüklenemedi. Lütfen sayfayı yenileyin.";
        setTurnstileError(msg);
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    script.setAttribute('crossorigin', 'anonymous');
    script.onload = () => {
      try { script.setAttribute('data-loaded', '1'); } catch (_) {}
      renderTurnstile();
    };
    script.onerror = () => {
      const msg = "Güvenlik doğrulaması yüklenemedi. Lütfen sayfayı yenileyin.";
      setTurnstileError(msg);
    };
    document.body.appendChild(script);
    // Development-only debug logs
    if (import.meta.env.DEV) {
      console.debug("Turnstile debug:", { siteKeyPresent: !!siteKey, scriptTagExists: true });
    }
    return () => window.clearTimeout(readyTimeout);
  }, [siteKey, retryKey]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!siteKey) {
      toast({ title: "Form şu anda gönderilemiyor", description: "Güvenlik doğrulaması yapılandırılmamış. Lütfen telefon veya WhatsApp üzerinden bize ulaşın.", variant: "destructive" });
      return;
    }
    if (!turnstileToken) {
      toast({ title: "Güvenlik doğrulaması gerekli", description: "Lütfen formu göndermeden önce güvenlik doğrulamasını tamamlayın.", variant: "destructive" });
      return;
    }
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Form eksik", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await submitContactRequest({
        ...parsed.data,
        email: parsed.data.email || null,
        turnstile_token: turnstileToken,
      });
    } catch {
      setSubmitting(false);
      toast({ title: "Hata", description: "Talebiniz gönderilemedi. Lütfen tekrar deneyin.", variant: "destructive" });
      return;
    }
    setSubmitting(false);
    toast({ title: "Talebiniz alındı", description: "Talebiniz başarıyla alındı. En kısa sürede sizinle iletişime geçeceğiz." });
    setForm({ full_name: "", phone: "", email: "", service_type: "", message: "" });
    setTurnstileToken("");
    if (widgetId.current !== null && window.turnstile) {
      window.turnstile.reset(widgetId.current);
    }
  }

  const cards = [
    settings.phone ? { icon: Phone, title: "Telefon", value: settings.phone, href: getTelLink(settings.phone) } : null,
    settings.whatsapp_number ? { icon: MessageCircle, title: "WhatsApp", value: settings.whatsapp_number, href: getWhatsAppLink(settings.whatsapp_number, settings.whatsapp_message) } : null,
    settings.email ? { icon: Mail, title: "E-posta", value: settings.email, href: `mailto:${settings.email}` } : null,
    settings.address ? { icon: MapPin, title: "Adres", value: settings.address, href: getMapsLink(settings.address) } : null,
  ].filter(Boolean);

  return (
    <>
      <Seo
        title="İletişim"
        description="Akinal İnşaat telefon, WhatsApp, e-posta, adres ve iletişim formu üzerinden proje ve kentsel dönüşüm talepleriniz için bize ulaşın."
        canonical="/iletisim"
        breadcrumbs={[
          { name: "Ana Sayfa", path: "/" },
          { name: "İletişim", path: "/iletisim" },
        ]}
      />
      <section className="py-16 md:py-20 bg-gradient-dark text-white">
        <div className="container-narrow">
          <div className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-3">İletişim</div>
          <h1 className="font-display text-4xl md:text-6xl font-bold leading-tight">Bize Ulaşın</h1>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/70 md:text-base">
            2011'den bu yana süren saha deneyimiyle, projeniz için doğru başlangıç adımını birlikte netleştirelim.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container-narrow grid lg:grid-cols-2 gap-10">
          <div className="space-y-4">
            {cards.map((c) => {
              const Inner = (
                <div className="flex items-start gap-4 p-5 rounded-lg border border-border bg-card hover:border-accent/40 transition-colors">
                  <div className="h-12 w-12 rounded-md bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                    <c.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{c.title}</div>
                    <div className="font-semibold">{c.value}</div>
                  </div>
                </div>
              );
              return c.href ? <a key={c.title} href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">{Inner}</a> : <div key={c.title}>{Inner}</div>;
            })}

            {settings.map_embed_url && (
              <div className="aspect-video rounded-lg border border-border bg-surface-muted overflow-hidden">
                <iframe src={settings.map_embed_url} className="h-full w-full" loading="lazy" title="Harita" referrerPolicy="no-referrer-when-downgrade" />
              </div>
            )}
          </div>

          <form onSubmit={onSubmit} className="p-6 md:p-8 rounded-lg border border-border bg-card shadow-card-soft">
            <h2 className="font-display text-2xl font-bold mb-6">Projeniz İçin Bize Ulaşın</h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              {experienceYears}+ yıllık sektör deneyimiyle, talebinizi teknik ve uygulanabilir bir çerçevede değerlendirelim.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="full_name">Ad Soyad *</Label>
                <Input id="full_name" name="name" autoComplete="name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required maxLength={100} />
              </div>
              <div>
                <Label htmlFor="phone">Telefon *</Label>
                <Input id="phone" name="tel" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required maxLength={30} />
              </div>
              <div>
                <Label htmlFor="email">E-posta</Label>
                <Input id="email" name="email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="service_type">Hizmet Seçiniz *</Label>
                <Select value={form.service_type} onValueChange={(v) => setForm({ ...form, service_type: v })}>
                  <SelectTrigger id="service_type" aria-required="true"><SelectValue placeholder="Bir hizmet seçin" /></SelectTrigger>
                  <SelectContent>
                    {SERVICE_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <input type="hidden" name="service" value={form.service_type} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="message">Mesajınız *</Label>
                <Textarea id="message" name="message" autoComplete="message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={5} required maxLength={2000} />
              </div>
            </div>
            <div className="mt-5">
              {!turnstileError && <div ref={turnstileRef} />}
              {turnstileError && (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm text-destructive">{turnstileError}</p>
                  {siteKey && (
                    <Button type="button" size="sm" variant="outline" onClick={() => {
                      setTurnstileError(null);
                      setTurnstileReady(false);
                      setTurnstileToken("");
                      widgetId.current = null;
                      setRetryKey((k) => k + 1);
                    }}>
                      Tekrar Dene
                    </Button>
                  )}
                </div>
              )}
              {!turnstileError && !turnstileReady && <p className="mt-3 text-sm text-muted-foreground">Güvenlik doğrulaması yükleniyor...</p>}
            </div>
            <Button type="submit" disabled={submitting || !siteKey} aria-busy={submitting} className="mt-5 w-full bg-accent hover:bg-accent-glow text-accent-foreground font-semibold">
              {submitting ? "Gönderiliyor..." : "Gönder"}
            </Button>
          </form>
        </div>
      </section>
    </>
  );
}
