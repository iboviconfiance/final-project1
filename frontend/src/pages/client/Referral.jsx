import { useState, useEffect } from 'react';
import { getMyReferrals } from '../../api/marketingService';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import {
  Gift, Copy, CheckCircle2, Clock, Users, XCircle,
  Loader2, Share2, Calendar, Award
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Page Parrainage Client — "Gagner des jours gratuits"
 * 
 * Le client voit :
 * 1. Son code de parrainage unique (JEAN242)
 * 2. Un bouton de partage / copie
 * 3. La liste de ses filleuls avec leur statut
 * 4. Le total de jours gagnés
 */
export default function Referral() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { loadReferrals(); }, []);

  async function loadReferrals() {
    try {
      const res = await getMyReferrals();
      setData(res.data.data);
    } catch (err) {
      toast.error('Erreur chargement parrainages.');
    } finally {
      setLoading(false);
    }
  }

  async function copyCode() {
    if (!data?.referralCode) return;
    try {
      await navigator.clipboard.writeText(data.referralCode);
      setCopied(true);
      toast.success('Code copié !');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error('Impossible de copier.');
    }
  }

  async function shareCode() {
    if (!data?.referralCode) return;
    const text = `Rejoins-moi ! Utilise mon code ${data.referralCode} pour avoir une réduction sur ton premier abonnement 🎁`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Mon code de parrainage', text });
      } catch { /* User cancelled */ }
    } else {
      copyCode();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  const statusConfig = {
    pending: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'En attente de paiement' },
    completed: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Validé ✓' },
    rejected: { icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-500/10', label: 'Rejeté' },
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Gagner des jours gratuits</h1>
        <p className="text-dark-400 mt-1">Parrainez vos amis et gagnez du temps gratuit</p>
      </div>

      {/* ──── Mon code de parrainage ──── */}
      <Card className="!p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-brand-600/20 via-emerald-600/10 to-transparent p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
              <Gift className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Votre code de parrainage</h2>
              <p className="text-dark-400 text-sm">Partagez-le avec vos amis</p>
            </div>
          </div>

          {/* Code display */}
          <div className="bg-dark-900/80 backdrop-blur-sm rounded-xl p-4 border border-dark-600/50 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-2xl font-bold font-mono tracking-[0.2em] text-emerald-400">
                {data?.referralCode || '—'}
              </p>
            </div>
            <button
              onClick={copyCode}
              className={`p-2.5 rounded-lg transition-all ${
                copied
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-dark-700 text-dark-300 hover:text-white hover:bg-dark-600'
              }`}
              title="Copier"
            >
              {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
            <button
              onClick={shareCode}
              className="p-2.5 rounded-lg bg-brand-600 text-white hover:bg-brand-500 transition-all"
              title="Partager"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>

          <p className="text-dark-500 text-xs mt-3">
            🎁 Votre ami reçoit une réduction sur son premier mois.
            Vous recevez des jours gratuits quand il paie.
          </p>
        </div>
      </Card>

      {/* ──── Statistiques ──── */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center !p-4">
          <Users className="w-5 h-5 text-brand-400 mx-auto mb-1" />
          <p className="text-2xl font-bold text-white">{data?.totalReferred || 0}</p>
          <p className="text-dark-500 text-xs">Amis invités</p>
        </Card>
        <Card className="text-center !p-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
          <p className="text-2xl font-bold text-emerald-400">{data?.completed || 0}</p>
          <p className="text-dark-500 text-xs">Validés</p>
        </Card>
        <Card className="text-center !p-4">
          <Award className="w-5 h-5 text-amber-400 mx-auto mb-1" />
          <p className="text-2xl font-bold text-amber-400">+{data?.totalBonusDays || 0}j</p>
          <p className="text-dark-500 text-xs">Jours gagnés</p>
        </Card>
      </div>

      {/* ──── Liste des filleuls ──── */}
      <div>
        <h3 className="text-sm font-semibold text-dark-300 mb-3">Vos filleuls</h3>
        {!data?.referrals?.length ? (
          <Card>
            <div className="text-center py-8">
              <Users className="w-10 h-10 text-dark-600 mx-auto mb-2" />
              <p className="text-dark-400 text-sm">Aucun filleul pour le moment</p>
              <p className="text-dark-600 text-xs mt-1">Partagez votre code pour commencer</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {data.referrals.map((ref) => {
              const sc = statusConfig[ref.status] || statusConfig.pending;
              const StatusIcon = sc.icon;

              return (
                <Card key={ref.id} className="!p-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${sc.bg} flex-shrink-0`}>
                      <StatusIcon className={`w-4 h-4 ${sc.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-dark-200 truncate">
                        {ref.referredName || 'Utilisateur'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-dark-500 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {new Date(ref.createdAt).toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-xs font-medium ${sc.color}`}>{sc.label}</span>
                      {ref.status === 'completed' && (
                        <p className="text-xs text-emerald-400 font-bold mt-0.5">
                          +{ref.rewardValue} {ref.rewardType === 'days' ? 'jours' : '%'}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
