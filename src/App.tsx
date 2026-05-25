import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import PublicLayout from "./components/site/PublicLayout";
import Home from "./pages/site/Home";
import About from "./pages/site/About";
import Services from "./pages/site/Services";
import Projects from "./pages/site/Projects";
import ProjectDetail from "./pages/site/ProjectDetail";
import UrbanTransformation from "./pages/site/UrbanTransformation";
import Contact from "./pages/site/Contact";
import NotFound from "./pages/NotFound";

import AdminAuth from "./pages/admin/AdminAuth";
import AdminLayout from "./components/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProjects from "./pages/admin/AdminProjects";
import AdminProjectEdit from "./pages/admin/AdminProjectEdit";
import AdminMedia from "./pages/admin/AdminMedia";
import AdminContacts from "./pages/admin/AdminContacts";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminCustomers from "./pages/admin/AdminCustomers";
import AdminCustomerEdit from "./pages/admin/AdminCustomerEdit";
import AdminCustomerDetail from "./pages/admin/AdminCustomerDetail";
import AdminCustomerFinance from "./pages/admin/AdminCustomerFinance";
import AdminEmployees from "./pages/admin/AdminEmployees";
import AdminEmployeeFinance from "./pages/admin/AdminEmployeeFinance";
import AdminPaymentPlans from "./pages/admin/AdminPaymentPlans";
import AdminCollections from "./pages/admin/AdminCollections";
import AdminExpenses from "./pages/admin/AdminExpenses";
import AdminExpenseCards from "./pages/admin/AdminExpenseCards";
import AdminExpenseCardFinance from "./pages/admin/AdminExpenseCardFinance";
import AdminFinance from "./pages/admin/AdminFinance";
import AdminProjectFinance from "./pages/admin/AdminProjectFinance";
import AdminNotifications from "./pages/admin/AdminNotifications";
import AdminReports from "./pages/admin/AdminReports";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/admin/giris" element={<AdminAuth />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="projeler" element={<AdminProjects />} />
              <Route path="projeler/yeni" element={<AdminProjectEdit />} />
              <Route path="projeler/:id" element={<AdminProjectEdit />} />
              <Route path="projeler/:id/finans" element={<AdminProjectFinance />} />
              <Route path="musteriler" element={<AdminCustomers />} />
              <Route path="musteriler/yeni" element={<AdminCustomerEdit />} />
              <Route path="musteriler/:id" element={<AdminCustomerDetail />} />
              <Route path="musteriler/:id/duzenle" element={<AdminCustomerEdit />} />
              <Route path="musteriler/:id/finans" element={<AdminCustomerFinance />} />
              <Route path="personeller" element={<AdminEmployees />} />
              <Route path="personeller/:id/finans" element={<AdminEmployeeFinance />} />
              <Route path="odeme-planlari" element={<AdminPaymentPlans />} />
              <Route path="tahsilatlar" element={<AdminCollections />} />
              <Route path="giderler" element={<AdminExpenses />} />
              <Route path="gider-kartlari" element={<AdminExpenseCards />} />
              <Route path="gider-kartlari/:id/finans" element={<AdminExpenseCardFinance />} />
              <Route path="finans-dashboard" element={<AdminFinance />} />
              <Route path="medya" element={<AdminMedia />} />
              <Route path="talepler" element={<AdminContacts />} />
              <Route path="bildirimler" element={<AdminNotifications />} />
              <Route path="raporlar" element={<AdminReports />} />
              <Route path="ayarlar" element={<AdminSettings />} />
            </Route>

            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/hakkimizda" element={<About />} />
              <Route path="/hizmetlerimiz" element={<Services />} />
              <Route path="/projelerimiz" element={<Projects />} />
              <Route path="/projelerimiz/:slug" element={<ProjectDetail />} />
              <Route path="/kentsel-donusum" element={<UrbanTransformation />} />
              <Route path="/iletisim" element={<Contact />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </HelmetProvider>
  </QueryClientProvider>
);

export default App;
