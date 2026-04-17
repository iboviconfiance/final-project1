import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getQrToken } from '../api/systemService';
import Card from './ui/Card';
import { QrCode, RefreshCw, ShieldCheck, ShieldOff, Clock } from 'lucide-react';

/**
 * Composant QR Code Sécurisé
 * 
 * SÉCURITÉ :
 * - Token rotatif toutes les 5 minutes (HMAC-SHA256)
 * - Grisé/barré si abonnement expiré
 * - Compteur de rafraîchissement visible
 * - Empêche les captures d'écran frauduleuses
 */
export default function SecureQrCode({ subscriptionStatus }) {
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(300); // 5 min
  const [error, setError] = useState(null);

  const fetchToken = useCallback(async () => {
    try {
      const res = await getQrToken();
      const data = res.data.data;
      setQrData(data);
      setCountdown(data.refreshIn || 300);
      setError(null);
    } catch (err) {
      setError('Impossible de générer le QR Code.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Charger le token initial
  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  // Auto-refresh toutes les 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchToken();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchToken]);

  // Compteur à rebours
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          fetchToken();
          return 300;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [fetchToken]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const isActive = subscriptionStatus === 'active';
  const isGrace = subscriptionStatus === 'grace_period';
  const isExpired = !isActive && !isGrace;

  return (
    <Card className="text-center">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-dark-300">QR Code de Validation</h3>
        <button
          onClick={fetchToken}
          className="text-dark-500 hover:text-brand-400 transition-colors p-1"
          title="Raffraîchir"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="relative inline-block">
        {/* QR Code */}
        <div className={`p-4 rounded-2xl bg-white inline-block ${isExpired ? 'opacity-30 grayscale' : ''} transition-all`}>
          {loading ? (
            <div className="w-48 h-48 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
            </div>
          ) : qrData?.qrToken ? (
            <QRCodeSVG
              value={qrData.qrToken}
              size={192}
              level="M"
              bgColor="#FFFFFF"
              fgColor="#0f172a"
              imageSettings={{
                src: '',
                height: 0,
                width: 0,
              }}
            />
          ) : (
            <div className="w-48 h-48 flex items-center justify-center bg-dark-100 rounded-xl">
              <QrCode className="w-12 h-12 text-dark-300" />
            </div>
          )}
        </div>

        {/* Overlay expiré */}
        {isExpired && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-dark-900/90 px-4 py-2 rounded-xl border border-rose-500/30">
              <ShieldOff className="w-6 h-6 text-rose-400 mx-auto mb-1" />
              <p className="text-xs font-semibold text-rose-400">Expiré</p>
            </div>
          </div>
        )}

        {/* Badge grâce */}
        {isGrace && (
          <div className="absolute -top-2 -right-2 bg-amber-500/20 border border-amber-500/30 rounded-full px-2 py-0.5">
            <span className="text-xs font-semibold text-amber-400">Grâce</span>
          </div>
        )}
      </div>

      {/* Statut et compteur */}
      <div className="mt-4 space-y-2">
        {isActive && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-medium text-emerald-400">Valide</span>
          </div>
        )}

        {qrData?.qrToken && !isExpired && (
          <div className="flex items-center justify-center gap-1.5 text-dark-500">
            <Clock className="w-3 h-3" />
            <span className="text-xs font-mono">
              Renouvellement dans {formatTime(countdown)}
            </span>
          </div>
        )}

        {qrData?.planName && (
          <p className="text-xs text-dark-400">{qrData.planName}</p>
        )}

        {error && (
          <p className="text-xs text-rose-400">{error}</p>
        )}
      </div>

      {/* Instructions */}
      <p className="text-xs text-dark-600 mt-3">
        Présentez ce code à l'entrée. Il se renouvelle automatiquement.
      </p>
    </Card>
  );
}
