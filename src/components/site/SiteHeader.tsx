import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import logoImg from "@/assets/logo.png";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useSiteSettings } from "@/hooks/useSiteSettings";

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
  const [renderMobileMenu, setRenderMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const closeTimerRef = useRef<number>();
  const { pathname } = useLocation();
  const { settings } = useSiteSettings();
  const companyName = settings.company_name || "Şirket";

  function openMobileMenu() {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    setRenderMobileMenu(true);
    window.requestAnimationFrame(() => setOpen(true));
  }

  function closeMobileMenu() {
    setOpen(false);
  }

  function toggleMobileMenu() {
    if (open) closeMobileMenu();
    else openMobileMenu();
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => closeMobileMenu(), [pathname]);

  useEffect(() => {
    if (open) {
      setRenderMobileMenu(true);
      return;
    }

    closeTimerRef.current = window.setTimeout(() => setRenderMobileMenu(false), 350);
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "bg-background/95 backdrop-blur-md border-b border-border shadow-sm"
          : "bg-background/80 backdrop-blur-sm"
      )}
    >
      <div className="container-narrow flex h-20 md:h-24 items-center justify-between gap-6">
        <Link to="/" className="flex items-center shrink-0 group" aria-label={`${companyName} - Ana Sayfa`}>
          <img
            src={logoImg}
            alt={companyName}
            className="h-12 md:h-16 w-auto object-contain"
            loading="eager"
            decoding="async"
          />
        </Link>

        <nav className="hidden lg:flex flex-1 items-center justify-end gap-1.5">
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

        <button
          type="button"
          aria-label="Menü"
          aria-controls="site-mobile-menu"
          aria-expanded={open}
          className="lg:hidden p-2 -mr-2 text-foreground"
          onClick={toggleMobileMenu}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {renderMobileMenu && (
        <div
          id="site-mobile-menu"
          style={{
            transitionDuration: open ? "450ms" : "340ms",
            transitionTimingFunction: open ? "cubic-bezier(0.16, 1, 0.3, 1)" : "cubic-bezier(0.22, 1, 0.36, 1)",
          }}
          className={cn(
            "lg:hidden overflow-hidden border-t border-border bg-background transition-[max-height,opacity] motion-reduce:transition-none",
            open ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <nav className="container-narrow py-4 flex flex-col">
            {NAV.map((n, index) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/"}
                style={{
                  transitionDelay: open ? `${110 + index * 30}ms` : "0ms",
                  transitionDuration: "320ms",
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                }}
                className={({ isActive }) =>
                  cn(
                    "translate-y-0 px-3 py-3 text-base font-medium rounded-md opacity-100 transition-[opacity,transform] motion-reduce:transition-none",
                    renderMobileMenu && !open && "translate-y-1 opacity-0",
                    isActive ? "text-accent bg-muted" : "text-foreground hover:bg-muted"
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
