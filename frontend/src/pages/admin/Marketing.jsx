import { useState, useEffect } from 'react';
import {
  listCoupons, createCoupon, updateCoupon, deleteCoupon,
  getCouponStats, getOrgReferrals, getReferralConfig, updateReferralConfig
} from '../../api/marketingService';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import {
  Tag, Plus, Percent, Hash, Users, Gift, Settings, Loader2,
  CheckCircle2, XCircle, Clock, TrendingUp, Calendar, Trash2,
  ToggleLeft, ToggleRight, ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Page Admin Marketing
 * 
 * Deux onglets :
 * 1. Codes Promo — CRUD des coupons
 * 2. Parrainage — Config + stats des parrainages BtoC
 */
export default function Marketing() {
  const [tab, setTab] = useState('coupons');

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Marketing</h1>
        <p className="text-dark-400 mt-1">Codes promo et programme de parrainage</p>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-dark-800/50 rounded-lg p-1">
        {[
          { id: 'coupons', label: 'Codes Promo', icon: Tag },
          { id: 'referrals', label: 'Parrainage', icon: Gift },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all
              ${tab === t.id
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20'
                : 'text-dark-400 hover:text-dark-200'
              }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'coupons' && <CouponsTab />}
      {tab === 'referrals' && <ReferralsTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// TAB 1 : CODES PROMO
// ═══════════════════════════════════════════════════════
function CouponsTab() {
  const [loading, setLoading] = useState(true);
  const [coupons, setCoupons] = useState([]);
  const [stats, setStats] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    code: '', type: 'percentage', value: '', minPurchase: '', maxUses: '', expiresAt: ''
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [cRes, sRes] = await Promise.all([listCoupons(), getCouponStats()]);
      setCoupons(cRes.data.data.coupons || []);
      setStats(sRes.data.data);
    } catch { toast.error('Erreur chargement.'); }
    finally { setLoading(false); }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.code || !form.value) return toast.error('Code et valeur requis.');
    setCreating(true);
    try {
      await createCoupon({
        code: form.code,
        type: form.type,
        value: parseFloat(form.value),
        minPurchase: form.minPurchase ? parseFloat(form.minPurchase) : 0,
        maxUses: form.maxUses ? parseInt(form.maxUses) : null,
        expiresAt: form.expiresAt || null,
      });
      toast.success('Coupon créé !');
      setShowCreate(false);
      setForm({ code: '', type: 'percentage', value: '', minPurchase: '', maxUses: '', expiresAt: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur création.');
    } finally { setCreating(false); }
  }

  async function handleToggle(coupon) {
    try {
      await updateCoupon(coupon.id, { isActive: !coupon.isActive });
      toast.success(coupon.isActive ? 'Coupon désactivé.' : 'Coupon activé.');
      load();
    } catch { toast.error('Erreur.'); }
  }

  async function handleDelete(id) {
    if (!confirm('Désactiver ce coupon ?')) return;
    try {
      await deleteCoupon(id);
      toast.success('Coupon supprimé.');
      load();
    } catch { toast.error('Erreur.'); }
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>;

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total coupons', value: stats.totalCoupons, icon: Tag, color: 'text-brand-400' },
            { label: 'Actifs', value: stats.activeCoupons, icon: CheckCircle2, color: 'text-emerald-400' },
            { label: 'Utilisations', value: stats.totalUsages, icon: Users, color: 'text-amber-400' },
            { label: 'Réductions offertes', value: `${(stats.totalDiscountGiven || 0).toLocaleString()} XAF`, icon: TrendingUp, color: 'text-rose-400' },
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
      <Button onClick={() => setShowCreate(!showCreate)} icon={showCreate ? ChevronDown : Plus} variant={showCreate ? 'ghost' : 'primary'}>
        {showCreate ? 'Fermer' : 'Nouveau code promo'}
      </Button>

      {/* Formulaire création */}
      {showCreate && (
        <Card className="animate-fade-in">
          <h3 className="text-sm font-semibold text-dark-200 mb-4">Créer un code promo</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Code *" icon={Tag} placeholder="FETE2026" value={form.code}
                onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} />

              <div>
                <label className="text-xs font-medium text-dark-400 block mb-1.5">Type *</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                  className="w-full bg-dark-800 border border-dark-600 text-dark-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                  <option value="percentage">Pourcentage (%)</option>
                  <option value="fixed">Montant fixe (XAF)</option>
                </select>
              </div>

              <Input label={form.type === 'percentage' ? 'Pourcentage *' : 'Montant *'}
                icon={form.type === 'percentage' ? Percent : Hash}
                type="number" placeholder={form.type === 'percentage' ? '15' : '2000'}
                value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))} />

              <Input label="Montant min. achat" icon={Hash} type="number" placeholder="0"
                value={form.minPurchase} onChange={e => setForm(p => ({ ...p, minPurchase: e.target.value }))} />

              <Input label="Utilisations max" icon={Users} type="number" placeholder="50 (vide = illimité)"
                value={form.maxUses} onChange={e => setForm(p => ({ ...p, maxUses: e.target.value }))} />

              <Input label="Date d'expiration" icon={Calendar} type="date"
                value={form.expiresAt} onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))} />
            </div>

            <Button type="submit" loading={creating} icon={Plus} className="w-full sm:w-auto">
              Créer le coupon
            </Button>
          </form>
        </Card>
      )}

      {/* Liste des coupons */}
      {coupons.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <Tag className="w-10 h-10 text-dark-600 mx-auto mb-2" />
            <p className="text-dark-400 text-sm">Aucun code promo</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {coupons.map(c => (
            <Card key={c.id} className={`!p-4 ${!c.isActive || c.isExpired || c.isExhausted ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-3">
                {/* Code */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold font-mono text-brand-400">{c.code}</p>
                    {c.isExpired && <span className="text-xs bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded">Expiré</span>}
                    {c.isExhausted && <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded">Épuisé</span>}
                  </div>
                  <p className="text-xs text-dark-500 mt-0.5">
                    {c.type === 'percentage' ? `-${c.value}%` : `-${parseFloat(c.value).toLocaleString()} XAF`}
                    {c.maxUses && ` • ${c.currentUses}/${c.maxUses} utilisations`}
                    {c.expiresAt && ` • Expire ${new Date(c.expiresAt).toLocaleDateString('fr-FR')}`}
                  </p>
                </div>

                {/* Actions */}
                <button onClick={() => handleToggle(c)}
                  className="p-1.5 text-dark-400 hover:text-white transition-colors" title={c.isActive ? 'Désactiver' : 'Activer'}>
                  {c.isActive ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
                <button onClick={() => handleDelete(c.id)}
                  className="p-1.5 text-dark-400 hover:text-rose-400 transition-colors" title="Supprimer">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// TAB 2 : PARRAINAGE
// ═══════════════════════════════════════════════════════
function ReferralsTab() {
  const [loading, setLoading] = useState(true);
  const [referrals, setReferrals] = useState([]);
  const [refStats, setRefStats] = useState(null);
  const [config, setConfig] = useState(null);
  const [configForm, setConfigForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [rRes, cRes] = await Promise.all([getOrgReferrals(), getReferralConfig()]);
      setReferrals(rRes.data.data.referrals || []);
      setRefStats(rRes.data.data.stats);
      setConfig(cRes.data.data);
      setConfigForm(cRes.data.data);
    } catch { toast.error('Erreur chargement.'); }
    finally { setLoading(false); }
  }

  async function saveConfig() {
    setSaving(true);
    try {
      await updateReferralConfig(configForm);
      toast.success('Configuration sauvegardée.');
    } catch { toast.error('Erreur.'); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>;

  const statusConfig = {
    pending: { color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'En attente' },
    completed: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Complété' },
    rejected: { color: 'text-rose-400', bg: 'bg-rose-500/10', label: 'Fraude' },
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      {refStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total parrainages', value: refStats.total, color: 'text-brand-400' },
            { label: 'Complétés', value: refStats.completed, color: 'text-emerald-400' },
            { label: 'Jours offerts', value: `+${refStats.totalBonusDays}j`, color: 'text-amber-400' },
            { label: 'Fraudes rejetées', value: refStats.rejected, color: 'text-rose-400' },
          ].map((s, i) => (
            <Card key={i} className="!p-3 text-center">
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-dark-500 text-xs">{s.label}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Config parrainage */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-4 h-4 text-dark-400" />
          <h3 className="text-sm font-semibold text-dark-200">Configuration du parrainage</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-dark-400 block mb-1.5">Récompense parrain</label>
            <select value={configForm.rewardType || 'days'}
              onChange={e => setConfigForm(p => ({ ...p, rewardType: e.target.value }))}
              className="w-full bg-dark-800 border border-dark-600 text-dark-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
              <option value="days">Jours gratuits</option>
              <option value="discount_percent">Réduction %</option>
              <option value="discount_fixed">Réduction fixe (XAF)</option>
            </select>
          </div>
          <Input label="Valeur récompense" type="number" placeholder="5"
            value={configForm.rewardValue || ''} onChange={e => setConfigForm(p => ({ ...p, rewardValue: e.target.value }))} />
          <Input label="Réduction filleul (%)" type="number" placeholder="10"
            value={configForm.referredDiscount || ''} onChange={e => setConfigForm(p => ({ ...p, referredDiscount: e.target.value }))} />
        </div>
        <Button onClick={saveConfig} loading={saving} className="mt-3" size="sm">
          Sauvegarder
        </Button>
      </Card>

      {/* Liste des parrainages */}
      <h3 className="text-sm font-semibold text-dark-300">Historique des parrainages</h3>
      {referrals.length === 0 ? (
        <Card><div className="text-center py-6 text-dark-400 text-sm">Aucun parrainage</div></Card>
      ) : (
        <div className="space-y-2">
          {referrals.map(r => {
            const sc = statusConfig[r.status] || statusConfig.pending;
            return (
              <Card key={r.id} className="!p-3">
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-dark-200 truncate">
                      {r.referrer?.firstName} {r.referrer?.lastName}
                      <span className="text-dark-500 mx-1.5">→</span>
                      {r.referred?.firstName} {r.referred?.lastName}
                    </p>
                    <p className="text-xs text-dark-500 mt-0.5">
                      Code : {r.referralCode} • {new Date(r.createdAt).toLocaleDateString('fr-FR')}
                      {r.fraudFlags?.length > 0 && (
                        <span className="text-rose-400 ml-2">⚠️ {r.fraudFlags.join(', ')}</span>
                      )}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded ${sc.bg} ${sc.color}`}>
                    {sc.label}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
