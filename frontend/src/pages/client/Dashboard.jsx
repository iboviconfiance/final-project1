import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import SecureQrCode from '../../components/SecureQrCode';
import { getSubscriptionStatus, getInvoices } from '../../api/clientService';
import {
  CreditCard, Clock, Zap, ShieldCheck, ShieldAlert, ShieldOff,
  FileText, ArrowRight, Wallet, Loader2, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Dashboard Client — Portail Abonné "SaaS Congo"
 * 
 * 3 besoins vitaux :
 * 1. PAYER → Bouton paiement rapide + lien vers les plans
 * 2. PROUVER → QR Code sécurisé rotatif
 * 3. GÉRER → Statut, jours restants, dernières factures
 */
export default function ClientDashboard() {
  const { user, organization } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState(null);
  const [recentInvoices, setRecentInvoices] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const [subRes, invRes] = await Promise.allSettled([
        getSubscriptionStatus(),
        getInvoices({ limit: 3 }),
      ]);

      if (subRes.status === 'fulfilled') {
        setSub(subRes.value.data.data);
      }
      if (invRes.status === 'fulfilled') {
        setRecentInvoices(invRes.value.data.data?.invoices || []);
      }
    } catch (err) {
      // Silent
    } finally {
      setLoading(false);
    }
  }

  // ── Calculs de statut ──
  const status = sub?.status || 'no_subscription';
  const daysLeft = sub?.daysLeft ?? 0;
  const totalDays = sub?.totalDays ?? 30;
  const progressPercent = totalDays > 0 ? Math.max(0, Math.min(100, (daysLeft / totalDays) * 100)) : 0;

  const statusConfig = {
    active: {
      label: 'Actif',
      icon: ShieldCheck,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      barColor: 'bg-emerald-500',
      description: `Expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`,
    },
    grace_period: {
      label: 'Période de grâce',
      icon: ShieldAlert,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      barColor: 'bg-amber-500',
      description: 'Renouvelez avant expiration !',
    },
    expired: {
      label: 'Expiré',
      icon: ShieldOff,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
      barColor: 'bg-rose-500',
      description: 'Votre abonnement a expiré.',
    },
    no_subscription: {
      label: 'Aucun',
      icon: AlertTriangle,
      color: 'text-dark-400',
      bg: 'bg-dark-700',
      barColor: 'bg-dark-600',
      description: 'Aucun abonnement actif.',
    },
  };

  const sc = statusConfig[status] || statusConfig.no_subscription;
  const StatusIcon = sc.icon;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Bienvenue{user?.firstName ? `, ${user.firstName}` : ''} 👋
        </h1>
        <p className="text-dark-400 mt-1">
          {organization?.name || 'Voici un aperçu de votre abonnement'}
        </p>
      </div>

      {/* ── Alerte si expiré ── */}
      {status === 'expired' && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 animate-fade-in">
          <ShieldOff className="w-5 h-5 text-rose-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-rose-300">Votre abonnement a expiré</p>
            <p className="text-xs text-rose-400/70 mt-0.5">Renouvelez maintenant pour retrouver l'accès complet.</p>
          </div>
          <Link to="/dashboard/subscription">
            <Button size="sm" variant="danger">Renouveler</Button>
          </Link>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Statut */}
        <Card hover className="group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-dark-400 uppercase tracking-wider">Statut</p>
              <p className={`text-xl sm:text-2xl font-bold mt-1 ${sc.color}`}>{sc.label}</p>
            </div>
            <div className={`p-2 rounded-lg ${sc.bg} ${sc.color} group-hover:scale-110 transition-transform`}>
              <StatusIcon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-dark-500 mt-2">{sc.description}</p>
        </Card>

        {/* Jours restants */}
        <Card hover className="group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-dark-400 uppercase tracking-wider">Jours restants</p>
              <p className="text-xl sm:text-2xl font-bold text-white mt-1">
                {status === 'no_subscription' ? '--' : daysLeft}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400 group-hover:scale-110 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          {/* Barre de progression */}
          <div className="mt-3 h-1.5 bg-dark-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${sc.barColor}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </Card>

        {/* Plan */}
        <Card hover className="group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-dark-400 uppercase tracking-wider">Plan</p>
              <p className="text-xl sm:text-2xl font-bold text-white mt-1 truncate">
                {sub?.planName || '--'}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-dark-500 mt-2">
            {sub?.planPrice ? `${sub.planPrice.toLocaleString()} XAF/mois` : 'Choisir un plan'}
          </p>
        </Card>

        {/* Actions rapides */}
        <Card hover className="group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-dark-400 uppercase tracking-wider">Paiement</p>
              <Link to="/dashboard/payment" className="text-sm font-medium text-brand-400 hover:text-brand-300 mt-2 inline-flex items-center gap-1 transition-colors">
                Payer <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400 group-hover:scale-110 transition-transform">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* ── Zone principale : QR Code + Factures ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QR Code */}
        <SecureQrCode subscriptionStatus={status} />

        {/* Dernières factures */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-dark-300">Dernières factures</h3>
            <Link to="/dashboard/invoices" className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
              Voir tout →
            </Link>
          </div>

          {recentInvoices.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-10 h-10 text-dark-600 mx-auto mb-2" />
              <p className="text-dark-500 text-sm">Aucune facture pour le moment</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentInvoices.map((inv) => {
                const statusBadge = {
                  success: 'bg-emerald-500/10 text-emerald-400',
                  pending: 'bg-amber-500/10 text-amber-400',
                  failed: 'bg-rose-500/10 text-rose-400',
                };
                return (
                  <div key={inv.id} className="flex items-center gap-3 p-3 rounded-lg bg-dark-800/40 hover:bg-dark-800/60 transition-colors">
                    <div className="p-1.5 rounded-lg bg-dark-700">
                      <FileText className="w-4 h-4 text-dark-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-dark-200 truncate">{inv.description || 'Paiement'}</p>
                      <p className="text-xs text-dark-500">
                        {new Date(inv.createdAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">
                        {(inv.amount || 0).toLocaleString()} XAF
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge[inv.status] || statusBadge.pending}`}>
                        {inv.status === 'success' ? 'Payé' : inv.status === 'pending' ? 'En attente' : 'Échoué'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ── Bouton d'action principal (mobile) ── */}
      {(status === 'expired' || status === 'no_subscription') && (
        <div className="sm:hidden">
          <Link to="/dashboard/subscription">
            <Button className="w-full" size="lg" icon={Zap}>
              Choisir un abonnement
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
