import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getProjectDetail, getPublishedProjects, getAdminProject, getAdminProjectImages } from "@/lib/apiClient";
import Seo from "@/components/site/Seo";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, MapPin, MessageCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { resolveImageUrl, statusBadgeVariant } from "@/lib/projects";
import { cn } from "@/lib/utils";
import useEmblaCarousel from "embla-carousel-react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { useSiteSettings, getWhatsAppLink } from "@/hooks/useSiteSettings";

type ProjectDetailData = {
  id: string;
  title: string;
  slug: string;
  seo_title?: string | null;
  seo_description?: string | null;
  short_description?: string | null;
  detailed_description?: string | null;
  cover_image_url?: string | null;
  project_type?: string | null;
  project_status?: string | null;
  location?: string | null;
  start_year?: string | number | null;
  delivery_year?: string | number | null;
  land_area?: string | null;
  construction_area?: string | null;
  apartment_count?: string | number | null;
  floor_count?: string | number | null;
  block_count?: string | number | null;
};

type ProjectImage = {
  id: string;
  image_url: string;
  title?: string | null;
  alt_text?: string | null;
};

type ProjectSibling = {
  id: string;
  title: string;
  slug: string;
  sort_order: number | null;
  created_at: string;
};

// previewProjectId (P2-1): when set, this renders an AUTHENTICATED admin
// preview of a project by id — including unpublished drafts — via the
// admin-only endpoints (getAdminProject/getAdminProjectImages), instead of
// the public getProjectDetail(slug) endpoint (which only ever returns
// published projects, by design — never weakened here). Only reachable
// through an /admin/* route, so it inherits the same admin-session gate as
// every other admin page. When previewProjectId is absent, behavior is
// byte-for-byte the original public page.
export default function ProjectDetail({ previewProjectId }: { previewProjectId?: string } = {}) {
  const { slug } = useParams();
  const [project, setProject] = useState<ProjectDetailData | null>(null);
  const [images, setImages] = useState<ProjectImage[]>([]);
  const [siblings, setSiblings] = useState<ProjectSibling[]>([]);
  const [loading, setLoading] = useState(true);
  const [lbIndex, setLbIndex] = useState(-1);
  const [emblaRef, embla] = useEmblaCarousel({ loop: true });
  const { settings } = useSiteSettings();

  useEffect(() => {
    if (previewProjectId) {
      setLoading(true);
      (async () => {
        try {
          const [projectData, imgs] = await Promise.all([
            getAdminProject(previewProjectId),
            getAdminProjectImages(previewProjectId),
          ]);
          setProject(projectData as unknown as ProjectDetailData | null);
          setImages((imgs as ProjectImage[]) || []);
          setSiblings([]);
        } catch (error) {
          console.error("Admin project preview API error:", error);
          setProject(null);
          setImages([]);
          setSiblings([]);
        } finally {
          setLoading(false);
        }
      })();
      return;
    }

    if (!slug) return;
    setLoading(true);
    (async () => {
      try {
        const [detail, all] = await Promise.all([
          getProjectDetail(slug),
          getPublishedProjects(),
        ]);
        const projectData = detail.project as ProjectDetailData;
        setProject(projectData);
        setImages((detail.images as ProjectImage[]) || []);
        const sorted = ((all as ProjectSibling[]) || []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.created_at.localeCompare(b.created_at));
        setSiblings(sorted);
      } catch (error) {
        console.error("Project detail API error:", error);
        setProject(null);
        setImages([]);
        setSiblings([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, previewProjectId]);

  if (loading) return <div className="container-narrow py-32 text-center text-muted-foreground">Yükleniyor...</div>;
  if (!project) return (
    <div className="container-narrow py-32 text-center">
      <h1 className="font-display text-3xl font-bold mb-4">Proje bulunamadı</h1>
      {previewProjectId ? (
        <Button asChild><Link to={`/admin/projeler/${previewProjectId}`}>Proje Düzenlemeye Dön</Link></Button>
      ) : (
        <Button asChild><Link to="/projelerimiz">Projelere Dön</Link></Button>
      )}
    </div>
  );

  const previewBanner = previewProjectId ? (
    <div className="bg-amber-500 py-2 text-center text-sm font-semibold text-white">
      Taslak Önizleme — bu sayfa yalnızca size görünür, proje henüz yayınlanmadı.
    </div>
  ) : null;

  const sliderImages: ProjectImage[] = images.length > 0 ? images : (project.cover_image_url ? [{ id: "cover", image_url: project.cover_image_url, title: project.title }] : []);
  const idx = siblings.findIndex((s) => s.id === project.id);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;

  const techRows: [string, string | number | null | undefined][] = [
    ["Proje Türü", project.project_type],
    ["Proje Durumu", project.project_status],
    ["Konum", project.location],
    ["Başlangıç Yılı", project.start_year],
    ["Teslim Yılı", project.delivery_year],
    ["Arsa Alanı", project.land_area],
    ["İnşaat Alanı", project.construction_area],
    ["Daire Sayısı", project.apartment_count],
    ["Kat Sayısı", project.floor_count],
    ["Blok Sayısı", project.block_count],
  ];

  return (
    <>
      {previewBanner}
      {!previewProjectId && (
        <Seo
          title={project.seo_title || project.title}
          description={project.seo_description || project.short_description}
          canonical={`/projelerimiz/${project.slug}`}
          breadcrumbs={[
            { name: "Ana Sayfa", path: "/" },
            { name: "Projelerimiz", path: "/projelerimiz" },
            { name: project.title, path: `/projelerimiz/${project.slug}` },
          ]}
        />
      )}

      {/* Hero */}
      <section className="relative h-[60vh] md:h-[70vh] overflow-hidden bg-primary">
        {project.cover_image_url && (
          <img src={resolveImageUrl(project.cover_image_url)} alt={project.title} className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="absolute inset-x-0 bottom-0 container-narrow pb-12 text-white">
          <Link to="/projelerimiz" className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white mb-4">
            <ArrowLeft className="h-4 w-4" /> Tüm Projeler
          </Link>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className={cn("px-2.5 py-1 text-[11px] font-semibold rounded-md border bg-white/10 backdrop-blur", statusBadgeVariant(project.project_status))}>{project.project_status}</span>
            <span className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-white/20 bg-white/10 backdrop-blur text-white">{project.project_type}</span>
          </div>
          <h1 className="font-display text-3xl md:text-5xl lg:text-6xl font-bold leading-tight max-w-4xl">{project.title}</h1>
          <div className="mt-4 flex items-center gap-2 text-white/80"><MapPin className="h-4 w-4" /> {project.location}</div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container-narrow grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-10">
            <div>
              <h2 className="font-display text-2xl font-bold mb-4">Proje Hakkında</h2>
              <p className="text-base md:text-lg text-foreground/85 leading-relaxed mb-4">{project.short_description}</p>
              {project.detailed_description && (
                <div className="text-muted-foreground leading-relaxed whitespace-pre-line">{project.detailed_description}</div>
              )}
            </div>

            {sliderImages.length > 0 && (
              <div>
                <h2 className="font-display text-2xl font-bold mb-4">Görseller</h2>
                <div className="relative">
                  <div className="overflow-hidden rounded-lg" ref={emblaRef}>
                    <div className="flex">
                      {sliderImages.map((img, i) => (
                        <button key={img.id} type="button" onClick={() => setLbIndex(i)} className="flex-[0_0_100%] min-w-0 aspect-[16/9] bg-muted">
                          <img src={resolveImageUrl(img.image_url)} alt={img.alt_text || img.title || project.title} className="h-full w-full object-cover" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  </div>
                  {sliderImages.length > 1 && (
                    <>
                      <button type="button" onClick={() => embla?.scrollPrev()} aria-label="Önceki görsel" className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/95 border border-border shadow-card-soft flex items-center justify-center hover:bg-accent hover:text-accent-foreground transition-colors">
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button type="button" onClick={() => embla?.scrollNext()} aria-label="Sonraki görsel" className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/95 border border-border shadow-card-soft flex items-center justify-center hover:bg-accent hover:text-accent-foreground transition-colors">
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </div>
                {sliderImages.length > 1 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mt-4">
                    {sliderImages.map((img, i) => (
                      <button key={img.id} type="button" onClick={() => setLbIndex(i)} aria-label={`${i + 1}. görseli aç`} className="aspect-square overflow-hidden rounded-md border border-border hover:border-accent transition-colors">
                        <img src={resolveImageUrl(img.image_url)} alt="" className="h-full w-full object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <div className="rounded-lg border border-border bg-surface-light overflow-hidden">
              <div className="px-5 py-4 bg-primary text-primary-foreground">
                <h3 className="font-display text-lg font-bold">Teknik Bilgiler</h3>
              </div>
              <dl className="divide-y divide-border">
                {techRows.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 px-5 py-3 text-sm">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-semibold text-right">{v || "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="rounded-lg border border-accent/40 bg-accent/5 p-6">
              <h3 className="font-display text-lg font-bold mb-2">Benzer Bir Proje İçin Görüşelim</h3>
              <p className="text-sm text-muted-foreground mb-4">Arsanız veya binanız için ücretsiz ön değerlendirme alın.</p>
              <div className="flex flex-col gap-2">
                <Button asChild className="bg-[#25D366] hover:bg-[#20BD5C] text-white"><a href={getWhatsAppLink(settings.whatsapp_number, settings.whatsapp_message)} target="_blank" rel="noreferrer"><MessageCircle className="mr-2 h-4 w-4" />WhatsApp ile Görüş</a></Button>
                <Button asChild variant="outline"><Link to="/iletisim">İletişim Formu</Link></Button>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {(prev || next) && (
        <section className="py-10 border-t border-border">
          <div className="container-narrow flex flex-col sm:flex-row gap-4 justify-between items-stretch">
            {prev ? (
              <Link to={`/projelerimiz/${prev.slug}`} className="group flex-1 p-5 rounded-lg border border-border hover:border-accent transition-colors">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Önceki Proje</div>
                <div className="font-display font-bold group-hover:text-accent transition-colors">{prev.title}</div>
              </Link>
            ) : <div className="flex-1" />}
            {next ? (
              <Link to={`/projelerimiz/${next.slug}`} className="group flex-1 p-5 rounded-lg border border-border hover:border-accent transition-colors text-right">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-end gap-1">Sonraki Proje <ArrowRight className="h-3 w-3" /></div>
                <div className="font-display font-bold group-hover:text-accent transition-colors">{next.title}</div>
              </Link>
            ) : <div className="flex-1" />}
          </div>
        </section>
      )}

      <Lightbox
        open={lbIndex >= 0}
        index={lbIndex < 0 ? 0 : lbIndex}
        close={() => setLbIndex(-1)}
        slides={sliderImages.map((img) => ({ src: resolveImageUrl(img.image_url), title: img.title || project.title }))}
      />
    </>
  );
}
