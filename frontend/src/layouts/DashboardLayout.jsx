import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, CreditCard, BarChart3,
  Settings, LogOut, Menu, X, Zap, Bell,
  TicketCheck, FileText, Shield, Building2,
  Wallet, HelpCircle, Gift, Tag, Handshake
} from 'lucide-react';
import NotificationCenter from '../components/NotificationCenter';

/**
 * DashboardLayout — Sidebar + Header responsif
 * Les liens de la sidebar changent dynamiquement selon le rôle.
 */

// Définition des menus par rôle
const menuItems = {
  user: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/dashboard/profile', icon: Users, label: 'Mon profil' },
    { to: '/dashboard/subscription', icon: CreditCard, label: 'Abonnement' },
    { to: '/dashboard/invoices', icon: FileText, label: 'Factures' },
    { to: '/dashboard/payment', icon: Wallet, label: 'Paiement rapide' },
    { to: '/dashboard/referral', icon: Gift, label: 'Jours gratuits' },
    { to: '/dashboard/tickets', icon: HelpCircle, label: 'Support' },
  ],
  admin: [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/plans', icon: CreditCard, label: 'Offres & Plans' },
    { to: '/admin/scanner', icon: Zap, label: 'Scanner QR' },
    { to: '/admin/members', icon: Users, label: 'Membres' },
    { to: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/admin/tickets', icon: TicketCheck, label: 'Tickets' },
    { to: '/admin/export', icon: FileText, label: 'Exports' },
    { to: '/admin/marketing', icon: Tag, label: 'Marketing' },
    { to: '/admin/settings', icon: Settings, label: 'Paramètres' },
  ],
  manager: [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/scanner', icon: Zap, label: 'Scanner QR' },
    { to: '/admin/members', icon: Users, label: 'Membres' },
    { to: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/admin/marketing', icon: Tag, label: 'Marketing' },
  ],
  staff: [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/scanner', icon: Zap, label: 'Scanner QR' },
    { to: '/admin/members', icon: Users, label: 'Membres' },
  ],
  accountant: [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/analytics', icon: BarChart3, label: 'Finances' },
    { to: '/admin/export', icon: FileText, label: 'Exports' },
  ],
  superadmin: [
    { to: '/superadmin', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/superadmin/organizations', icon: Building2, label: 'Organisations' },
    { to: '/superadmin/affiliates', icon: Handshake, label: 'Partenaires' },
    { to: '/superadmin/logs', icon: Shield, label: 'Logs d\'audit' },
    { to: '/superadmin/settings', icon: Settings, label: 'Système' },
  ],
};

export default function DashboardLayout() {
  const { user, organization, role, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const items = menuItems[role] || menuItems.user;

  const roleBadge = {
    superadmin: { label: 'Super Admin', color: 'text-rose-400 bg-rose-500/10' },
    admin: { label: 'Admin', color: 'text-brand-400 bg-brand-500/10' },
    manager: { label: 'Manager', color: 'text-amber-400 bg-amber-500/10' },
    staff: { label: 'Staff', color: 'text-emerald-400 bg-emerald-500/10' },
    accountant: { label: 'Comptable', color: 'text-cyan-400 bg-cyan-500/10' },
    user: { label: 'Abonné', color: 'text-dark-400 bg-dark-700' },
  };

  const badge = roleBadge[role] || roleBadge.user;
  const isSuperAdmin = role === 'superadmin';

  // Branding God Mode : Noir & Or (Amber)
  const activeBg = isSuperAdmin ? 'bg-amber-600/15' : 'bg-brand-600/15';
  const activeText = isSuperAdmin ? 'text-amber-400' : 'text-brand-400';
  const activeBorder = isSuperAdmin ? 'border-amber-500/20' : 'border-brand-500/20';
  const logoBg = isSuperAdmin ? 'bg-amber-600/20' : 'bg-brand-600/20';
  const logoColor = isSuperAdmin ? 'text-amber-400' : 'text-brand-400';
  const notifColor = isSuperAdmin ? 'bg-amber-500' : 'bg-brand-500';

  return (
    <div className="min-h-screen bg-dark-900 flex">
      {/* ── SIDEBAR ──────────────────────────────── */}
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50 w-64 bg-dark-950 border-r border-dark-800
          transform transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          flex flex-col
        `}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-dark-800">
          <div className={`w-8 h-8 rounded-lg ${logoBg} flex items-center justify-center`}>
            <Zap className={`w-4 h-4 ${logoColor}`} />
          </div>
          <span className="font-bold text-white text-lg tracking-tight">SubFlow</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden text-dark-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User info */}
        <div className="px-4 py-4 border-b border-dark-800/50">
          <p className="text-sm font-medium text-dark-200 truncate">
            {user?.email}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
              {badge.label}
            </span>
            {organization && (
              <span className="text-xs text-dark-500 truncate">
                {organization.name}
              </span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard' || item.to === '/admin' || item.to === '/superadmin'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-200
                ${isActive
                  ? `${activeBg} ${activeText} border ${activeBorder}`
                  : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800/50 border border-transparent'
                }
              `}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-dark-800">
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium
              text-dark-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-dark-800 bg-dark-900/80 backdrop-blur-md flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
          {/* Burger menu (mobile) */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-dark-400 hover:text-white p-2 -ml-2"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Titre page (desktop) */}
          <div className="hidden lg:block">
            {organization && (
              <h2 className="text-sm font-medium text-dark-300">
                {organization.name}
              </h2>
            )}
          </div>

          {/* Actions header */}
          <div className="flex items-center gap-3">
            <NotificationCenter isSuperAdmin={isSuperAdmin} />

            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-dark-200">{user?.email}</p>
              <p className="text-xs text-dark-500">{badge.label}</p>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
