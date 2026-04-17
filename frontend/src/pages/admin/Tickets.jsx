import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { getTickets, respondTicket } from '../../api/adminService';
import {
  TicketCheck, MessageSquare, Clock, CheckCircle2, AlertTriangle,
  Loader2, Search, Send, ChevronDown, ChevronUp
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Page Tickets Admin — Gestion des tickets de support de l'organisation
 */
export default function AdminTickets() {
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { loadTickets(); }, [filter]);

  async function loadTickets() {
    setLoading(true);
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const res = await getTickets(params);
      setTickets(res.data.data?.tickets || []);
    } catch (err) {
      toast.error(err.customMessage || 'Erreur chargement tickets.');
    } finally {
      setLoading(false);
    }
  }

  async function handleReply(ticketId) {
    if (!replyText.trim()) return toast.error('Message requis.');
    setSending(true);
    try {
      await respondTicket(ticketId, { message: replyText.trim() });
      toast.success('Réponse envoyée !');
      setReplyText('');
      setExpandedId(null);
      loadTickets();
    } catch (err) {
      toast.error(err.customMessage || 'Erreur envoi réponse.');
    } finally {
      setSending(false);
    }
  }

  const statusConfig = {
    open: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Ouvert' },
    in_progress: { icon: MessageSquare, color: 'text-brand-400', bg: 'bg-brand-500/10', label: 'En cours' },
    resolved: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Résolu' },
    closed: { icon: CheckCircle2, color: 'text-dark-500', bg: 'bg-dark-700', label: 'Fermé' },
  };

  const priorityColor = {
    low: 'text-dark-400',
    medium: 'text-amber-400',
    high: 'text-orange-400',
    critical: 'text-rose-400',
  };

  const filtered = tickets.filter(t =>
    t.subject?.toLowerCase().includes(search.toLowerCase()) ||
    t.user?.email?.toLowerCase().includes(search.toLowerCase())
  );

  const counts = {
    all: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Tickets de support</h1>
        <p className="text-dark-400 mt-1">Gérez les demandes de vos abonnés</p>
      </div>

      {/* Filtres rapides */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: 'Tous' },
          { key: 'open', label: 'Ouverts' },
          { key: 'in_progress', label: 'En cours' },
          { key: 'resolved', label: 'Résolus' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === f.key
                ? 'bg-brand-600 text-white'
                : 'bg-dark-800 text-dark-400 hover:bg-dark-700'
            }`}
          >
            {f.label} <span className="text-xs opacity-70">({counts[f.key] || 0})</span>
          </button>
        ))}
      </div>

      {/* Recherche */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
        <input
          type="text"
          placeholder="Rechercher par sujet ou email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-dark-800 border border-dark-700 text-dark-100 placeholder-dark-500 rounded-lg pl-10 pr-4 py-2.5 text-sm
            focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all"
        />
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <TicketCheck className="w-12 h-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-300 font-medium">Aucun ticket</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(ticket => {
            const sc = statusConfig[ticket.status] || statusConfig.open;
            const StatusIcon = sc.icon;
            const isExpanded = expandedId === ticket.id;

            return (
              <Card key={ticket.id} className="!p-0 overflow-hidden">
                {/* Header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-dark-800/30 transition-colors"
                >
                  <div className={`p-1.5 rounded-lg ${sc.bg}`}>
                    <StatusIcon className={`w-4 h-4 ${sc.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-dark-200 truncate">{ticket.subject}</p>
                      <span className={`text-xs font-semibold ${priorityColor[ticket.priority]}`}>
                        {ticket.priority}
                      </span>
                    </div>
                    <p className="text-xs text-dark-500 mt-0.5">
                      {ticket.user?.email || 'Utilisateur'} • {new Date(ticket.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${sc.bg} ${sc.color}`}>{sc.label}</span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-dark-500" /> : <ChevronDown className="w-4 h-4 text-dark-500" />}
                </button>

                {/* Body expansé */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-dark-700/50 animate-fade-in">
                    {/* Message original */}
                    <div className="mt-3 p-3 rounded-lg bg-dark-800/50">
                      <p className="text-xs text-dark-500 mb-1">Message du client</p>
                      <p className="text-sm text-dark-200 whitespace-pre-wrap">{ticket.message}</p>
                    </div>

                    {/* Réponses existantes */}
                    {ticket.responses?.map((resp, i) => (
                      <div key={i} className="mt-2 p-3 rounded-lg bg-brand-500/5 border-l-2 border-brand-500">
                        <p className="text-xs text-brand-400 mb-1">{resp.by} • {new Date(resp.at).toLocaleDateString('fr-FR')}</p>
                        <p className="text-sm text-dark-200">{resp.message}</p>
                      </div>
                    ))}

                    {/* Formulaire de réponse */}
                    {ticket.status !== 'closed' && (
                      <div className="mt-3 flex gap-2">
                        <textarea
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          placeholder="Votre réponse..."
                          rows={2}
                          className="flex-1 bg-dark-800 border border-dark-600 text-dark-100 placeholder-dark-500 rounded-lg px-3 py-2 text-sm resize-none
                            focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all"
                        />
                        <Button
                          icon={Send}
                          loading={sending}
                          onClick={() => handleReply(ticket.id)}
                          className="self-end"
                        >
                          Répondre
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
