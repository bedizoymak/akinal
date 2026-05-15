import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import Seo from "@/components/site/Seo";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <>
      <Seo title="Sayfa Bulunamadı" description="Aradığınız sayfa bulunamadı." noIndex />
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold">404</h1>
          <p className="mb-4 text-xl text-muted-foreground">Aradığınız sayfa bulunamadı.</p>
          <a href="/" className="text-primary underline hover:text-primary/90">
            Ana Sayfaya Dön
          </a>
        </div>
      </div>
    </>
  );
};

export default NotFound;
