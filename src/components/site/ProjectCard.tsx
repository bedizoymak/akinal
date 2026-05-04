import { Link } from "react-router-dom";
import { MapPin, ArrowRight } from "lucide-react";
import { resolveImageUrl, statusBadgeVariant } from "@/lib/projects";
import { cn } from "@/lib/utils";

export interface ProjectCardData {
  id: string;
  title: string;
  slug: string;
  short_description: string;
  project_type: string;
  project_status: string;
  location: string;
  cover_image_url: string | null;
}

export default function ProjectCard({ project }: { project: ProjectCardData }) {
  return (
    <Link
      to={`/projelerimiz/${project.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-card-soft hover:shadow-elegant transition-all duration-500 hover:-translate-y-1"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {project.cover_image_url ? (
          <img
            src={resolveImageUrl(project.cover_image_url)}
            alt={project.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-gradient-dark" />
        )}
        <div className="absolute top-3 left-3 flex gap-2">
          <span className={cn("px-2.5 py-1 text-[11px] font-semibold rounded-md border backdrop-blur-sm bg-background/90", statusBadgeVariant(project.project_status))}>
            {project.project_status}
          </span>
        </div>
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <div className="text-xs uppercase tracking-wider text-accent font-semibold mb-2">{project.project_type}</div>
        <h3 className="font-display text-xl font-bold text-foreground leading-snug mb-2 group-hover:text-accent transition-colors">
          {project.title}
        </h3>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
          <MapPin className="h-3.5 w-3.5" /> {project.location}
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-5">{project.short_description}</p>
        <div className="mt-auto flex items-center text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
          Detayları İncele
          <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}
