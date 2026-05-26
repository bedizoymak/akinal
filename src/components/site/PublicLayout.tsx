import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import FloatingContact from "./FloatingContact";
import CookieConsent from "./CookieConsent";

export default function PublicLayout() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden flex flex-col bg-background">
      <SiteHeader />
      <main key={location.pathname} className="flex-1 w-full max-w-full overflow-x-hidden motion-safe:animate-public-page-in">
        <Outlet />
      </main>
      <SiteFooter />
      <FloatingContact />
      <CookieConsent />
    </div>
  );
}
