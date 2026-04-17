import { useState } from 'react';
import { validateCoupon } from '../../api/marketingService';
import { Tag, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

/**
 * PromoCodeInput — Champ de saisie code promo avec validation async
 * 
 * SÉCURITÉ : Ce composant affiche UNIQUEMENT la réduction retournée par le backend.
 * Il n'envoie JAMAIS un prix final manipulé, seulement le code et le planId.
 * 
 * @param {string} planId - ID du plan sélectionné
 * @param {number} originalPrice - Prix original (pour l'affichage seulement)
 * @param {function} onValidated - Callback ({ couponId, discount, finalPrice, code })
 * @param {function} onCleared - Callback quand le code est supprimé
 */
export default function PromoCodeInput({ planId, originalPrice, onValidated, onCleared }) {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleValidate() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || trimmed.length < 3) {
      setErrorMsg('Code trop court.');
      setStatus('error');
      return;
    }

    // Validation format côté frontend (alphanumeric + tirets)
    if (!/^[A-Z0-9\-_]{3,30}$/.test(trimmed)) {
      setErrorMsg('Format invalide. Utilisez des lettres, chiffres ou tirets.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await validateCoupon(trimmed, planId);
      const data = res.data.data;

      if (data.valid) {
        setStatus('success');
        setResult(data);
        onValidated?.({
          couponId: data.coupon.id,
          code: data.coupon.code,
          discount: data.discount,
          finalPrice: data.finalPrice,
        });
      } else {
        setStatus('error');
        setErrorMsg(data.error || 'Code invalide.');
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.response?.data?.error || 'Erreur de vérification.');
    }
  }

  function handleClear() {
    setCode('');
    setStatus('idle');
    setResult(null);
    setErrorMsg('');
    onCleared?.();
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-dark-400 block">Code promo ou parrainage</label>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              if (status !== 'idle') {
                setStatus('idle');
                setResult(null);
                setErrorMsg('');
                onCleared?.();
              }
            }}
            disabled={status === 'success'}
            placeholder="BIENVENUE2026"
            className={`w-full pl-10 pr-4 py-2.5 rounded-lg text-sm font-mono tracking-wider
              bg-dark-800 border transition-all outline-none
              ${status === 'success' 
                ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/5' 
                : status === 'error'
                  ? 'border-rose-500/50 text-dark-100'
                  : 'border-dark-600 text-dark-100 focus:border-brand-500/50'}
              disabled:opacity-60`}
            onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
          />
        </div>

        {status === 'success' ? (
          <button
            onClick={handleClear}
            className="px-4 py-2.5 rounded-lg bg-dark-700 text-dark-300 hover:text-white 
              text-sm font-medium transition-all hover:bg-dark-600"
          >
            Retirer
          </button>
        ) : (
          <button
            onClick={handleValidate}
            disabled={status === 'loading' || !code.trim()}
            className="px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium
              hover:bg-brand-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed
              flex items-center gap-2"
          >
            {status === 'loading' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Appliquer'
            )}
          </button>
        )}
      </div>

      {/* Feedback visuel */}
      {status === 'success' && result && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <span className="text-emerald-300 font-medium">
              -{result.discount.toLocaleString()} XAF
            </span>
            <span className="text-dark-400 mx-1">•</span>
            <span className="text-dark-300 line-through text-xs">
              {originalPrice?.toLocaleString()} XAF
            </span>
            <span className="text-dark-400 mx-1">→</span>
            <span className="text-emerald-400 font-bold">
              {result.finalPrice.toLocaleString()} XAF
            </span>
          </div>
        </div>
      )}

      {status === 'error' && errorMsg && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 animate-fade-in">
          <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span className="text-rose-300 text-sm">{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
