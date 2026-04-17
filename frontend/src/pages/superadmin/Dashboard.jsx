import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import { Building2, Shield, Globe, Activity, Loader2, DollarSign } from 'lucide-react';
import { getGlobalStats, getAuditLogs } from '../../api/superadminService';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

/**
 * Dashboard Super-Admin — "God Mode"
 * Charte graphique : Noir & Or (Amber)
 */
export default function SuperAdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsRes, logsRes] = await Promise.all([
          getGlobalStats(),
          getAuditLogs({ limit: 5 }) // Derniers logs
        ]);
        setStats(statsRes.data.data);
        setRecentLogs(logsRes.data.data.logs || []);
      } catch (err) {
        toast.error('Erreur chargement des données.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  const overview = stats?.overview || {};
  const totalRevenue = overview.totalRevenue || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Super Admin God-Mode</h1>
        <p className="text-dark-400 mt-1">Vue globale de la plateforme (Noir & Or)</p>
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card hover className="group border-amber-500/10 hover:border-amber-500/30">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-dark-400 uppercase tracking-wider">Organisations</p>
              <p className="text-2xl font-bold text-white mt-1">{overview.totalOrganizations || 0}</p>
            </div>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card hover className="group border-emerald-500/10 hover:border-emerald-500/30">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-dark-400 uppercase tracking-wider">Utilisateurs totaux</p>
              <p className="text-2xl font-bold text-white mt-1">{overview.totalUsers || 0}</p>
            </div>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
              <Globe className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card hover className="group border-amber-500/10 hover:border-amber-500/30">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-dark-400 uppercase tracking-wider">Revenu Total</p>
              <p className="text-xl font-bold text-amber-400 mt-1">{totalRevenue.toLocaleString()} XAF</p>
            </div>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card hover className="group border-emerald-500/10 hover:border-emerald-500/30">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-dark-400 uppercase tracking-wider">Santé Système</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">OK</p>
            </div>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
              <Activity className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Derniers Logs */}
        <Card className="flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Shield className="w-5 h-5 text-amber-500" />
              Moniteur de Sécurité
            </div>
            <Link to="/superadmin/logs" className="text-xs text-amber-400 hover:text-amber-300">
              Voir tout
            </Link>
          </div>
          <div className="space-y-3 flex-1">
            {recentLogs.length === 0 ? (
              <p className="text-dark-400 text-sm text-center py-4">Aucun log récent.</p>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className="flex gap-3 text-sm p-2 rounded hover:bg-dark-800/50">
                  <span className="text-amber-500 text-xs font-mono uppercase w-20 flex-shrink-0">
                    {log.action?.substring(0, 10)}
                  </span>
                  <span className="text-dark-300 truncate flex-1">
                    {log.admin?.email} {log.details ? `— ${log.details}` : ''}
                  </span>
                  <span className="text-dark-500 text-xs hidden sm:block">
                    {new Date(log.createdAt).toLocaleTimeString('fr-FR')}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Top Orgs */}
        <Card className="flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Building2 className="w-5 h-5 text-emerald-500" />
              Top Organisations (Revenu)
            </div>
            <Link to="/superadmin/organizations" className="text-xs text-emerald-400 hover:text-emerald-300">
              Voir tout
            </Link>
          </div>
          <div className="space-y-3 flex-1">
            {stats?.topOrganizations?.length === 0 ? (
              <p className="text-dark-400 text-sm text-center py-4">Aucune organisation trouvée.</p>
            ) : (
              stats?.topOrganizations?.map((org, idx) => (
                <div key={org.id} className="flex justify-between items-center text-sm p-2 rounded hover:bg-dark-800/50">
                  <span className="text-dark-200">
                    <span className="text-dark-500 mr-2">#{idx + 1}</span>
                    {org.name}
                  </span>
                  <span className="text-emerald-400 font-medium">
                    {org.totalRevenue.toLocaleString()} XAF
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
