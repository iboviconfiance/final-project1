import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import PromoCodeInput from '../../components/ui/PromoCodeInput';
import {
  getSubscriptionStatus, getPlans, subscribe, getSubscriptionHistory
} from '../../api/clientService';
import { detectOperator, getOperatorInfo, formatPhoneNumber } from '../../utils/phoneUtils';
import {
  CreditCard, Clock, CheckCircle2, Zap, Shield, Phone,
  Loader2, ArrowRight, RefreshCw, ChevronDown, Star, XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Page Abonnement — Sélection de plan + Paiement MoMo/Airtel
 * 
 * Flux :
 * 1. Affiche le statut actuel
 * 2. Liste les plans disponibles
 * 3. Formulaire de paiement (numéro MoMo + détection opérateur)
 * 4. Feedback "En attente du Webhook"
 */
export default function Subscription() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState(null);
  const [plans, setPlans] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [phone, setPhone] = useState('');
  const [operator, setOperator] = useState(null);
  const [paying, setPaying] = useState(false);
  const [pendingTx, setPendingTx] = useState(false);
  const [couponData, setCouponData] = useState(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [subRes, plansRes, histRes] = await Promise.allSettled([
        getSubscriptionStatus(),
        getPlans(),
        getSubscriptionHistory(),
      ]);

      if (subRes.status === 'fulfilled') setSub(subRes.value.data.data);
      if (plansRes.status === 'fulfilled') setPlans(plansRes.value.data.data?.plans || []);
      if (histRes.status === 'fulfilled') setHistory(histRes.value.data.data?.history || []);
    } catch (err) {
      // silent
    } finally {
      setLoading(false);
    }
  }

  // Détection opérateur à la saisie du numéro
  function handlePhoneChange(e) {
    const val = e.target.value;
    setPhone(val);
    if (val.length >= 2) {
      const { operator: op } = detectOperator(val);
      setOperator(op);
    } else {
      setOperator(null);
    }
  }

  function handleSelectPlan(plan) {
    setSelectedPlan(plan);
    setShowPayment(true);
    setCouponData(null); // Reset when changing plans
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  async function handlePay(e) {
    e.preventDefault();
    if (!selectedPlan || !phone.trim()) {
      return toast.error('Numéro de téléphone requis.');
    }

    const { formatted } = detectOperator(phone);
    if (formatted.length < 9) {
      return toast.error('Numéro invalide. Entrez 9 chiffres minimum.');
    }

    setPaying(true);
    try {
      await subscribe({
        planId: selectedPlan.id,
        phoneNumber: formatted,
        paymentMethod: 'mobile_money', // API expects generic 'mobile_money'
        metadata: { operator: operator === 'airtel' ? 'airtel' : 'mtn' },
        couponCode: couponData?.code || null,
      });

      toast.success('Demande envoyée ! En attente de confirmation...');
      setPendingTx(true);
      setShowPayment(false);

      // Poll toutes les 10s pour voir si le webhook a validé
      const pollInterval = setInterval(async () => {
        try {
          const res = await getSubscriptionStatus();
          if (res.data.data?.status === 'active') {
            clearInterval(pollInterval);
            setPendingTx(false);
            setSub(res.data.data);
            toast.success('🎉 Paiement confirmé ! Bienvenue.');
            loadData();
          }
        } catch {}
      }, 10000);

      // Stop polling après 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (pendingTx) {
          setPendingTx(false);
          toast('Le paiement est en cours de traitement.', { icon: '⏳' });
        }
      }, 5 * 60 * 1000);

    } catch (err) {
      toast.error(err.customMessage || 'Erreur paiement.');
    } finally {
      setPaying(false);
    }
  }

  const statusBadge = {
    active: { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', label: 'Actif' },
    grace_period: { color: 'bg-amber-500/10 text-amber-400 border-amber-500/30', label: 'Période de grâce' },
    expired: { color: 'bg-rose-500/10 text-rose-400 border-rose-500/30', label: 'Expiré' },
  };

  const operatorInfo = operator ? getOperatorInfo(operator) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* ── Statut actuel ── */}
      <div>
        <h1 className="text-2xl font-bold text-white">Mon abonnement</h1>
        <p className="text-dark-400 mt-1">Gérez votre abonnement et vos paiements</p>
      </div>

      {sub && sub.status !== 'no_subscription' && (
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-white">{sub.planName || 'Mon Plan'}</h3>
                <span className={`text-xs px-2.5 py-0.5 rounded-full border ${statusBadge[sub.status]?.color || statusBadge.expired.color}`}>
                  {statusBadge[sub.status]?.label || sub.status}
                </span>
              </div>
              <p className="text-dark-400 text-sm mt-1">
                {sub.daysLeft > 0
                  ? `${sub.daysLeft} jour${sub.daysLeft > 1 ? 's' : ''} restant${sub.daysLeft > 1 ? 's' : ''}`
                  : 'Expiré'}
                {sub.endDate && ` • Fin le ${new Date(sub.endDate).toLocaleDateString('fr-FR')}`}
              </p>
            </div>
            {sub.planPrice && (
              <div className="text-right">
                <p className="text-2xl font-bold text-white">{sub.planPrice.toLocaleString()}</p>
                <p className="text-xs text-dark-500">XAF / période</p>
              </div>
            )}
          </div>

          {/* Barre de progression */}
          <div className="mt-4 h-2 bg-dark-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                sub.status === 'active' ? 'bg-emerald-500' :
                sub.status === 'grace_period' ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${sub.totalDays ? Math.max(0, (sub.daysLeft / sub.totalDays) * 100) : 0}%` }}
            />
          </div>
        </Card>
      )}

      {/* ── En attente de paiement ── */}
      {pendingTx && (
        <Card className="!bg-amber-500/5 border-amber-500/20 animate-pulse-slow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-300">Paiement en cours de traitement</p>
              <p className="text-xs text-amber-400/70 mt-0.5">
                Confirmez la transaction sur votre téléphone. Nous vérifions automatiquement...
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ── Liste des plans disponibles ── */}
      <div>
        <h2 className="text-lg font-semibold text-dark-200 mb-3">
          {sub?.status === 'active' ? 'Changer de plan' : 'Choisir un plan'}
        </h2>

        {plans.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <CreditCard className="w-10 h-10 text-dark-600 mx-auto mb-2" />
              <p className="text-dark-400 text-sm">Aucun plan disponible pour le moment.</p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((plan, i) => {
              const isSelected = selectedPlan?.id === plan.id;
              const isPopular = i === 1; // 2ème plan = populaire

              return (
                <div
                  key={plan.id}
                  onClick={() => handleSelectPlan(plan)}
                  className={`relative cursor-pointer rounded-xl p-5 border-2 transition-all duration-200 ${
                    isSelected
                      ? 'border-brand-500 bg-brand-500/5 scale-[1.02]'
                      : 'border-dark-700/50 bg-dark-800/40 hover:border-dark-600 hover:bg-dark-800/60'
                  }`}
                >
                  {/* Badge populaire */}
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                        <Star className="w-3 h-3" /> Populaire
                      </span>
                    </div>
                  )}

                  <h3 className="text-base font-semibold text-white">{plan.name}</h3>
                  <p className="text-xs text-dark-500 mt-1">{plan.description || `Durée : ${plan.durationDays || 30} jours`}</p>

                  <div className="mt-3">
                    <span className="text-3xl font-bold text-white">{(plan.price || 0).toLocaleString()}</span>
                    <span className="text-sm text-dark-400 ml-1">XAF</span>
                  </div>

                  {/* Features */}
                  <ul className="mt-3 space-y-1.5">
                    <li className="flex items-center gap-2 text-xs text-dark-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      Accès complet
                    </li>
                    <li className="flex items-center gap-2 text-xs text-dark-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      QR Code de validation
                    </li>
                    <li className="flex items-center gap-2 text-xs text-dark-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      Support prioritaire
                    </li>
                  </ul>

                  {isSelected && (
                    <div className="mt-3 flex items-center justify-center gap-1 text-xs text-brand-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Sélectionné
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Formulaire de paiement MoMo/Airtel ── */}
      {showPayment && selectedPlan && (
        <Card className="animate-slide-up">
          <h3 className="text-lg font-semibold text-white mb-1">Paiement Mobile</h3>
          <p className="text-dark-400 text-sm mb-4">
            Plan <span className="font-medium text-brand-400">{selectedPlan.name}</span> —{' '}
            <span className="font-bold text-white">{(selectedPlan.price || 0).toLocaleString()} XAF</span>
          </p>

          <form onSubmit={handlePay} className="space-y-4">
            {/* Numéro avec détection opérateur */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-dark-300">Numéro Mobile Money</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                <input
                  type="tel"
                  placeholder="06 XXX XX XX"
                  value={phone}
                  onChange={handlePhoneChange}
                  maxLength={15}
                  className="w-full bg-dark-800 border border-dark-600 text-dark-100 placeholder-dark-500 rounded-lg pl-10 pr-32 py-3 text-sm
                    focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all font-mono text-base"
                />
                {/* Badge opérateur */}
                {operatorInfo && operator !== 'unknown' && (
                  <div className={`absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg border text-xs font-semibold ${operatorInfo.bg} ${operatorInfo.color}`}>
                    {operatorInfo.shortName}
                  </div>
                )}
              </div>
              <p className="text-xs text-dark-500">
                {operator === 'mtn' && '📱 MTN Mobile Money détecté'}
                {operator === 'airtel' && '📱 Airtel Money détecté'}
                {operator === 'unknown' && '⚠️ Opérateur non reconnu'}
                {!operator && 'Entrez votre numéro Congo (04/05/06 = MTN, 01/02/03/07 = Airtel)'}
              </p>
            </div>

            {/* Récapitulatif et Code Promo */}
            <div className="space-y-4">
              <PromoCodeInput 
                planId={selectedPlan.id} 
                originalPrice={selectedPlan.price || 0} 
                onValidated={(data) => setCouponData(data)} 
                onCleared={() => setCouponData(null)} 
              />

              <div className="p-3 rounded-lg bg-dark-800/40 border border-dark-700/50 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-dark-400">Plan</span>
                  <span className="text-dark-200 font-medium">{selectedPlan.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-dark-400">Durée</span>
                  <span className="text-dark-200">{selectedPlan.durationDays || 30} jours</span>
                </div>
                {couponData && (
                  <div className="flex justify-between text-sm text-emerald-400">
                    <span>Réduction ({couponData.code})</span>
                    <span>-{couponData.discount.toLocaleString()} XAF</span>
                  </div>
                )}
                <div className="flex justify-between text-sm border-t border-dark-700/50 pt-2">
                  <span className="text-dark-300 font-semibold">Total à payer</span>
                  <div className="text-right">
                    {couponData && (
                      <span className="text-xs text-dark-500 line-through mr-2">
                        {(selectedPlan.price || 0).toLocaleString()}
                      </span>
                    )}
                    <span className="text-white font-bold text-base">
                      {(couponData ? couponData.finalPrice : (selectedPlan.price || 0)).toLocaleString()} XAF
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="submit" loading={paying} icon={CreditCard} className="flex-1" size="lg">
                Payer maintenant
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setShowPayment(false); setSelectedPlan(null); }}
              >
                Annuler
              </Button>
            </div>

            <p className="text-xs text-dark-600 text-center flex items-center justify-center gap-1">
              <Shield className="w-3 h-3" /> Transaction sécurisée et chiffrée
            </p>
          </form>
        </Card>
      )}

      {/* ── Historique ── */}
      {history.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-dark-300 mb-3">Historique des abonnements</h3>
          <div className="space-y-2">
            {history.map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-dark-800/30">
                <div className={`p-1 rounded-lg ${
                  item.status === 'active' ? 'bg-emerald-500/10' :
                  item.status === 'expired' ? 'bg-dark-700' : 'bg-amber-500/10'
                }`}>
                  {item.status === 'active'
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    : <XCircle className="w-3.5 h-3.5 text-dark-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-dark-200 truncate">{item.planName}</p>
                  <p className="text-xs text-dark-500">
                    {new Date(item.startDate).toLocaleDateString('fr-FR')}
                    → {new Date(item.endDate).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <span className="text-xs text-dark-400">{(item.amount || 0).toLocaleString()} XAF</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
