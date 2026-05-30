export interface SiteSettings {
  id: string;
  company_name: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  email: string | null;
  address: string | null;
  map_embed_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  linkedin_url: string | null;
  footer_description: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  whatsapp_message: string | null;
  seo_title: string | null;
  seo_description: string | null;
  updated_at?: string | null;
}

export interface PublicProject {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  detailed_description?: string | null;
  project_type: string | null;
  project_status: string | null;
  location: string | null;
  city: string | null;
  district: string | null;
  start_year?: string | number | null;
  delivery_year?: string | number | null;
  land_area?: string | null;
  construction_area?: string | null;
  apartment_count?: string | number | null;
  floor_count?: string | number | null;
  block_count?: string | number | null;
  cover_image_url: string | null;
  is_featured: boolean | number | null;
  is_published?: boolean | number | null;
  sort_order: number | null;
  seo_title?: string | null;
  seo_description?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface ProjectImage {
  id: string;
  project_id?: string;
  image_url: string;
  thumbnail_url?: string | null;
  title?: string | null;
  alt_text?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
}

export interface ProjectDetailResponse {
  project: PublicProject;
  images: ProjectImage[];
}
