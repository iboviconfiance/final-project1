import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { getDashboardStats } from '../../api/adminService';
import {
  TrendingUp, TrendingDown, Users, DollarSign,
  BarChart3, Loader2, RefreshCw, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Page Analytics Admin — MRR, Churn, Croissance
 */
export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    setLoading(true);
    try {
      const res = await getDashboardStats();
      setStats(res.data.data);
    } catch (err) {
      toast.error(err.customMessage || 'Erreur chargement analytics.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  const overview = stats?.overview || {};
  const analytics = stats?.analytics || {};
  
  // Mapping the backend properties to UI variables
  const currentMrr = analytics.mrr || 0;
  const churnRateObj = analytics.churnRate || 0; // value
  const newGrowth = overview.newUsersThisMonth || 0;
  const revThisMonth = overview.revenueThisMonth || 0;
  const revAllTime = overview.totalRevenue || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-dark-400 mt-1">Indicateurs clés de performance</p>
        </div>
        <Button variant="ghost" icon={RefreshCw} size="sm" onClick={loadStats}>
          Actualiser
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR */}
        <Card hover className="group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-dark-400 uppercase tracking-wider">MRR</p>
              <p className="text-2xl font-bold text-white mt-1">
                {currentMrr.toLocaleString()} <span className="text-sm text-dark-400">XAF</span>
              </p>
              <p className="text-xs text-dark-500 mt-1">
                Revenus Mensuels Récurrents
              </p>
            </div>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </Card>

        {/* Churn Rate */}
        <Card hover className="group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-dark-400 uppercase tracking-wider">Taux de Churn</p>
              <p className="text-2xl font-bold text-white mt-1">
                {churnRateObj.toFixed(1)}<span className="text-sm text-dark-400">%</span>
              </p>
              <p className="text-xs text-dark-500 mt-1">
                Taux de désabonnement
              </p>
            </div>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 group-hover:scale-110 transition-transform">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
        </Card>

        {/* Croissance */}
        <Card hover className="group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-dark-400 uppercase tracking-wider">Croissance</p>
              <p className="text-2xl font-bold text-white mt-1">
                +{newGrowth}
              </p>
              <p className="text-xs text-dark-500 mt-1">
                nouveaux inscrits ce mois
              </p>
            </div>
            <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </Card>

        {/* Total revenus */}
        <Card hover className="group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-dark-400 uppercase tracking-wider">Revenus du mois</p>
              <p className="text-2xl font-bold text-white mt-1">
                {revThisMonth.toLocaleString()} <span className="text-sm text-dark-400">XAF</span>
              </p>
              <p className="text-xs text-dark-500 mt-1">
                Total : {revAllTime.toLocaleString()} XAF
              </p>
            </div>
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:scale-110 transition-transform">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Graphique simplifié — Inscriptions / Historique */}
      <Card>
        <h3 className="text-sm font-semibold text-dark-300 mb-4">Evolution des Inscriptions (30 j)</h3>
        <div className="h-40 flex items-end gap-1 mb-2">
          {stats?.dailySignups?.length > 0 ? (
            stats.dailySignups.map((day, i) => {
              const maxCount = Math.max(...stats.dailySignups.map(d => d.count)) || 1;
              const heightStr = `${(day.count / maxCount) * 100}%`;
              return (
                <div key={i} className="flex-1 flex flex-col justify-end group relative">
                  {/* Tooltip */}
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-dark-800 text-xs text-white px-2 py-1 rounded pointer-events-none whitespace-nowrap z-10 transition-opacity">
                    {new Date(day.date).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })} : {day.count}
                  </div>
                  <div 
                    className="w-full bg-brand-500/50 hover:bg-brand-400 rounded-t-sm transition-all" 
                    style={{ height: heightStr === '0%' ? '1px' : heightStr }}
                  />
                </div>
              );
            })
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-dark-500">
              <BarChart3 className="w-8 h-8 mb-2 opacity-50" />
              <span>Données insuffisantes</span>
            </div>
          )}
        </div>
      </Card>

      {/* Prévisions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-sm font-semibold text-dark-300 mb-3">Expirent cette semaine</h3>
          <p className="text-3xl font-bold text-amber-400">{overview.expiringThisWeek || 0}</p>
          <p className="text-xs text-dark-500 mt-1">abonnements à relancer</p>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold text-dark-300 mb-3">Prévision Revenus (Reconduction)</h3>
          <p className="text-3xl font-bold text-emerald-400">{(analytics.forecast || 0).toLocaleString()} <span className="text-sm">XAF</span></p>
          <p className="text-xs text-dark-500 mt-1">Estimés selon le MRR et le taux de renouvellement ({analytics.renewalRate || 0}%)</p>
        </Card>
      </div>
    </div>
  );
}
