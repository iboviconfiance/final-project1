import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { getAuditLogs } from '../../api/superadminService';
import {
  Shield, Search, Loader2, RefreshCw, Clock,
  LogIn, LogOut, UserPlus, Eye, AlertTriangle, Settings
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Page Logs d'Audit — Super-Admin
 * Vue chronologique des événements de sécurité
 */
export default function AuditLogs() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => { loadLogs(); }, [page, actionFilter]);

  async function loadLogs() {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (actionFilter) params.action = actionFilter;
      const res = await getAuditLogs(params);
      setLogs(res.data.data?.logs || []);
      setTotalPages(res.data.data?.totalPages || 1);
    } catch (err) {
      toast.error(err.customMessage || 'Erreur chargement logs.');
    } finally {
      setLoading(false);
    }
  }

  const actionIcons = {
    LOGIN: LogIn,
    LOGOUT: LogOut,
    CREATE_ORG: UserPlus,
    CREATE_USER: UserPlus,
    IMPERSONATION_START: Eye,
    IMPERSONATION_END: Eye,
    ASSIGN_ROLE: Settings,
    SUSPEND_ORG: AlertTriangle,
    ACTIVATE_ORG: Shield,
    default: Shield,
  };

  const actionColors = {
    LOGIN: 'text-emerald-400 bg-emerald-500/10',
    LOGOUT: 'text-dark-400 bg-dark-700',
    CREATE_ORG: 'text-brand-400 bg-brand-500/10',
    CREATE_USER: 'text-brand-400 bg-brand-500/10',
    IMPERSONATION_START: 'text-amber-400 bg-amber-500/10',
    IMPERSONATION_END: 'text-amber-400 bg-amber-500/10',
    ASSIGN_ROLE: 'text-cyan-400 bg-cyan-500/10',
    SUSPEND_ORG: 'text-rose-400 bg-rose-500/10',
    ACTIVATE_ORG: 'text-emerald-400 bg-emerald-500/10',
    default: 'text-dark-400 bg-dark-700',
  };

  const filteredLogs = logs.filter(log =>
    log.action?.toLowerCase().includes(search.toLowerCase()) ||
    log.admin?.email?.toLowerCase().includes(search.toLowerCase()) ||
    log.details?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Logs d'audit</h1>
          <p className="text-dark-400 mt-1">Historique de toutes les actions sécurisées</p>
        </div>
        <Button variant="ghost" icon={RefreshCw} size="sm" onClick={loadLogs}>
          Actualiser
        </Button>
      </div>

      {/* Filtres action */}
      <div className="flex flex-wrap gap-2">
        {['', 'LOGIN', 'CREATE_ORG', 'IMPERSONATION_START', 'ASSIGN_ROLE', 'SUSPEND_ORG'].map(a => (
          <button
            key={a}
            onClick={() => { setActionFilter(a); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              actionFilter === a
                ? 'bg-brand-600 text-white'
                : 'bg-dark-800 text-dark-400 hover:bg-dark-700'
            }`}
          >
            {a || 'Tous'}
          </button>
        ))}
      </div>

      {/* Recherche */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
        <input
          type="text"
          placeholder="Rechercher dans les logs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-dark-800 border border-dark-700 text-dark-100 placeholder-dark-500 rounded-lg pl-10 pr-4 py-2.5 text-sm
            focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all"
        />
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      ) : filteredLogs.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Shield className="w-12 h-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-300 font-medium">Aucun log trouvé</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-1">
          {filteredLogs.map((log, i) => {
            const Icon = actionIcons[log.action] || actionIcons.default;
            const colorClass = actionColors[log.action] || actionColors.default;

            return (
              <div key={log.id || i} className="flex gap-3 p-3 rounded-lg hover:bg-dark-800/40 transition-colors group">
                {/* Icône */}
                <div className={`p-1.5 rounded-lg flex-shrink-0 ${colorClass}`}>
                  <Icon className="w-4 h-4" />
                </div>

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-dark-300 uppercase">{log.action}</span>
                    {log.organizationName && (
                      <span className="text-xs text-dark-500">• {log.organizationName}</span>
                    )}
                  </div>
                  <p className="text-sm text-dark-200 mt-0.5 truncate">
                    {log.admin?.email || 'Système'}
                    {log.details && <span className="text-dark-500"> — {log.details}</span>}
                  </p>
                </div>

                {/* Date */}
                <div className="text-right flex-shrink-0 hidden sm:block">
                  <p className="text-xs text-dark-500">
                    {new Date(log.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                  <p className="text-xs text-dark-600">
                    {new Date(log.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                {/* IP */}
                {log.ip && (
                  <span className="text-xs text-dark-600 font-mono hidden lg:block self-center">
                    {log.ip}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            ← Précédent
          </Button>
          <span className="text-sm text-dark-400">
            Page {page} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Suivant →
          </Button>
        </div>
      )}
    </div>
  );
}
