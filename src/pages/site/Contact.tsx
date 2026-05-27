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
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings, getWhatsAppLink, getTelLink, getMapsLink } from "@/hooks/useSiteSettings";
import { SERVICE_OPTIONS } from "@/lib/projects";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const isTurnstileConfigured = Boolean(TURNSTILE_SITE_KEY);
const showTurnstileDevMessage = !isTurnstileConfigured && import.meta.env.DEV;

type TurnstileRenderOptions = {
  sitekey: string;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
  theme: "light";
  language: "tr";
};

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: TurnstileRenderOptions) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

const schema = z.object({
  full_name: z.string().trim().min(2, "Ad Soyad zorunludur.").max(100),
  phone: z.string().trim().min(7, "Telefon numarası zorunludur.").max(30),
  email: z.string().trim().email("Geçerli bir e-posta giriniz.").max(255).optional().or(z.literal("")),
  service_type: z.string().min(1, "Lütfen bir hizmet seçin."),
  message: z.string().trim().min(5, "Mesajınızı yazınız.").max(2000),
});

export default function Contact() {
  const { settings } = useSiteSettings();
  const { toast } = useToast();
  const experienceYears = new Date().getFullYear() - 2011;
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", service_type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaError, setCaptchaError] = useState("");
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string>();

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !turnstileRef.current || widgetIdRef.current) return;

    const renderWidget = () => {
      if (!window.turnstile || !turnstileRef.current || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: "light",
        language: "tr",
        callback: (token) => {
          setCaptchaToken(token);
          setCaptchaError("");
        },
        "expired-callback": () => {
          setCaptchaToken("");
          setCaptchaError("Güvenlik doğrulamasının süresi doldu. Lütfen tekrar doğrulayın.");
        },
        "error-callback": () => {
          setCaptchaToken("");
          setCaptchaError("Güvenlik doğrulaması tamamlanamadı. Lütfen tekrar deneyin.");
        },
      });
    };

    if (window.turnstile) {
      renderWidget();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&hl=tr";
    script.async = true;
    script.defer = true;
    script.onload = renderWidget;
    document.head.appendChild(script);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isTurnstileConfigured) {
      toast({ title: "Güvenlik doğrulaması hazır değil", description: "Form şu anda gönderilemiyor. Lütfen daha sonra tekrar deneyin.", variant: "destructive" });
      return;
    }
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Form eksik", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    if (!captchaToken) {
      setCaptchaError("Lütfen Ben robot değilim doğrulamasını tamamlayın.");
      toast({ title: "Güvenlik doğrulaması gerekli", description: "Formu göndermek için Ben robot değilim doğrulamasını tamamlayın.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.functions.invoke("submit-contact-request", {
      body: {
        ...parsed.data,
        email: parsed.data.email || null,
        turnstileToken: captchaToken,
      },
    });
    setSubmitting(false);
    if (error) {
      setCaptchaToken("");
      setCaptchaError("Güvenlik doğrulaması yenilenmelidir. Lütfen tekrar doğrulayın.");
      window.turnstile?.reset(widgetIdRef.current);
      toast({ title: "Hata", description: "Talebiniz gönderilemedi. Lütfen tekrar deneyin.", variant: "destructive" });
      return;
    }
    toast({ title: "Talebiniz alındı", description: "Talebiniz başarıyla alındı. En kısa sürede sizinle iletişime geçeceğiz." });
    setForm({ full_name: "", phone: "", email: "", service_type: "", message: "" });
    setCaptchaToken("");
    window.turnstile?.reset(widgetIdRef.current);
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
                <Input id="full_name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required maxLength={100} />
              </div>
              <div>
                <Label htmlFor="phone">Telefon *</Label>
                <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required maxLength={30} />
              </div>
              <div>
                <Label htmlFor="email">E-posta</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="service_type">Hizmet Seçiniz *</Label>
                <Select value={form.service_type} onValueChange={(v) => setForm({ ...form, service_type: v })}>
                  <SelectTrigger id="service_type" aria-required="true"><SelectValue placeholder="Bir hizmet seçin" /></SelectTrigger>
                  <SelectContent>
                    {SERVICE_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="message">Mesajınız *</Label>
                <Textarea id="message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={5} required maxLength={2000} />
              </div>
              <div className="sm:col-span-2">
                <Label>Güvenlik Doğrulaması *</Label>
                <div className="mt-2 rounded-lg border border-border bg-background p-3">
                  {isTurnstileConfigured ? (
                    <div ref={turnstileRef} className="min-h-[65px]" />
                  ) : showTurnstileDevMessage ? (
                    <p className="text-sm text-muted-foreground">Dev: VITE_TURNSTILE_SITE_KEY tanımlanmadığı için Turnstile gösterilemiyor.</p>
                  ) : (
                    <div className="min-h-[65px]" aria-hidden="true" />
                  )}
                </div>
                {captchaError && <p className="mt-2 text-sm text-destructive">{captchaError}</p>}
              </div>
            </div>
            <Button type="submit" disabled={submitting || !isTurnstileConfigured || !captchaToken} aria-busy={submitting} className="mt-5 w-full bg-accent hover:bg-accent-glow text-accent-foreground font-semibold">
              {submitting ? "Gönderiliyor..." : "Gönder"}
            </Button>
          </form>
        </div>
      </section>
    </>
  );
}
