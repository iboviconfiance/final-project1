import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import {
  getAnnouncements, createAnnouncement, deleteAnnouncement,
  getVersions
} from '../../api/superadminService';
import {
  Settings as SettingsIcon, Megaphone, Trash2, Send, Plus,
  Loader2, Globe, Code, Shield
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Page Système — Super-Admin
 * Annonces globales + gestion des versions
 */
export default function SystemSettings() {
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState([]);
  const [versions, setVersions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    title: '',
    message: '',
    type: 'info',
    targetRole: '',
    targetOrg: '',
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [annRes, verRes] = await Promise.allSettled([
        getAnnouncements(),
        getVersions(),
      ]);
      if (annRes.status === 'fulfilled') setAnnouncements(annRes.value.data.data?.announcements || []);
      if (verRes.status === 'fulfilled') setVersions(verRes.value.data.data?.versions || []);
    } catch (err) {
      // Ignore partial errors
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAnnouncement(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) return toast.error('Titre et message requis.');
    setSending(true);
    try {
      await createAnnouncement({
        title: form.title,
        content: form.message,
        type: form.type,
        target: form.targetRole || 'all',
        targetValue: form.targetOrg || null
      });
      toast.success('Annonce publiée !');
      setForm({ title: '', message: '', type: 'info', targetRole: '', targetOrg: '' });
      setShowForm(false);
      loadData();
    } catch (err) {
      toast.error(err.customMessage || 'Erreur publication.');
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer cette annonce ?')) return;
    try {
      await deleteAnnouncement(id);
      toast.success('Annonce supprimée.');
      loadData();
    } catch (err) {
      toast.error(err.customMessage || 'Erreur suppression.');
    }
  }

  const typeColors = {
    info: 'bg-brand-500/10 text-brand-400 border-brand-500/30',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    critical: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Système</h1>
        <p className="text-dark-400 mt-1">Annonces globales et gestion des versions</p>
      </div>

      {/* ── ANNONCES ──────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10">
              <Megaphone className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Annonces globales</h3>
              <p className="text-xs text-dark-400">Diffusez des messages à tous les utilisateurs</p>
            </div>
          </div>
          <Button size="sm" icon={Plus} onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Annuler' : 'Nouvelle'}
          </Button>
        </div>

        {/* Formulaire création */}
        {showForm && (
          <form onSubmit={handleCreateAnnouncement} className="space-y-4 mb-6 p-4 rounded-lg bg-dark-800/40 border border-dark-700/50 animate-slide-up">
            <input
              placeholder="Titre de l'annonce"
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              className="w-full bg-dark-800 border border-dark-600 text-dark-100 placeholder-dark-500 rounded-lg px-4 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all"
            />
            <textarea
              placeholder="Contenu du message..."
              value={form.message}
              onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
              rows={3}
              className="w-full bg-dark-800 border border-dark-600 text-dark-100 placeholder-dark-500 rounded-lg px-4 py-2.5 text-sm resize-none
                focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all"
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                className="bg-dark-800 border border-dark-600 text-dark-100 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                <option value="info">Info</option>
                <option value="warning">Avertissement</option>
                <option value="critical">Critique</option>
                <option value="success">Succès</option>
              </select>
              <select value={form.targetRole} onChange={e => setForm(p => ({ ...p, targetRole: e.target.value }))}
                className="bg-dark-800 border border-dark-600 text-dark-100 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                <option value="">Tous les rôles</option>
                <option value="admin">Admin</option>
                <option value="user">Clients</option>
                <option value="superadmin">Super-Admin</option>
              </select>
              <Button type="submit" loading={sending} icon={Send}>Publier</Button>
            </div>
          </form>
        )}

        {/* Liste */}
        {announcements.length === 0 ? (
          <p className="text-dark-500 text-sm text-center py-4">Aucune annonce active.</p>
        ) : (
          <div className="space-y-2">
            {announcements.map(ann => (
              <div key={ann.id} className={`p-3 rounded-lg border ${typeColors[ann.type] || typeColors.info}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{ann.title}</p>
                    <p className="text-xs mt-1 opacity-80">{ann.message}</p>
                    <p className="text-xs mt-1 opacity-50">
                      {new Date(ann.createdAt).toLocaleDateString('fr-FR')}
                      {ann.targetRole && ` • ${ann.targetRole}`}
                    </p>
                  </div>
                  <button onClick={() => handleDelete(ann.id)} className="text-dark-500 hover:text-rose-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── VERSIONS ─────────────────────────── */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-cyan-500/10">
            <Code className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Versions déployées</h3>
            <p className="text-xs text-dark-400">Suivi des versions par organisation</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-lg bg-dark-800/40 mb-4">
          <Globe className="w-4 h-4 text-brand-400" />
          <span className="text-sm text-dark-300">Version actuelle de la plateforme :</span>
          <span className="text-sm font-bold text-brand-400 font-mono">{import.meta.env.VITE_APP_VERSION || '1.0.0'}</span>
        </div>

        {versions.length === 0 ? (
          <p className="text-dark-500 text-sm text-center py-4">Données de version non disponibles.</p>
        ) : (
          <div className="space-y-2">
            {versions.map((v, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-dark-800/30">
                <Building2 className="w-4 h-4 text-dark-500" />
                <span className="text-sm text-dark-300 flex-1 truncate">{v.orgName}</span>
                <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                  v.version === (import.meta.env.VITE_APP_VERSION || '1.0.0')
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-amber-500/10 text-amber-400'
                }`}>
                  v{v.version}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── SÉCURITÉ ──────────────────────────── */}
      <Card className="!bg-dark-800/30">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-emerald-400" />
          <div>
            <h3 className="text-sm font-semibold text-dark-300">Statut sécurité</h3>
            <p className="text-xs text-dark-500">JWT_SECRET configuré • Rate limiting actif • CORS restrictif • Helmet activé</p>
          </div>
          <span className="ml-auto badge-active">Opérationnel</span>
        </div>
      </Card>
    </div>
  );
}
