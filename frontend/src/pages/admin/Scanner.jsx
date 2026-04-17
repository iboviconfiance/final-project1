import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { verifyQrCode } from '../../api/systemService';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { QrCode, CheckCircle2, XCircle, RefreshCw, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Scanner() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null); // { valid: boolean, user: obj, subscription: obj, reason: str }
  const [loading, setLoading] = useState(false);
  let html5QrCode = useRef(null);

  // Audio Bip (Web Audio API)
  const playBeep = (type = 'success') => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      console.warn("Audio indisponible", e);
    }
  };

  const playVibration = (type = 'success') => {
    if (navigator.vibrate) {
      if (type === 'success') {
        navigator.vibrate([100]);
      } else {
        navigator.vibrate([200, 100, 200]);
      }
    }
  };

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    try {
      setResult(null);
      setScanning(true);
      
      // Demande l'autorisation pour l'audio en background (interaction utilisateur)
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) new AudioContext().resume();

      html5QrCode.current = new Html5Qrcode('qr-reader');
      await html5QrCode.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        handleScanSuccess,
        handleScanError
      );
    } catch (err) {
      console.error(err);
      toast.error("Impossible d'accéder à la caméra. Vérifiez vos autorisations et assurez-vous d'être en HTTPS ou localhost.");
      setScanning(false);
    }
  };

  const stopScanner = () => {
    if (html5QrCode.current && html5QrCode.current.isScanning) {
      html5QrCode.current.stop().then(() => {
        html5QrCode.current.clear();
      }).catch(err => console.error(err));
    }
    setScanning(false);
  };

  const handleScanSuccess = async (decodedText) => {
    if (loading) return; // Éviter les double scans
    stopScanner();
    setLoading(true);

    try {
      const res = await verifyQrCode(decodedText);
      const data = res.data.data;
      
      setResult(data);

      if (data.valid) {
        playBeep('success');
        playVibration('success');
      } else {
        playBeep('error');
        playVibration('error');
      }
    } catch (err) {
      console.error(err);
      toast.error('Erreur de validation réseau.');
      setResult({ valid: false, reason: 'Erreur réseau avec le serveur.' });
      playBeep('error');
      playVibration('error');
    } finally {
      setLoading(false);
    }
  };

  const handleScanError = (err) => {
    // Ignoré - s'exécute à chaque frame sans QR code visible
  };

  const resetScanner = () => {
    setResult(null);
    startScanner();
  };

  return (
    <div className="max-w-md mx-auto space-y-4 animate-fade-in pt-4 pb-20">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Scanner de Contrôle</h1>
        <p className="text-dark-400 mt-1">Utilisez la caméra pour valider les accès</p>
      </div>

      {loading && (
        <Card className="text-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-brand-500 mx-auto mb-3" />
          <p className="text-white font-medium">Vérification en cours...</p>
        </Card>
      )}

      {/* Interface Résultat */}
      {result && !loading && (
        <Card className={`text-center py-10 transition-colors duration-300 ${result.valid ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-rose-500/10 border-rose-500/50'}`}>
          {result.valid ? (
            <>
              <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-emerald-400">Accès Autorisé</h2>
              <div className="mt-4 p-4 bg-dark-900/50 rounded-lg mx-4">
                <p className="text-lg font-semibold text-white">{result.user?.name}</p>
                <p className="text-sm text-dark-300">{result.user?.email}</p>
                <div className="mt-2 text-xs font-medium px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded inline-block">
                  Abonnement : {result.subscription?.planName}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="w-20 h-20 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4 scale-110">
                <XCircle className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-rose-400">Accès Refusé</h2>
              <div className="mt-4 p-4 bg-dark-900/50 rounded-lg mx-4">
                <p className="text-red-400 font-medium">{result.reason}</p>
              </div>
            </>
          )}

          <Button className="mt-8 mx-auto" onClick={resetScanner} icon={QrCode}>
            Scanner un autre billet
          </Button>
        </Card>
      )}

      {/* Interface Scanner (Caméra) */}
      {!result && !loading && (
        <Card className="overflow-hidden p-2">
          {!scanning ? (
            <div className="py-12 text-center">
              <Smartphone className="w-12 h-12 text-dark-500 mx-auto mb-4" />
              <p className="text-dark-300 mb-6">La caméra va s'activer pour lire les codes QR.</p>
              <Button onClick={startScanner} icon={QrCode} className="mx-auto">
                Démarrer le Scanner
              </Button>
            </div>
          ) : (
            <div className="relative">
              <div id="qr-reader" className="w-full rounded-lg overflow-hidden bg-black min-h-[300px]"></div>
              <Button variant="ghost" onClick={stopScanner} className="absolute top-2 right-2 bg-black/50 hover:bg-black/80 backdrop-blur text-white">
                Fermer
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
