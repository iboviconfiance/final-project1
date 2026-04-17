import { useState } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { exportTransactions } from '../../api/adminService';
import { FileText, Download, Calendar, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Page Export — Téléchargement CSV des transactions
 */
export default function Export() {
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState('');

  async function handleExport() {
    setLoading(true);
    try {
      const params = {};
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      if (status) params.status = status;

      const res = await exportTransactions(params);

      // Télécharger le fichier blob
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Export téléchargé !');
    } catch (err) {
      toast.error(err.customMessage || 'Erreur export.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Exports</h1>
        <p className="text-dark-400 mt-1">Téléchargez vos données au format CSV</p>
      </div>

      {/* Export transactions */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/20">
            <FileText className="w-6 h-6 text-brand-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Export des transactions</h3>
            <p className="text-xs text-dark-400">Toutes les transactions de votre organisation</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-dark-300">Date de début</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="w-full bg-dark-800 border border-dark-600 text-dark-100 rounded-lg pl-10 pr-4 py-2.5 text-sm
                    focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-dark-300">Date de fin</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="w-full bg-dark-800 border border-dark-600 text-dark-100 rounded-lg pl-10 pr-4 py-2.5 text-sm
                    focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-dark-300">Statut de transaction</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full bg-dark-800 border border-dark-600 text-dark-100 rounded-lg px-4 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all"
            >
              <option value="">Tous les statuts</option>
              <option value="success">Confirmés</option>
              <option value="pending">En attente</option>
              <option value="failed">Échoués</option>
            </select>
          </div>

          <Button icon={Download} loading={loading} onClick={handleExport} size="lg">
            Télécharger le CSV
          </Button>
        </div>
      </Card>

      {/* Info */}
      <Card className="!bg-dark-800/30">
        <h3 className="text-sm font-semibold text-dark-300 mb-2">Format du fichier</h3>
        <p className="text-xs text-dark-500">
          Le fichier CSV inclut : ID transaction, Date, Montant, Devise, Statut, Méthode de paiement,
          Email abonné, Nom du plan. Compatible Excel et Google Sheets.
        </p>
      </Card>
    </div>
  );
}
