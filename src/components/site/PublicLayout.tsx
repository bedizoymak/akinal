import { Outlet } from "react-router-dom";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import FloatingContact from "./FloatingContact";
import SalesChatbot from "./SalesChatbot";

export default function PublicLayout() {
  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 w-full max-w-full overflow-x-hidden">
        <Outlet />
      </main>
      <SiteFooter />
      <FloatingContact />
      <SalesChatbot />
    </div>
  );
}
