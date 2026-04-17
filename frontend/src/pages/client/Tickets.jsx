import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { createTicket, getMyTickets } from '../../api/clientService';
import { HelpCircle, Send, Loader2, MessageSquare, Clock, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Page Support — Création et suivi des tickets
 */
export default function Tickets() {
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ subject: '', message: '', priority: 'medium' });

  useEffect(() => { loadTickets(); }, []);

  async function loadTickets() {
    try {
      const res = await getMyTickets();
      setTickets(res.data.data?.tickets || []);
    } catch (err) {
      // Silencieux si pas encore de tickets
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) {
      return toast.error('Sujet et message requis.');
    }
    setSending(true);
    try {
      await createTicket(form);
      toast.success('Ticket créé !');
      setForm({ subject: '', message: '', priority: 'medium' });
      setShowForm(false);
      loadTickets();
    } catch (err) {
      toast.error(err.customMessage || 'Erreur création ticket.');
    } finally {
      setSending(false);
    }
  }

  const priorityBadge = {
    low: 'bg-dark-700 text-dark-400',
    medium: 'bg-amber-500/10 text-amber-400',
    high: 'bg-rose-500/10 text-rose-400',
    critical: 'bg-rose-500/20 text-rose-300',
  };

  const statusIcon = {
    open: <Clock className="w-4 h-4 text-amber-400" />,
    in_progress: <MessageSquare className="w-4 h-4 text-brand-400" />,
    resolved: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    closed: <CheckCircle2 className="w-4 h-4 text-dark-500" />,
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Support</h1>
          <p className="text-dark-400 mt-1">Signalez un problème à votre administrateur</p>
        </div>
        <Button
          icon={showForm ? undefined : HelpCircle}
          variant={showForm ? 'ghost' : 'primary'}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Annuler' : 'Nouveau ticket'}
        </Button>
      </div>

      {/* Formulaire de création */}
      {showForm && (
        <Card className="animate-slide-up">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Sujet"
              placeholder="Ex: Problème de paiement"
              value={form.subject}
              onChange={(e) => setForm(prev => ({ ...prev, subject: e.target.value }))}
            />

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-dark-300">Message</label>
              <textarea
                value={form.message}
                onChange={(e) => setForm(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Décrivez votre problème..."
                rows={4}
                className="w-full bg-dark-800 border border-dark-600 text-dark-100 placeholder-dark-500
                  rounded-lg px-4 py-2.5 text-sm resize-none
                  focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-dark-300">Priorité</label>
              <select
                value={form.priority}
                onChange={(e) => setForm(prev => ({ ...prev, priority: e.target.value }))}
                className="w-full bg-dark-800 border border-dark-600 text-dark-100 rounded-lg px-4 py-2.5 text-sm
                  focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all"
              >
                <option value="low">Basse</option>
                <option value="medium">Moyenne</option>
                <option value="high">Haute</option>
                <option value="critical">Critique</option>
              </select>
            </div>

            <Button type="submit" loading={sending} icon={Send}>Envoyer</Button>
          </form>
        </Card>
      )}

      {/* Liste des tickets */}
      {tickets.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <HelpCircle className="w-12 h-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-300 font-medium">Aucun ticket</p>
            <p className="text-dark-500 text-sm mt-1">Créez un ticket si vous avez besoin d'aide</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Card key={ticket.id} hover className="!p-4">
              <div className="flex items-start gap-3">
                {statusIcon[ticket.status] || statusIcon.open}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-dark-200">{ticket.subject}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${priorityBadge[ticket.priority]}`}>
                      {ticket.priority}
                    </span>
                  </div>
                  <p className="text-xs text-dark-500 mt-1">
                    #{ticket.id?.substring(0, 8)} • {new Date(ticket.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
