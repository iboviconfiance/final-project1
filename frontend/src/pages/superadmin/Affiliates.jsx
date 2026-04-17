import { useState, useEffect } from 'react';
import {
  listAffiliates, createAffiliate, updateAffiliate,
  getAffiliateCommissions, payCommissions
} from '../../api/marketingService';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import {
  Users, Plus, Loader2, DollarSign, TrendingUp, Building2,
  CheckCircle2, Clock, XCircle, ChevronDown, Pause, Play,
  Mail, Phone, Hash, User, FileText, Wallet
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Super-Admin — Gestion des Affiliés (Option C)
 * 
 * Partenaires BtoB qui ramènent de nouvelles organisations.
 * Le Super-Admin voit tout : commits, paiements, soldes.
 */
export default function Affiliates() {
  const [loading, setLoading] = useState(true);
  const [affiliates, setAffiliates] = useState([]);
  const [stats, setStats] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedAffiliate, setSelectedAffiliate] = useState(null);
  const [commissions, setCommissions] = useState([]);
  const [loadingCommissions, setLoadingCommissions] = useState(false);

  const [form, setForm] = useState({
    name: '', email: '', phone: '', affiliateCode: '',
    commissionType: 'percentage', commissionValue: '10', notes: ''
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await listAffiliates();
      setAffiliates(res.data.data.affiliates || []);
      setStats(res.data.data.stats);
    } catch { toast.error('Erreur chargement.'); }
    finally { setLoading(false); }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name || !form.affiliateCode) return toast.error('Nom et code requis.');
    setCreating(true);
    try {
      await createAffiliate({
        ...form,
        commissionValue: parseFloat(form.commissionValue),
      });
      toast.success('Affilié créé !');
      setShowCreate(false);
      setForm({ name: '', email: '', phone: '', affiliateCode: '', commissionType: 'percentage', commissionValue: '10', notes: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur.');
    } finally { setCreating(false); }
  }

  async function handleStatusToggle(affiliate) {
    const newStatus = affiliate.status === 'active' ? 'paused' : 'active';
    try {
      await updateAffiliate(affiliate.id, { status: newStatus });
      toast.success(`Affilié ${newStatus === 'active' ? 'activé' : 'suspendu'}.`);
      load();
    } catch { toast.error('Erreur.'); }
  }

  async function viewCommissions(affiliate) {
    setSelectedAffiliate(affiliate);
    setLoadingCommissions(true);
    try {
      const res = await getAffiliateCommissions(affiliate.id);
      setCommissions(res.data.data || []);
    } catch { toast.error('Erreur chargement commissions.'); }
    finally { setLoadingCommissions(false); }
  }

  async function handlePayAll() {
    if (!selectedAffiliate) return;
    const pending = commissions.filter(c => c.status === 'pending').map(c => c.id);
    if (!pending.length) return toast.error('Aucune commission en attente.');
    if (!confirm(`Marquer ${pending.length} commission(s) comme payées ?`)) return;

    try {
      const res = await payCommissions(selectedAffiliate.id, pending);
      toast.success(`${res.data.data.paidCount} commissions payées (${res.data.data.totalPaid.toLocaleString()} XAF).`);
      viewCommissions(selectedAffiliate);
      load();
    } catch { toast.error('Erreur paiement.'); }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Partenaires & Affiliation</h1>
        <p className="text-dark-400 mt-1">Option C — Gérez vos apporteurs d'affaires</p>
      </div>

      {/* Stats globales */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Partenaires', value: stats.totalAffiliates, icon: Users, color: 'text-amber-400' },
            { label: 'Orgs ramenées', value: stats.totalOrgsReferred, icon: Building2, color: 'text-emerald-400' },
            { label: 'Total gagné', value: `${(stats.totalEarned || 0).toLocaleString()} XAF`, icon: TrendingUp, color: 'text-amber-400' },
            { label: 'Impayé', value: `${(stats.totalUnpaid || 0).toLocaleString()} XAF`, icon: Wallet, color: 'text-rose-400' },
          ].map((s, i) => (
            <Card key={i} className="!p-3 text-center">
              <s.icon className={`w-4 h-4 ${s.color} mx-auto mb-1`} />
              <p className="text-lg font-bold text-white">{s.value}</p>
              <p className="text-dark-500 text-xs">{s.label}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Bouton créer */}
      <Button onClick={() => setShowCreate(!showCreate)} icon={showCreate ? ChevronDown : Plus}
        variant={showCreate ? 'ghost' : 'primary'}>
        {showCreate ? 'Fermer' : 'Nouveau partenaire'}
      </Button>

      {/* Formulaire */}
      {showCreate && (
        <Card className="animate-fade-in">
          <h3 className="text-sm font-semibold text-dark-200 mb-4">Nouveau partenaire affilié</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Nom du partenaire *" icon={User} placeholder="Jean Mvila"
                value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              <Input label="Code affilié *" icon={Hash} placeholder="PARTNER-KONGO"
                value={form.affiliateCode} onChange={e => setForm(p => ({ ...p, affiliateCode: e.target.value.toUpperCase() }))} />
              <Input label="Email" icon={Mail} placeholder="partenaire@email.com" type="email"
                value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              <Input label="Téléphone" icon={Phone} placeholder="+242 06 XXX XXXX"
                value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              <div>
                <label className="text-xs font-medium text-dark-400 block mb-1.5">Type de commission</label>
                <select value={form.commissionType} onChange={e => setForm(p => ({ ...p, commissionType: e.target.value }))}
                  className="w-full bg-dark-800 border border-dark-600 text-dark-100 rounded-lg px-3 py-2.5 text-sm">
                  <option value="percentage">Pourcentage (%)</option>
                  <option value="fixed">Montant fixe (XAF)</option>
                </select>
              </div>
              <Input label="Valeur commission" icon={DollarSign} type="number" placeholder="10"
                value={form.commissionValue} onChange={e => setForm(p => ({ ...p, commissionValue: e.target.value }))} />
            </div>
            <Input label="Notes" icon={FileText} placeholder="Influenceur Brazzaville, réseau salles de sport..."
              value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            <Button type="submit" loading={creating} icon={Plus} className="w-full sm:w-auto">
              Créer le partenaire
            </Button>
          </form>
        </Card>
      )}

      {/* Liste des affiliés */}
      {affiliates.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <Users className="w-12 h-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-300 font-medium">Aucun partenaire</p>
            <p className="text-dark-500 text-sm mt-1">Créez votre premier affilié pour commencer</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {affiliates.map(a => {
            const unpaid = parseFloat(a.totalEarned) - parseFloat(a.totalPaid);
            return (
              <Card key={a.id} className={`!p-4 ${a.status !== 'active' ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${
                    a.status === 'active' ? 'bg-emerald-500/10' : 'bg-dark-700'
                  }`}>
                    <User className={`w-5 h-5 ${a.status === 'active' ? 'text-emerald-400' : 'text-dark-500'}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white truncate">{a.name}</p>
                      <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                        {a.affiliateCode}
                      </span>
                    </div>
                    <p className="text-xs text-dark-500 mt-0.5">
                      {a.email || '—'} • {a.commissionType === 'percentage' ? `${a.commissionValue}%` : `${parseFloat(a.commissionValue).toLocaleString()} XAF`}
                      • {a.organizationsReferred} org(s)
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-dark-400">
                        Gagné : <span className="text-emerald-400 font-medium">{parseFloat(a.totalEarned).toLocaleString()} XAF</span>
                      </span>
                      {unpaid > 0 && (
                        <span className="text-xs text-amber-400 font-medium">
                          Impayé : {unpaid.toLocaleString()} XAF
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => viewCommissions(a)}
                      className="px-3 py-1.5 text-xs bg-dark-700 text-dark-300 hover:text-white rounded-lg transition-colors">
                      Détails
                    </button>
                    <button onClick={() => handleStatusToggle(a)}
                      className="p-1.5 text-dark-400 hover:text-white transition-colors"
                      title={a.status === 'active' ? 'Suspendre' : 'Activer'}>
                      {a.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal commissions */}
      {selectedAffiliate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedAffiliate(null)}>
          <div className="bg-dark-900 border border-dark-700 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-dark-700">
              <h3 className="text-lg font-bold text-white">{selectedAffiliate.name}</h3>
              <p className="text-dark-400 text-sm">Commissions — Code : {selectedAffiliate.affiliateCode}</p>
            </div>

            <div className="p-5 overflow-y-auto max-h-[50vh]">
              {loadingCommissions ? (
                <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-amber-500 mx-auto" /></div>
              ) : commissions.length === 0 ? (
                <p className="text-dark-400 text-sm text-center py-8">Aucune commission</p>
              ) : (
                <div className="space-y-2">
                  {commissions.map(c => (
                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg bg-dark-800/50 border border-dark-700/50">
                      {c.status === 'paid'
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        : <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      }
                      <div className="flex-1">
                        <p className="text-sm text-dark-200">{c.Organization?.name || 'Organisation'}</p>
                        <p className="text-xs text-dark-500">{new Date(c.createdAt).toLocaleDateString('fr-FR')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-white">{parseFloat(c.amount).toLocaleString()} XAF</p>
                        <span className={`text-xs ${c.status === 'paid' ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {c.status === 'paid' ? 'Payée' : 'En attente'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-dark-700 flex gap-3">
              <Button onClick={handlePayAll} icon={Wallet} className="flex-1" size="sm">
                Tout marquer payé
              </Button>
              <Button onClick={() => setSelectedAffiliate(null)} variant="ghost" size="sm">
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
