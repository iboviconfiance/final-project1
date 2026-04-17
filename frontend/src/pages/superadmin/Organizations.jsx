import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { getAllOrganizations, suspendOrganization, activateOrganization, impersonateUser } from '../../api/superadminService';
import {
  Building2, Search, Loader2, Users, ShieldCheck, ShieldOff,
  MoreVertical, Eye, CheckCircle2, XCircle, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

/**
 * Page Organisations — Super-Admin
 * Liste, recherche, suspension/activation des organisations
 */
export default function Organizations() {
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => { loadOrgs(); }, []);

  async function loadOrgs() {
    setLoading(true);
    try {
      const res = await getAllOrganizations();
      setOrgs(res.data.data?.organizations || []);
    } catch (err) {
      toast.error(err.customMessage || 'Erreur chargement organisations.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSuspend(id) {
    if (!confirm('Suspendre cette organisation ?')) return;
    try {
      await suspendOrganization(id);
      toast.success('Organisation suspendue.');
      loadOrgs();
    } catch (err) {
      toast.error(err.customMessage || 'Erreur suspension.');
    }
  }

  async function handleActivate(id) {
    try {
      await activateOrganization(id);
      toast.success('Organisation activée !');
      loadOrgs();
    } catch (err) {
      toast.error(err.customMessage || 'Erreur activation.');
    }
  }

  async function handleImpersonate(org) {
    if (!org.adminId) return toast.error("Aucun administrateur trouvé pour cette organisation.");
    // Demande au Super-Admin
    const reason = prompt(`Impersonifier ${org.name} ? Raison de l'assistance (min 5 caractères) :`);
    if (!reason) return;
    if (reason.length < 5) return toast.error("Raison trop courte.");

    try {
      const res = await impersonateUser(org.adminId, { reason });
      const { token, targetUser } = res.data.data;
      
      // Stocker le token spécial et simuler une connexion
      localStorage.setItem('sf_token', token);
      localStorage.setItem('sf_user', JSON.stringify(targetUser));
      localStorage.setItem('sf_org', JSON.stringify(targetUser.organization));
      
      toast.success(`Connecté en tant que ${targetUser.email}`);
      // Recharger l'application pour que useAuth reprenne le nouveau token
      window.location.href = '/admin';
    } catch (err) {
      toast.error(err.customMessage || 'Erreur impersonation.');
    }
  }

  const statusConfig = {
    active: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', label: 'Active' },
    suspended: { icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30', label: 'Suspendue' },
    trial: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', label: 'Essai' },
  };

  const filtered = orgs.filter(org => {
    const matchSearch = org.name?.toLowerCase().includes(search.toLowerCase()) ||
      org.slug?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || org.status === filter;
    return matchSearch && matchFilter;
  });

  const counts = {
    all: orgs.length,
    active: orgs.filter(o => o.status === 'active').length,
    trial: orgs.filter(o => o.status === 'trial').length,
    suspended: orgs.filter(o => o.status === 'suspended').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Organisations</h1>
        <p className="text-dark-400 mt-1">{orgs.length} organisation(s) sur la plateforme</p>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: 'Toutes' },
          { key: 'active', label: 'Actives' },
          { key: 'trial', label: 'Essai' },
          { key: 'suspended', label: 'Suspendues' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === f.key
                ? 'bg-amber-600 text-white'
                : 'bg-dark-800 text-dark-400 hover:bg-dark-700'
            }`}
          >
            {f.label} ({counts[f.key]})
          </button>
        ))}
      </div>

      {/* Recherche */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
        <input
          type="text"
          placeholder="Rechercher une organisation..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-dark-800 border border-dark-700 text-dark-100 placeholder-dark-500 rounded-lg pl-10 pr-4 py-2.5 text-sm
            focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
        />
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-300 font-medium">Aucune organisation</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(org => {
            const sc = statusConfig[org.status] || statusConfig.trial;
            const StatusIcon = sc.icon;

            return (
              <Card key={org.id} hover className="!p-4 border border-dark-700 hover:border-amber-500/30 transition-colors">
                <div className="flex items-center gap-4">
                  {/* Avatar org */}
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-6 h-6 text-amber-400" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white truncate">{org.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${sc.bg} ${sc.color}`}>
                        {sc.label}
                      </span>
                    </div>
                    <p className="text-xs text-dark-500 mt-0.5">
                      {org.slug} • {org.userCount || 0} utilisateurs
                      • Créée le {new Date(org.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {org.adminId && (
                      <Button variant="ghost" className="!text-amber-400 hover:!bg-amber-500/10" size="sm" icon={Eye} onClick={() => handleImpersonate(org)}>
                        Impersonate
                      </Button>
                    )}
                    {org.status === 'active' || org.status === 'trial' ? (
                      <Button variant="danger" size="sm" icon={ShieldOff} onClick={() => handleSuspend(org.id)}>
                        Suspendre
                      </Button>
                    ) : (
                      <Button variant="success" size="sm" icon={ShieldCheck} onClick={() => handleActivate(org.id)}>
                        Activer
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
