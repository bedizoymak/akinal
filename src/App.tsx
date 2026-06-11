import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";

const PublicLayout = lazy(() => import("./components/site/PublicLayout"));
const Home = lazy(() => import("./pages/site/Home"));
const About = lazy(() => import("./pages/site/About"));
const Services = lazy(() => import("./pages/site/Services"));
const ServiceDetail = lazy(() => import("./pages/site/ServiceDetail"));
const Projects = lazy(() => import("./pages/site/Projects"));
const ProjectDetail = lazy(() => import("./pages/site/ProjectDetail"));
const UrbanTransformation = lazy(() => import("./pages/site/UrbanTransformation"));
const Contact = lazy(() => import("./pages/site/Contact"));
const LegalPage = lazy(() => import("./pages/site/LegalPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const AdminAuth = lazy(() => import("./pages/admin/AdminAuth"));
const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminProjects = lazy(() => import("./pages/admin/AdminProjects"));
const AdminProjectEdit = lazy(() => import("./pages/admin/AdminProjectEdit"));
const AdminMedia = lazy(() => import("./pages/admin/AdminMedia"));
const AdminContacts = lazy(() => import("./pages/admin/AdminContacts"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminCustomers = lazy(() => import("./pages/admin/AdminCustomers"));
const AdminCustomerEdit = lazy(() => import("./pages/admin/AdminCustomerEdit"));
const AdminCustomerDetail = lazy(() => import("./pages/admin/AdminCustomerDetail"));
const AdminCustomerFinance = lazy(() => import("./pages/admin/AdminCustomerFinance"));
const AdminEmployees = lazy(() => import("./pages/admin/AdminEmployees"));
const AdminEmployeeFinance = lazy(() => import("./pages/admin/AdminEmployeeFinance"));
const AdminCollections = lazy(() => import("./pages/admin/AdminCollections"));
const AdminExpenses = lazy(() => import("./pages/admin/AdminExpenses"));
const AdminExpenseCards = lazy(() => import("./pages/admin/AdminExpenseCards"));
const AdminExpenseCardFinance = lazy(() => import("./pages/admin/AdminExpenseCardFinance"));
const AdminFinance = lazy(() => import("./pages/admin/AdminFinance"));
const AdminProjectFinance = lazy(() => import("./pages/admin/AdminProjectFinance"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminSqlEditor = lazy(() => import("./pages/admin/AdminSqlEditor"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Sayfa yükleniyor...</div>}>
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
                  <Route path="odeme-planlari" element={<Navigate to="/admin/musteriler" replace />} />
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
                  <Route path="sql-editor" element={<AdminSqlEditor />} />
                </Route>

                <Route element={<PublicLayout />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/hakkimizda" element={<About />} />
                  <Route path="/hizmetlerimiz" element={<Services />} />
                  <Route path="/hizmetlerimiz/:slug" element={<ServiceDetail />} />
                  <Route path="/projelerimiz" element={<Projects />} />
                  <Route path="/projeler" element={<Projects />} />
                  <Route path="/projelerimiz/:slug" element={<ProjectDetail />} />
                  <Route path="/kentsel-donusum" element={<UrbanTransformation />} />
                  <Route path="/iletisim" element={<Contact />} />
                  <Route path="/gizlilik-politikasi" element={<LegalPage />} />
                  <Route path="/cerez-politikasi" element={<LegalPage />} />
                  <Route path="/kullanim-sartlari" element={<LegalPage />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </HelmetProvider>
  </QueryClientProvider>
);

export default App;
