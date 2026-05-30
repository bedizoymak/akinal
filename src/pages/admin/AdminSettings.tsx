import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Globe2,
  Link2,
  MapPin,
  MessageCircle,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AdminEmptyState, AdminPageHeader } from "@/components/admin/AdminPage";
import AdminPushNotificationsPanel from "@/components/admin/AdminPushNotificationsPanel";
import { getWhatsAppLink, type SiteSettings } from "@/hooks/useSiteSettings";
import { getAdminSiteSettings, updateAdminSiteSettings, uploadAdminSiteAsset } from "@/lib/apiClient";
import { resolveImageUrl } from "@/lib/projects";
import { cn } from "@/lib/utils";

type EditableSiteSettings = SiteSettings & {
  updated_at?: string;
};

type StatusTone = "success" | "warning" | "danger";

const FIELD_HELPERS: Record<keyof Omit<SiteSettings, "id">, string> = {
  company_name: "Footer, SEO ve site genelindeki marka alanlarında kullanılır.",
  phone: "İletişim sayfası, footer ve mobil arama butonunda kullanılır.",
  whatsapp_number: "WhatsApp butonları ve iletişim yönlendirmelerinde kullanılır.",
  email: "İletişim sayfası ve footer alanında görünür.",
  address: "İletişim sayfası, footer ve konum bilgilerinde kullanılır.",
  map_embed_url: "İletişim sayfasındaki harita önizlemesinde kullanılır.",
  instagram_url: "Footer sosyal medya ikonunda kullanılır.",
  facebook_url: "Footer sosyal medya ikonunda kullanılır.",
  linkedin_url: "Footer sosyal medya ikonunda kullanılır.",
  footer_description: "Sitenin alt bölümünde firma logosunun yanında görünür.",
  hero_title: "Ana sayfanın ilk ekranındaki büyük başlıkta görünür.",
  hero_subtitle: "Ana sayfanın ilk ekranındaki açıklama metninde görünür.",
  favicon_url: "Tarayıcı sekmesi, Google ve kısayol ikonlarında kullanılır.",
  whatsapp_message: "WhatsApp yönlendirmelerinde otomatik hazır mesaj olarak kullanılır.",
  seo_title: "Ana sayfanın tarayıcı başlığı ve Google sonuç görünümünde kullanılır.",
  seo_description: "Ana sayfa meta description ve Google sonuç önizlemesinde kullanılır.",
};

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value: string) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidHttpUrl(value: string) {
  if (!value) return true;
  return /^https?:\/\//i.test(value);
}

function getStatusLabel(tone: StatusTone) {
  if (tone === "success") return "Tamamlandı";
  if (tone === "warning") return "Kontrol Gerekli";
  return "Eksik";
}

function statusClass(tone: StatusTone) {
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-200 bg-red-50 text-red-700";
}

function StatusPill({ tone, label }: { tone: StatusTone; label?: string }) {
  return <span className={cn("rounded-md border px-2 py-1 text-xs font-semibold", statusClass(tone))}>{label || getStatusLabel(tone)}</span>;
}

function SettingField({
  label,
  field,
  value,
  onChange,
  textarea,
  placeholder,
  warning,
  count,
}: {
  label: string;
  field: keyof Omit<SiteSettings, "id">;
  value: string;
  onChange: (value: string) => void;
  textarea?: boolean;
  placeholder?: string;
  warning?: string;
  count?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <Label>{label}</Label>
        {count && <span className="text-xs text-muted-foreground">{value.length} karakter</span>}
      </div>
      {textarea ? (
        <Textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      ) : (
        <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      )}
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{FIELD_HELPERS[field]}</p>
      {warning && (
        <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{warning}</span>
        </div>
      )}
    </div>
  );
}

function SettingsSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card shadow-card-soft">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-display text-xl font-bold tracking-normal">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-5 p-5">{children}</div>
    </section>
  );
}

function PreviewPanel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface-light p-4">
      <div className="mb-3">
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

export default function AdminSettings() {
  const [data, setData] = useState<EditableSiteSettings | null>(null);
  const [originalData, setOriginalData] = useState<EditableSiteSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      setLoading(true);
      try {
        const settings = await getAdminSiteSettings() as EditableSiteSettings | null;
        if (!active) return;
        setData(settings);
        setOriginalData(settings);
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : "Site ayarları yüklenemedi.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadSettings();

    return () => {
      active = false;
    };
  }, []);

  const dirty = useMemo(() => JSON.stringify(data) !== JSON.stringify(originalData), [data, originalData]);

  function up(field: keyof Omit<SiteSettings, "id">, value: string) {
    setData((current) => (current ? { ...current, [field]: value } : current));
  }

  const validation = useMemo(() => {
    if (!data) return { critical: [] as string[], warnings: {} as Record<string, string> };
    const warnings: Record<string, string> = {};
    const critical: string[] = [];
    const requiredFields: [keyof SiteSettings, string][] = [
      ["company_name", "Firma adı zorunludur."],
      ["phone", "Telefon numarası zorunludur."],
      ["whatsapp_number", "WhatsApp numarası zorunludur."],
    ];

    requiredFields.forEach(([field, message]) => {
      if (!textValue(data[field])) critical.push(message);
    });

    if (!isValidEmail(textValue(data.email))) critical.push("E-posta adresi geçerli görünmüyor.");

    (["map_embed_url", "instagram_url", "facebook_url", "linkedin_url"] as const).forEach((field) => {
      const value = textValue(data[field]);
      if (value && !isValidHttpUrl(value)) {
        warnings[field] = "Bağlantı http:// veya https:// ile başlamalıdır.";
      }
    });

    const favicon = textValue(data.favicon_url);
    if (favicon && !/^\/|https?:\/\//i.test(favicon)) {
      warnings.favicon_url = "Favicon yolu / veya http:// ya da https:// ile başlamalıdır.";
    }

    if (textValue(data.seo_title).length > 0 && textValue(data.seo_title).length < 30) warnings.seo_title = "SEO başlığı biraz kısa görünüyor.";
    if (textValue(data.seo_title).length > 60) warnings.seo_title = "SEO başlığı Google sonuçlarında kesilebilir.";
    if (textValue(data.seo_description).length > 0 && textValue(data.seo_description).length < 120) warnings.seo_description = "SEO açıklaması biraz kısa görünüyor.";
    if (textValue(data.seo_description).length > 160) warnings.seo_description = "SEO açıklaması Google sonuçlarında kesilebilir.";

    return { critical, warnings };
  }, [data]);

  const seo = useMemo(() => {
    if (!data) return { score: 0, checks: [] as { label: string; ok: boolean; detail: string }[] };
    const title = textValue(data.seo_title);
    const description = textValue(data.seo_description);
    const lowerDescription = description.toLocaleLowerCase("tr-TR");
    const checks = [
      { label: "SEO başlığı var", ok: title.length > 0, detail: title ? `${title.length} karakter` : "Başlık girilmemiş" },
      { label: "SEO başlığı ideal uzunlukta", ok: title.length >= 30 && title.length <= 60, detail: "İdeal aralık 30-60 karakter" },
      { label: "SEO açıklaması var", ok: description.length > 0, detail: description ? `${description.length} karakter` : "Açıklama girilmemiş" },
      { label: "SEO açıklaması ideal uzunlukta", ok: description.length >= 120 && description.length <= 160, detail: "İdeal aralık 120-160 karakter" },
      {
        label: "Odak terimler kullanılmış",
        ok: lowerDescription.includes("inşaat") && (lowerDescription.includes("kentsel dönüşüm") || lowerDescription.includes("istanbul")),
        detail: "Kentsel dönüşüm, inşaat ve İstanbul gibi terimler faydalıdır",
      },
      { label: "Firma adı tanımlı", ok: textValue(data.company_name).length > 0, detail: data.company_name || "Firma adı girilmemiş" },
    ];
    const score = Math.round((checks.filter((item) => item.ok).length / checks.length) * 100);
    return { score, checks };
  }, [data]);

  const statusCards = useMemo(() => {
    if (!data) return [];
    const urlWarning = Boolean(validation.warnings.map_embed_url);
    return [
      {
        title: "Site Bilgileri",
        tone: textValue(data.company_name) && textValue(data.footer_description) ? "success" : "danger",
        description: textValue(data.company_name) || "Firma adı eksik",
        icon: Settings,
      },
      {
        title: "İletişim",
        tone: textValue(data.phone) && textValue(data.email) && textValue(data.address) && isValidEmail(textValue(data.email)) ? "success" : "warning",
        description: textValue(data.phone) || "Telefon eksik",
        icon: ShieldCheck,
      },
      {
        title: "WhatsApp",
        tone: textValue(data.whatsapp_number) && textValue(data.whatsapp_message) ? "success" : "danger",
        description: textValue(data.whatsapp_number) || "Numara eksik",
        icon: MessageCircle,
      },
      {
        title: "SEO",
        tone: seo.score >= 80 ? "success" : seo.score >= 50 ? "warning" : "danger",
        description: `${seo.score}/100`,
        icon: Search,
      },
      {
        title: "Harita",
        tone: textValue(data.map_embed_url) ? (urlWarning ? "warning" : "success") : "danger",
        description: textValue(data.map_embed_url) ? "Harita bağlantısı var" : "Harita eksik",
        icon: MapPin,
      },
    ] as { title: string; tone: StatusTone; description: string; icon: LucideIcon }[];
  }, [data, seo.score, validation.warnings.map_embed_url]);

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
        Site ayarları yükleniyor...
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <AdminEmptyState
        title="Site ayarları yüklenemedi"
        description={loadError ? "Site ayarları alınırken bir problem oluştu. Lütfen bağlantınızı kontrol edip tekrar deneyin." : "Site ayar kaydı bulunamadı. Lütfen bağlantınızı kontrol edip tekrar deneyin."}
        icon={AlertCircle}
      />
    );
  }

  const whatsappUrl = getWhatsAppLink(data.whatsapp_number, data.whatsapp_message);
  const domainPreview = typeof window !== "undefined" ? window.location.origin : "https://akinalinsaat.com";
  const mapUrl = textValue(data.map_embed_url);
  const canPreviewMap = Boolean(mapUrl && isValidHttpUrl(mapUrl));

  function resetChanges() {
    setData(originalData);
    toast({ title: "Değişiklikler sıfırlandı", description: "Form son kaydedilen hâline döndürüldü." });
  }

  async function save() {
    if (!data || saving) return;
    if (validation.critical.length > 0) {
      toast({ title: "Kontrol gerekli", description: validation.critical[0], variant: "destructive" });
      return;
    }

    const invalidUrlWarning = Object.values(validation.warnings).find((message) => message.includes("http"));
    if (invalidUrlWarning) {
      toast({ title: "Bağlantıları kontrol edin", description: invalidUrlWarning, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const saved = await updateAdminSiteSettings(data);
      setOriginalData((saved || data) as EditableSiteSettings);
      setData((saved || data) as EditableSiteSettings);
      toast({ title: "Site ayarları kaydedildi", description: "Web sitesi ayarları güncellendi." });
    } catch {
      toast({ title: "Site ayarları kaydedilemedi", description: "Ayarlar kaydedilirken bir problem oluştu. Lütfen tekrar deneyin.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function uploadFavicon(file: File) {
    setUploadingFavicon(true);
    try {
      const url = await uploadAdminSiteAsset(file);
      up("favicon_url", url);
      toast({ title: "Favicon yüklendi", description: "Kaydettiğinizde site ayarlarına uygulanacak." });
    } catch {
      toast({ title: "Favicon yüklenemedi", description: "ICO, PNG, SVG veya WEBP dosyası seçtiğinizden emin olun.", variant: "destructive" });
    } finally {
      setUploadingFavicon(false);
      if (faviconInputRef.current) faviconInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Site Kontrol Merkezi"
        title="Site Ayarları"
        description="Web sitesinin kimlik, iletişim, ana sayfa ve SEO ayarlarını tek merkezden yönetin."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/" target="_blank">
                <ExternalLink className="h-4 w-4" />
                Siteyi Görüntüle
              </Link>
            </Button>
            <Button variant="outline" onClick={resetChanges} disabled={!dirty || saving}>
              <RotateCcw className="h-4 w-4" />
              Değişiklikleri Sıfırla
            </Button>
            <Button onClick={save} disabled={saving || !dirty} className="bg-accent text-accent-foreground hover:bg-accent-glow">
              <Save className="h-4 w-4" />
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </>
        }
      />

      {dirty && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Kaydedilmemiş değişiklikler var.
        </div>
      )}

      {validation.critical.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <div className="font-semibold">Kaydetmeden önce düzeltilmesi gereken alanlar:</div>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {validation.critical.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {statusCards.map((card) => (
          <div key={card.title} className="rounded-lg border border-border bg-card p-4 shadow-card-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{card.title}</div>
                <div className="mt-2 text-sm text-muted-foreground">{card.description}</div>
              </div>
              <card.icon className="h-5 w-5 text-accent" />
            </div>
            <div className="mt-4"><StatusPill tone={card.tone} /></div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <SettingsSection title="Firma Bilgileri" description="Marka adı ve site alt bölümünde kullanılan kurumsal açıklama.">
            <SettingField label="Firma Adı" field="company_name" value={data.company_name || ""} onChange={(value) => up("company_name", value)} />
            <SettingField label="Footer Açıklaması" field="footer_description" value={data.footer_description || ""} onChange={(value) => up("footer_description", value)} textarea count />
            <div>
              <div className="mb-1 flex items-center justify-between gap-3">
                <Label>Favicon</Label>
                <span className="text-xs text-muted-foreground">ICO, PNG, SVG, WEBP</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-[72px_minmax(0,1fr)]">
                <div className="flex h-[72px] w-[72px] items-center justify-center rounded-md border border-border bg-surface-light">
                  <img src={resolveImageUrl(data.favicon_url || "/favicon.png")} alt="Favicon önizleme" className="h-10 w-10 object-contain" />
                </div>
                <div className="space-y-2">
                  <Input value={data.favicon_url || ""} onChange={(event) => up("favicon_url", event.target.value)} placeholder="/favicon.png veya /uploads/site/favicon.png" />
                  <div className="flex flex-wrap gap-2">
                    <input ref={faviconInputRef} type="file" accept=".ico,image/png,image/svg+xml,image/webp" className="hidden" onChange={(event) => event.target.files?.[0] && uploadFavicon(event.target.files[0])} />
                    <Button type="button" variant="outline" onClick={() => faviconInputRef.current?.click()} disabled={uploadingFavicon}>
                      <UploadCloud className="h-4 w-4" />
                      {uploadingFavicon ? "Yükleniyor..." : "Favicon Yükle"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => up("favicon_url", "/favicon.png")}>Varsayılana Dön</Button>
                  </div>
                </div>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{FIELD_HELPERS.favicon_url}</p>
              {validation.warnings.favicon_url && (
                <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{validation.warnings.favicon_url}</span>
                </div>
              )}
            </div>
          </SettingsSection>

          <SettingsSection title="İletişim ve Satış Kanalları" description="Ziyaretçilerin size ulaşmasını sağlayan telefon, WhatsApp, e-posta ve adres bilgileri.">
            <div className="grid gap-5 md:grid-cols-2">
              <SettingField label="Telefon" field="phone" value={data.phone || ""} onChange={(value) => up("phone", value)} />
              <SettingField label="WhatsApp Numarası" field="whatsapp_number" value={data.whatsapp_number || ""} onChange={(value) => up("whatsapp_number", value)} />
              <SettingField label="E-posta" field="email" value={data.email || ""} onChange={(value) => up("email", value)} warning={!isValidEmail(textValue(data.email)) ? "E-posta adresi geçerli görünmüyor." : undefined} />
              <SettingField label="Adres" field="address" value={data.address || ""} onChange={(value) => up("address", value)} />
            </div>
            <SettingField label="WhatsApp Hazır Mesajı" field="whatsapp_message" value={data.whatsapp_message || ""} onChange={(value) => up("whatsapp_message", value)} textarea count />

            <PreviewPanel title="WhatsApp Link Önizleme" description="Web sitesindeki WhatsApp butonları bu bağlantı mantığını kullanır.">
              <div className="rounded-md border border-border bg-card p-3 text-xs text-muted-foreground break-all">{whatsappUrl}</div>
              <Button asChild className="mt-3 bg-[#25D366] text-white hover:bg-[#1fb856]">
                <a href={whatsappUrl} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp Test Et
                </a>
              </Button>
            </PreviewPanel>
          </SettingsSection>

          <SettingsSection title="Ana Sayfa Hero Alanı" description="Ana sayfanın ilk ekranda verdiği ana mesajı yönetin.">
            <SettingField label="Hero Başlığı" field="hero_title" value={data.hero_title || ""} onChange={(value) => up("hero_title", value)} count />
            <SettingField label="Hero Alt Başlığı" field="hero_subtitle" value={data.hero_subtitle || ""} onChange={(value) => up("hero_subtitle", value)} textarea count />

            <PreviewPanel title="Ana Sayfa Hero Önizleme" description="Ana sayfanın ilk ekranındaki mesajın kompakt önizlemesi.">
              <div className="rounded-lg bg-gradient-dark p-5 text-white">
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent">Akinal İnşaat</div>
                <div className="font-display text-2xl font-bold leading-tight">{data.hero_title || "Hero başlığı girilmemiş"}</div>
                <p className="mt-3 text-sm leading-relaxed text-white/75">{data.hero_subtitle || "Hero açıklaması girilmemiş"}</p>
              </div>
            </PreviewPanel>
          </SettingsSection>

          <SettingsSection title="Sosyal Medya" description="Footer alanındaki sosyal medya bağlantılarını yönetin. Boş bırakılan bağlantılar sitede görünmez.">
            <div className="grid gap-5 md:grid-cols-3">
              <SettingField label="Instagram Linki" field="instagram_url" value={data.instagram_url || ""} onChange={(value) => up("instagram_url", value)} warning={validation.warnings.instagram_url} />
              <SettingField label="Facebook Linki" field="facebook_url" value={data.facebook_url || ""} onChange={(value) => up("facebook_url", value)} warning={validation.warnings.facebook_url} />
              <SettingField label="LinkedIn Linki" field="linkedin_url" value={data.linkedin_url || ""} onChange={(value) => up("linkedin_url", value)} warning={validation.warnings.linkedin_url} />
            </div>
          </SettingsSection>

          <SettingsSection title="SEO Ayarları" description="Ana sayfanın arama motoru ve sosyal paylaşım görünümünü yönetin.">
            <SettingField label="SEO Başlığı" field="seo_title" value={data.seo_title || ""} onChange={(value) => up("seo_title", value)} warning={validation.warnings.seo_title} count />
            <SettingField label="SEO Açıklaması" field="seo_description" value={data.seo_description || ""} onChange={(value) => up("seo_description", value)} textarea warning={validation.warnings.seo_description} count />

            <PreviewPanel title="Google Sonuç Önizlemesi" description="Bu görünüm yaklaşık bir arama sonucu önizlemesidir.">
              <div className="rounded-lg border border-border bg-white p-4">
                <div className="text-sm text-[#202124]">{domainPreview}</div>
                <div className="mt-1 text-xl text-[#1a0dab]">{data.seo_title || "SEO başlığı girilmemiş"}</div>
                <p className="mt-1 text-sm leading-relaxed text-[#4d5156]">{data.seo_description || "SEO açıklaması girilmemiş"}</p>
              </div>
            </PreviewPanel>

            <PreviewPanel title="Google Sitelinks Hedef Önizlemesi" description="Ana marka aramasında hedeflenen bağlantı mimarisinin temsili görünümü.">
              <div className="rounded-lg border border-border bg-white p-4">
                <div className="text-sm text-[#202124]">{domainPreview}</div>
                <div className="mt-1 text-xl text-[#1a0dab]">{data.company_name || "Akinal İnşaat"}</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {["Projelerimiz", "Kentsel Dönüşüm", "Hakkımızda", "İletişim"].map((item) => (
                    <div key={item} className="rounded-md border border-[#dadce0] px-3 py-2">
                      <div className="text-sm font-medium text-[#1a0dab]">{item}</div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  Google sitelinks bağlantılarını garanti etmez. Bu alan, doğru site mimarisi ve SEO çalışmasıyla hedeflenen görünümü temsil eder.
                </p>
              </div>
            </PreviewPanel>
          </SettingsSection>

          <SettingsSection title="Admin Bildirimleri" description="Bu cihaza özel yönetim paneli tarayıcı bildirimleri.">
            <AdminPushNotificationsPanel />
          </SettingsSection>
        </div>

        <aside className="space-y-6">
          <section className="rounded-lg border border-border bg-card p-5 shadow-card-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold">SEO Kalite Skoru</h2>
                <p className="mt-1 text-sm text-muted-foreground">Ana sayfa SEO alanlarının temel durumu.</p>
              </div>
              <div className={cn("rounded-md border px-3 py-2 text-2xl font-bold", seo.score >= 80 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : seo.score >= 50 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-red-200 bg-red-50 text-red-700")}>
                {seo.score}
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {seo.checks.map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                  {item.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}
                  <div>
                    <div className="text-sm font-medium">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5 shadow-card-soft">
            <h2 className="font-display text-xl font-bold">Entegrasyon Durumu</h2>
            <p className="mt-1 text-sm text-muted-foreground">Bu ayarların web sitesiyle bağlantı durumu.</p>
            <div className="mt-5 space-y-3">
              {[
                ["Ana sayfa hero başlığı", "Aktif", "success"],
                ["Ana sayfa hero açıklaması", "Aktif", "success"],
                ["Footer firma bilgileri", "Aktif", "success"],
                ["Telefon / WhatsApp butonları", "Aktif", "success"],
                ["İletişim sayfası", "Aktif", "success"],
                ["Harita", textValue(data.map_embed_url) ? "Aktif" : "Eksik", textValue(data.map_embed_url) ? "success" : "danger"],
                ["Genel SEO", "Kısmi", "warning"],
                ["Sitelinks Hazırlığı", "Teknik altyapı hazır / Google tarafından otomatik belirlenir", "success"],
                ["Sayfa bazlı SEO", "Gelecek geliştirme", "warning"],
                ["Chatbot WhatsApp entegrasyonu", "Ayrı yapı / kontrol gerekli", "warning"],
              ].map(([label, status, tone]) => (
                <div key={label} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                  <span className="text-sm font-medium">{label}</span>
                  <StatusPill tone={tone as StatusTone} label={status} />
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
              Sayfa bazlı SEO yönetimi için ileride ayrı SEO ayar tablosu önerilir.
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5 shadow-card-soft">
            <h2 className="font-display text-xl font-bold">Harita Önizlemesi</h2>
            <p className="mt-1 text-sm text-muted-foreground">İletişim sayfasındaki Google Maps alanı.</p>
            <div className="mt-4">
              <SettingField label="Google Maps Embed Linki" field="map_embed_url" value={data.map_embed_url || ""} onChange={(value) => up("map_embed_url", value)} warning={validation.warnings.map_embed_url} />
              {canPreviewMap ? (
                <div className="mt-4 aspect-video overflow-hidden rounded-lg border border-border bg-surface-light">
                  <iframe src={mapUrl} className="h-full w-full" loading="lazy" title="Harita önizlemesi" />
                </div>
              ) : (
                <div className="mt-4">
                  <AdminEmptyState
                    title={mapUrl ? "Harita bağlantısı geçerli değil" : "Harita bağlantısı yok"}
                    description={mapUrl ? "Önizleme için bağlantı http:// veya https:// ile başlamalıdır." : "Google Maps embed linki eklendiğinde iletişim sayfasında harita görünür."}
                    icon={MapPin}
                  />
                </div>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5 shadow-card-soft">
            <h2 className="font-display text-xl font-bold">Bağlantı Kontrolü</h2>
            <div className="mt-4 grid gap-2">
              <Button asChild variant="outline" className="justify-between">
                <a href={whatsappUrl} target="_blank" rel="noreferrer">
                  WhatsApp Linkini Aç
                  <Link2 className="h-4 w-4" />
                </a>
              </Button>
              <Button asChild variant="outline" className="justify-between">
                <Link to="/" target="_blank">
                  Ana Sayfayı Aç
                  <Globe2 className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
