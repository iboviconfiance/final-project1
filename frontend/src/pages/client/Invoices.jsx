import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { getInvoices } from '../../api/clientService';
import apiClient from '../../api/apiClient';
import {
  FileText, Download, Loader2, CheckCircle2, Clock,
  XCircle, ChevronLeft, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Page Factures — Liste paginée avec téléchargement PDF
 */
export default function Invoices() {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => { loadInvoices(); }, [page]);

  async function loadInvoices() {
    setLoading(true);
    try {
      const res = await getInvoices({ page, limit: 10 });
      setInvoices(res.data.data?.invoices || []);
      setTotalPages(res.data.data?.totalPages || 1);
    } catch (err) {
      toast.error(err.customMessage || 'Erreur chargement factures.');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Téléchargement du reçu PDF via la route sécurisée.
   * Utilise apiClient pour que le JWT soit injecté automatiquement.
   */
  async function handleDownloadPdf(invoiceId) {
    setDownloading(invoiceId);
    try {
      const res = await apiClient.get(`/client/invoices/${invoiceId}/pdf`, {
        responseType: 'blob',
      });

      // Créer un lien de téléchargement
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `recu_${invoiceId.substring(0, 8)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Reçu téléchargé !');
    } catch (err) {
      toast.error('Impossible de télécharger le reçu.');
    } finally {
      setDownloading(null);
    }
  }

  const statusConfig = {
    success: {
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      label: 'Payé'
    },
    pending: {
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      label: 'En attente'
    },
    failed: {
      icon: XCircle,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
      label: 'Échoué'
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Mes factures</h1>
        <p className="text-dark-400 mt-1">Historique de vos paiements et reçus</p>
      </div>

      {invoices.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-300 font-medium">Aucune facture</p>
            <p className="text-dark-500 text-sm mt-1">Vos paiements apparaîtront ici</p>
          </div>
        </Card>
      ) : (
        <>
          {/* Liste des factures */}
          <div className="space-y-2">
            {invoices.map((inv) => {
              const sc = statusConfig[inv.status] || statusConfig.pending;
              const StatusIcon = sc.icon;

              return (
                <Card key={inv.id} className="!p-4">
                  <div className="flex items-center gap-3">
                    {/* Icône statut */}
                    <div className={`p-2 rounded-lg ${sc.bg} flex-shrink-0`}>
                      <StatusIcon className={`w-4 h-4 ${sc.color}`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-dark-200 truncate">
                        {inv.description || inv.planName || 'Paiement'}
                      </p>
                      <p className="text-xs text-dark-500 mt-0.5">
                        {new Date(inv.createdAt).toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'long', year: 'numeric'
                        })}
                        {inv.method && ` • ${inv.method === 'mtn_momo' ? 'MTN MoMo' : 'Airtel Money'}`}
                      </p>
                    </div>

                    {/* Montant + badge */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-white">{(inv.amount || 0).toLocaleString()} XAF</p>
                      <span className={`text-xs ${sc.color}`}>{sc.label}</span>
                    </div>

                    {/* Bouton PDF */}
                    {inv.status === 'success' && (
                      <button
                        onClick={() => handleDownloadPdf(inv.id)}
                        disabled={downloading === inv.id}
                        className="p-2 rounded-lg text-dark-400 hover:text-brand-400 hover:bg-brand-500/10 transition-all disabled:opacity-50 flex-shrink-0"
                        title="Télécharger le reçu"
                      >
                        {downloading === inv.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-800 transition-all disabled:opacity-30"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-dark-400">
                Page {page} sur {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-800 transition-all disabled:opacity-30"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
