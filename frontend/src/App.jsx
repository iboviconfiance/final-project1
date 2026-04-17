import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Layouts
import DashboardLayout from './layouts/DashboardLayout';

// Pages publiques
import Login from './pages/Login';
import Register from './pages/Register';
import ClientRegister from './pages/ClientRegister';
import NotFound from './pages/NotFound';

// Guards
import ProtectedRoute from './components/ProtectedRoute';
import RoleGuard from './components/RoleGuard';

// Client pages
import ClientDashboard from './pages/client/Dashboard';
import Profile from './pages/client/Profile';
import Subscription from './pages/client/Subscription';
import Invoices from './pages/client/Invoices';
import PaymentMethod from './pages/client/PaymentMethod';
import ClientTickets from './pages/client/Tickets';
import Referral from './pages/client/Referral';

// Admin pages
import AdminDashboard from './pages/admin/Dashboard';
import Scanner from './pages/admin/Scanner';
import Members from './pages/admin/Members';
import Analytics from './pages/admin/Analytics';
import AdminTickets from './pages/admin/Tickets';
import Export from './pages/admin/Export';
import Settings from './pages/admin/Settings';
import Marketing from './pages/admin/Marketing';
import Plans from './pages/admin/Plans';

// SuperAdmin pages
import SuperAdminDashboard from './pages/superadmin/Dashboard';
import Organizations from './pages/superadmin/Organizations';
import AuditLogs from './pages/superadmin/AuditLogs';
import SystemSettings from './pages/superadmin/SystemSettings';
import Affiliates from './pages/superadmin/Affiliates';

/**
 * App — Routage complet de la SPA SubFlow
 *
 * /login, /register, /join  → Pages publiques
 * /dashboard/*               → Portail Client (tous les rôles)
 * /admin/*                   → Dashboard Admin (admin, manager, staff, accountant)
 * /superadmin/*              → Dashboard Super-Admin (superadmin uniquement)
 */
export default function App() {
  const { isAuthenticated, role, getDefaultPath } = useAuth();

  return (
    <Routes>
      {/* ── Routes publiques ── */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/join" element={<ClientRegister />} />

      {/* ── Redirect racine ── */}
      <Route
        path="/"
        element={
          isAuthenticated
            ? <Navigate to={getDefaultPath(role)} replace />
            : <Navigate to="/login" replace />
        }
      />

      {/* ── Portail Client ── */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['user', 'admin', 'manager', 'staff', 'accountant', 'superadmin']}>
              <DashboardLayout />
            </RoleGuard>
          </ProtectedRoute>
        }
      >
        <Route index element={<ClientDashboard />} />
        <Route path="profile" element={<Profile />} />
        <Route path="subscription" element={<Subscription />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="payment" element={<PaymentMethod />} />
        <Route path="tickets" element={<ClientTickets />} />
        <Route path="referral" element={<Referral />} />
      </Route>

      {/* ── Dashboard Admin ── */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['admin', 'manager', 'staff', 'accountant', 'superadmin']}>
              <DashboardLayout />
            </RoleGuard>
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="scanner" element={<Scanner />} />
        <Route path="members" element={<Members />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="tickets" element={<AdminTickets />} />
        <Route path="export" element={<Export />} />
        <Route path="settings" element={<Settings />} />
        <Route path="marketing" element={<Marketing />} />
        <Route path="plans" element={<Plans />} />
      </Route>

      {/* ── Dashboard Super-Admin ── */}
      <Route
        path="/superadmin"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['superadmin']}>
              <DashboardLayout />
            </RoleGuard>
          </ProtectedRoute>
        }
      >
        <Route index element={<SuperAdminDashboard />} />
        <Route path="organizations" element={<Organizations />} />
        <Route path="logs" element={<AuditLogs />} />
        <Route path="settings" element={<SystemSettings />} />
        <Route path="affiliates" element={<Affiliates />} />
      </Route>

      {/* ── 404 ── */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
