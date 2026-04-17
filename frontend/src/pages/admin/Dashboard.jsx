import { useState, useEffect } from 'react';
import { getDashboardStats } from '../../api/adminService';
import Card from '../../components/ui/Card';
import { Loader2, Users, CreditCard, TrendingUp, AlertTriangle } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const res = await getDashboardStats();
      setStats(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>;
  }

  const { activeSubscriptions = 0, mrr = 0, expiringSoon = 0, monthlyRevenue = 0, dailySignups = [] } = stats || {};

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Vue d'ensemble</h1>
        <p className="text-dark-400 mt-1">Performances et revenus de votre organisation</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card hover className="group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-dark-400 uppercase tracking-wider">Abonnés actifs</p>
              <p className="text-2xl font-bold text-white mt-1">{activeSubscriptions}</p>
            </div>
            <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400 group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card hover className="group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-dark-400 uppercase tracking-wider">MRR (Revenu Récurrent)</p>
              <p className="text-2xl font-bold text-white mt-1">{parseFloat(mrr).toLocaleString()} XAF</p>
            </div>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card hover className="group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-dark-400 uppercase tracking-wider">Expirent bientôt (48h)</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">{expiringSoon}</p>
            </div>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card hover className="group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-dark-400 uppercase tracking-wider">Revenus du mois</p>
              <p className="text-2xl font-bold text-white mt-1">{parseFloat(monthlyRevenue).toLocaleString()} XAF</p>
            </div>
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:scale-110 transition-transform">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Graphique Recharts */}
      <Card className="h-96 flex flex-col">
        <h3 className="text-sm font-semibold text-dark-200 mb-6">Inscriptions au fil du mois</h3>
        <div className="flex-1 w-full min-h-0">
          {dailySignups && dailySignups.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailySignups} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d2d2f" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#525256" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => new Date(val).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                />
                <YAxis 
                  stroke="#525256" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #2d2d2f', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                  labelFormatter={(val) => new Date(val).toLocaleDateString('fr-FR')}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  name="Inscriptions"
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorCount)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-dark-400 text-sm">
              Peu de données disponibles pour générer le graphique.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
