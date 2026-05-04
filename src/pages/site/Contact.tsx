import { useState } from "react";
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
import { useSiteSettings, getWhatsAppLink, getTelLink } from "@/hooks/useSiteSettings";
import { SERVICE_OPTIONS } from "@/lib/projects";

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
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", service_type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Form eksik", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("contact_requests").insert({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      service_type: parsed.data.service_type,
      message: parsed.data.message,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Hata", description: "Talebiniz gönderilemedi. Lütfen tekrar deneyin.", variant: "destructive" });
      return;
    }
    toast({ title: "Talebiniz alındı", description: "Talebiniz başarıyla alındı. En kısa sürede sizinle iletişime geçeceğiz." });
    setForm({ full_name: "", phone: "", email: "", service_type: "", message: "" });
  }

  const cards = [
    { icon: Phone, title: "Telefon", value: settings.phone, href: getTelLink(settings.phone) },
    { icon: MessageCircle, title: "WhatsApp", value: settings.whatsapp_number, href: getWhatsAppLink(settings.whatsapp_number, settings.whatsapp_message) },
    { icon: Mail, title: "E-posta", value: settings.email, href: `mailto:${settings.email}` },
    { icon: MapPin, title: "Adres", value: settings.address, href: undefined },
  ];

  return (
    <>
      <Seo title="İletişim" description="Akınal İnşaat iletişim bilgileri ve teklif formu." />
      <section className="py-16 md:py-20 bg-gradient-dark text-white">
        <div className="container-narrow">
          <div className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-3">İletişim</div>
          <h1 className="font-display text-4xl md:text-6xl font-bold leading-tight">Bize Ulaşın</h1>
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

            <div className="aspect-video rounded-lg border border-border bg-surface-muted overflow-hidden">
              {settings.map_embed_url ? (
                <iframe src={settings.map_embed_url} className="h-full w-full" loading="lazy" title="Harita" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">Harita alanı buraya eklenecek.</div>
              )}
            </div>
          </div>

          <form onSubmit={onSubmit} className="p-6 md:p-8 rounded-lg border border-border bg-card shadow-card-soft">
            <h2 className="font-display text-2xl font-bold mb-6">Projeniz İçin Bize Ulaşın</h2>
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
                <Label>Hizmet Seçiniz *</Label>
                <Select value={form.service_type} onValueChange={(v) => setForm({ ...form, service_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Bir hizmet seçin" /></SelectTrigger>
                  <SelectContent>
                    {SERVICE_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="message">Mesajınız *</Label>
                <Textarea id="message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={5} required maxLength={2000} />
              </div>
            </div>
            <Button type="submit" disabled={submitting} className="mt-5 w-full bg-accent hover:bg-accent-glow text-accent-foreground font-semibold">
              {submitting ? "Gönderiliyor..." : "Gönder"}
            </Button>
          </form>
        </div>
      </section>
    </>
  );
}
