import { Outlet } from "react-router-dom";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import FloatingContact from "./FloatingContact";
import SalesChatbot from "./SalesChatbot";

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
      <FloatingContact />
      <SalesChatbot />
    </div>
  );
}
