import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { savePaymentMethod, getPaymentMethod, deletePaymentMethod } from '../../api/clientService';
import { Wallet, Phone, Save, Trash2, Loader2, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Page Paiement Rapide — Sauvegarde du numéro MoMo chiffré
 */
export default function PaymentMethod() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [method, setMethod] = useState(null);
  const [phone, setPhone] = useState('');
  const [provider, setProvider] = useState('mtn');

  useEffect(() => { loadMethod(); }, []);

  async function loadMethod() {
    try {
      const res = await getPaymentMethod();
      setMethod(res.data.data.paymentMethod);
    } catch (err) {
      toast.error(err.customMessage || 'Erreur chargement.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!phone.trim()) return toast.error('Numéro requis.');
    setSaving(true);
    try {
      const res = await savePaymentMethod({ phoneNumber: phone.trim(), provider });
      setMethod(res.data.data.paymentMethod);
      setPhone('');
      toast.success('Numéro sauvegardé et chiffré !');
    } catch (err) {
      toast.error(err.customMessage || 'Erreur sauvegarde.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Supprimer le numéro sauvegardé ?')) return;
    try {
      await deletePaymentMethod();
      setMethod(null);
      toast.success('Numéro supprimé.');
    } catch (err) {
      toast.error(err.customMessage || 'Erreur suppression.');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-white">Paiement rapide</h1>
        <p className="text-dark-400 mt-1">Sauvegardez votre numéro MoMo pour payer plus vite</p>
      </div>

      {/* Numéro sauvegardé */}
      {method ? (
        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-dark-400">Numéro enregistré</p>
              <p className="text-xl font-bold text-white font-mono tracking-wider">
                {method.maskedNumber}
              </p>
              <p className="text-xs text-dark-500 mt-0.5">
                {method.provider?.toUpperCase()} • Chiffré AES-256-GCM
                {method.savedAt && ` • ${new Date(method.savedAt).toLocaleDateString('fr-FR')}`}
              </p>
            </div>
            <Button variant="danger" size="sm" icon={Trash2} onClick={handleDelete}>
              Supprimer
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="!bg-dark-800/30 border-dashed">
          <div className="text-center py-4">
            <Wallet className="w-10 h-10 text-dark-600 mx-auto mb-2" />
            <p className="text-dark-400 text-sm">Aucun numéro sauvegardé</p>
          </div>
        </Card>
      )}

      {/* Formulaire */}
      <Card>
        <h3 className="text-sm font-semibold text-dark-300 mb-4">
          {method ? 'Remplacer le numéro' : 'Ajouter un numéro MoMo'}
        </h3>

        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Numéro Mobile Money"
            icon={Phone}
            placeholder="+242 06 XXX XXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-dark-300">Opérateur</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full bg-dark-800 border border-dark-600 text-dark-100 rounded-lg px-4 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all"
            >
              <option value="mtn">MTN Mobile Money</option>
              <option value="airtel">Airtel Money</option>
              <option value="other">Autre</option>
            </select>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-brand-500/5 border border-brand-500/20">
            <ShieldCheck className="w-4 h-4 text-brand-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-dark-400">
              Votre numéro est chiffré avec AES-256-GCM avant d'être stocké. 
              Même en cas de fuite de données, il est illisible.
            </p>
          </div>

          <Button type="submit" loading={saving} icon={Save}>
            Sauvegarder
          </Button>
        </form>
      </Card>
    </div>
  );
}
