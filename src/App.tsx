import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";

function FinancRedirect({ base }: { base: string }) {
  const { id } = useParams();
  return <Navigate to={`/admin/${base}/${id ?? ''}`} replace />;
}
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
const AdminEmployeeAllocations = lazy(() => import("./pages/admin/AdminEmployeeAllocations"));
const AdminEmployeeDetail = lazy(() => import("./pages/admin/AdminEmployeeDetail"));
const AdminCollections = lazy(() => import("./pages/admin/AdminCollections"));
const AdminPaymentPlans = lazy(() => import("./pages/admin/AdminPaymentPlans"));
const AdminExpenses = lazy(() => import("./pages/admin/AdminExpenses"));
const AdminExpenseMasterData = lazy(() => import("./pages/admin/AdminExpenseMasterData"));
const AdminExpenseCards = lazy(() => import("./pages/admin/AdminExpenseCards"));
const AdminExpenseCardFinance = lazy(() => import("./pages/admin/AdminExpenseCardFinance"));
const AdminFinance = lazy(() => import("./pages/admin/AdminFinance"));
const AdminProjectFinance = lazy(() => import("./pages/admin/AdminProjectFinance"));
const AdminProjectExpenses = lazy(() => import("./pages/admin/AdminProjectExpenses"));
const AdminProjectPreview = lazy(() => import("./pages/admin/AdminProjectPreview"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminSqlEditor = lazy(() => import("./pages/admin/AdminSqlEditor"));
const AdminSuppliers = lazy(() => import("./pages/admin/AdminSuppliers"));
const AdminSupplierEdit = lazy(() => import("./pages/admin/AdminSupplierEdit"));
const AdminSupplierDetail = lazy(() => import("./pages/admin/AdminSupplierDetail"));
const AdminGelenler = lazy(() => import("./pages/admin/AdminGelenler"));
const AdminGidenler = lazy(() => import("./pages/admin/AdminGidenler"));
const AdminNetDurum = lazy(() => import("./pages/admin/AdminNetDurum"));
const AdminGovernmentProgressPayments = lazy(() => import("./pages/admin/AdminGovernmentProgressPayments"));
const AdminMaintenanceConsole = lazy(() => import("./pages/admin/AdminMaintenanceConsole"));
const AdminBackupCenter = lazy(() => import("./pages/admin/AdminBackupCenter"));
const AdminInflationCalculator = lazy(() => import("./pages/admin/AdminInflationCalculator"));

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
                  <Route path="projeler/:id/giderler" element={<AdminProjectExpenses />} />
                  <Route path="projeler/:id/onizleme" element={<AdminProjectPreview />} />
                  <Route path="musteriler" element={<AdminCustomers />} />
                  <Route path="musteriler/yeni" element={<AdminCustomerEdit />} />
                  <Route path="musteriler/:id" element={<AdminCustomerDetail />} />
                  <Route path="musteriler/:id/duzenle" element={<AdminCustomerEdit />} />
                  <Route path="musteriler/:id/finans" element={<FinancRedirect base="musteriler" />} />
                  <Route path="devlet-hakedisleri" element={<AdminGovernmentProgressPayments />} />
                  <Route path="personeller" element={<AdminEmployees />} />
                  <Route path="personeller/:id/finans" element={<FinancRedirect base="personeller" />} />
                  <Route path="personeller/:id/tahsisat" element={<AdminEmployeeAllocations />} />
                  <Route path="personeller/:id" element={<AdminEmployeeDetail />} />
                  <Route path="odeme-planlari" element={<Navigate to="/admin/musteriler" replace />} />
                  <Route path="tedarikciler" element={<AdminSuppliers />} />
                  <Route path="tedarikciler/yeni" element={<AdminSupplierEdit />} />
                  <Route path="tedarikciler/:id" element={<AdminSupplierDetail />} />
                  <Route path="tedarikciler/:id/duzenle" element={<AdminSupplierEdit />} />
                  <Route path="gelenler" element={<AdminGelenler />} />
                  <Route path="gidenler" element={<AdminGidenler />} />
                  <Route path="net-durum" element={<AdminNetDurum />} />
                  <Route path="tahsilatlar" element={<Navigate to="/admin/gelenler" replace />} />
                  <Route path="giderler" element={<Navigate to="/admin/gidenler" replace />} />
                  <Route path="masraf-kalemleri" element={<AdminExpenseMasterData />} />
                  <Route path="gider-kartlari" element={<AdminExpenseCards />} />
                  <Route path="gider-kartlari/:id/finans" element={<AdminExpenseCardFinance />} />
                  <Route path="finans-dashboard" element={<Navigate to="/admin" replace />} />
                  <Route path="medya" element={<AdminMedia />} />
                  <Route path="talepler" element={<AdminContacts />} />
                  <Route path="bildirimler" element={<AdminNotifications />} />
                  <Route path="raporlar" element={<AdminReports />} />
                  <Route path="ayarlar" element={<AdminSettings />} />
                  <Route path="sql-editor"    element={<AdminSqlEditor />} />
                  <Route path="bakim-konsolu" element={<AdminMaintenanceConsole />} />
                  <Route path="yedekleme-merkezi" element={<AdminBackupCenter />} />
                  <Route path="enflasyon-hesaplama" element={<AdminInflationCalculator />} />
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
