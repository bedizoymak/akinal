import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import logoImg from "@/assets/logo.png";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Ana Sayfa" },
  { to: "/hakkimizda", label: "Hakkımızda" },
  { to: "/hizmetlerimiz", label: "Hizmetlerimiz" },
  { to: "/projelerimiz", label: "Projelerimiz" },
  { to: "/kentsel-donusum", label: "Kentsel Dönüşüm" },
  { to: "/iletisim", label: "İletişim" },
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "bg-background/95 backdrop-blur-md border-b border-border shadow-sm"
          : "bg-background/80 backdrop-blur-sm"
      )}
    >
      <div className="container-narrow flex h-16 md:h-20 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="h-10 w-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center shadow-card-soft group-hover:bg-accent transition-colors">
            <Building2 className="h-5 w-5" strokeWidth={2.2} />
          </div>
          <div className="leading-tight">
            <div className="font-display text-lg md:text-xl font-bold tracking-tight">Akınal İnşaat</div>
            <div className="text-[10px] md:text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Kentsel Dönüşüm · İnşaat
            </div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                cn(
                  "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "text-accent"
                    : "text-foreground/80 hover:text-foreground hover:bg-muted"
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden md:flex items-center">
          <Button asChild variant="default" className="bg-accent hover:bg-accent-glow text-accent-foreground font-semibold shadow-accent-glow">
            <Link to="/iletisim">Teklif Al</Link>
          </Button>
        </div>

        <button
          aria-label="Menü"
          className="lg:hidden p-2 -mr-2 text-foreground"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden border-t border-border bg-background">
          <nav className="container-narrow py-4 flex flex-col">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "px-3 py-3 text-base font-medium rounded-md",
                    isActive ? "text-accent bg-muted" : "text-foreground hover:bg-muted"
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
            <Button asChild className="mt-3 bg-accent hover:bg-accent-glow text-accent-foreground font-semibold">
              <Link to="/iletisim">Teklif Al</Link>
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}
