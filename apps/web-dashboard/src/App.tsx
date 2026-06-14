import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { Layout } from "./components/Layout";
import { ModuleGuard } from "./components/ModuleGuard";
import { LoginPage } from "./pages/LoginPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { DashboardPage } from "./pages/DashboardPage";
import { TerritorialPage } from "./pages/TerritorialPage";
import { FleetPage } from "./pages/FleetPage";
import { UsersPage } from "./pages/UsersPage";
import { ProducersPage } from "./pages/ProducersPage";
import { OffersPage } from "./pages/OffersPage";
import { RescuesPage } from "./pages/RescuesPage";
import { DemandsPage } from "./pages/DemandsPage";
import { InventoryPage } from "./pages/InventoryPage";
import { LogisticsPage } from "./pages/LogisticsPage";
import { IncidentsPage } from "./pages/IncidentsPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { AuctionsPage } from "./pages/AuctionsPage";
import { MLPage } from "./pages/MLPage";
import { AIChatPage } from "./pages/AIChatPage";
import { InstitutionsPage } from "./pages/InstitutionsPage";
import { AlertsPage } from "./pages/AlertsPage";
import { OriginsPage } from "./pages/OriginsPage";
import { ChannelsPage } from "./pages/ChannelsPage";
import { OrganizationsPage } from "./pages/OrganizationsPage";
import { ProductsPage } from "./pages/ProductsPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { DepartamentosMaestrasPage } from "./pages/DepartamentosMaestrasPage";
import { MunicipiosMaestrasPage } from "./pages/MunicipiosMaestrasPage";
import { CorregimientosMaestrasPage } from "./pages/CorregimientosMaestrasPage";
import { VeredasMaestrasPage } from "./pages/VeredasMaestrasPage";
import { DeliveriesPage } from "./pages/DeliveriesPage";
import { MaturityPage } from "./pages/MaturityPage";
import type { ReactNode } from "react";

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function GuestRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
          <Route path="/reset-password" element={<GuestRoute><ResetPasswordPage /></GuestRoute>} />
          <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/territorial" element={<ProtectedRoute><ModuleGuard module="logistics-service"><TerritorialPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/fleet" element={<ProtectedRoute><ModuleGuard module="logistics-service"><FleetPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><ModuleGuard module="user-service"><UsersPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/producers" element={<ProtectedRoute><ModuleGuard module="producer-service"><ProducersPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/offers" element={<ProtectedRoute><ModuleGuard module="offer-service"><OffersPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/rescues" element={<ProtectedRoute><ModuleGuard module="rescue-service"><RescuesPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/demands" element={<ProtectedRoute><ModuleGuard module="demand-service"><DemandsPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/inventory" element={<ProtectedRoute><ModuleGuard module="inventory-service"><InventoryPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/logistics" element={<ProtectedRoute><ModuleGuard module="logistics-service"><LogisticsPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/incidents" element={<ProtectedRoute><ModuleGuard module="incident-service"><IncidentsPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><ModuleGuard module="notification-service"><NotificationsPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/auctions" element={<ProtectedRoute><ModuleGuard module="auction-service"><AuctionsPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/ml" element={<ProtectedRoute><ModuleGuard module="ml-service"><MLPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/institutions" element={<ProtectedRoute><ModuleGuard module="institution-service"><InstitutionsPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/alerts" element={<ProtectedRoute><ModuleGuard module="analytics-service"><AlertsPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/ai-copilot" element={<ProtectedRoute><ModuleGuard module="user-service"><AIChatPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/origins"       element={<ProtectedRoute><ModuleGuard module="origins-service"><OriginsPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/channels"      element={<ProtectedRoute><ModuleGuard module="catalog-service"><ChannelsPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/organizations" element={<ProtectedRoute><ModuleGuard module="catalog-service"><OrganizationsPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/products"      element={<ProtectedRoute><ModuleGuard module="catalog-service"><ProductsPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/categories"    element={<ProtectedRoute><ModuleGuard module="catalog-service"><CategoriesPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/entregas" element={<ProtectedRoute><ModuleGuard module="delivery-service"><DeliveriesPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/madurez" element={<ProtectedRoute><MaturityPage /></ProtectedRoute>} />
          <Route path="/maestras/departamentos" element={<ProtectedRoute><DepartamentosMaestrasPage /></ProtectedRoute>} />
          <Route path="/maestras/municipios" element={<ProtectedRoute><MunicipiosMaestrasPage /></ProtectedRoute>} />
          <Route path="/maestras/corregimientos" element={<ProtectedRoute><CorregimientosMaestrasPage /></ProtectedRoute>} />
          <Route path="/maestras/veredas" element={<ProtectedRoute><VeredasMaestrasPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
