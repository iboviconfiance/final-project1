import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { getPlans, createPlan } from '../../api/planService';
import { CreditCard, Plus, Loader2, Calendar, Hash, Tag, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Plans() {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  
  const [form, setForm] = useState({
    name: '',
    price: '',
    duration_days: '30',
    description: ''
  });

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    setLoading(true);
    try {
      const res = await getPlans();
      setPlans(res.data?.data?.plans || []);
    } catch (err) {
      toast.error('Erreur lors du chargement des offres.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name || !form.price || !form.duration_days) {
      return toast.error('Veuillez remplir les champs obligatoires.');
    }

    setCreating(true);
    try {
      await createPlan({
        name: form.name,
        price: parseFloat(form.price),
        duration_days: parseInt(form.duration_days),
        description: form.description
      });
      toast.success('Offre créée avec succès !');
      setShowCreate(false);
      setForm({ name: '', price: '', duration_days: '30', description: '' });
      loadPlans();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de la création de l\'offre.');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Vos Offres & Plans</h1>
        <p className="text-dark-400 mt-1">Gérez les abonnements disponibles pour vos clients.</p>
      </div>

      {/* Button Create */}
      <Button 
        onClick={() => setShowCreate(!showCreate)} 
        icon={showCreate ? ChevronDown : Plus} 
        variant={showCreate ? 'ghost' : 'primary'}
      >
        {showCreate ? 'Fermer' : 'Nouvelle offre'}
      </Button>

      {/* Create Form */}
      {showCreate && (
        <Card className="animate-fade-in border-l-4 border-l-brand-500">
          <h3 className="text-sm font-semibold text-dark-200 mb-4">Créer une nouvelle offre</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input 
                label="Nom de l'offre (ex: 1 Mois Premium) *" 
                icon={Tag} 
                placeholder="Basic, Premium, ..." 
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))} 
              />
              
              <Input 
                label="Prix (XAF) *" 
                icon={Hash} 
                type="number" 
                placeholder="10000"
                value={form.price} 
                onChange={e => setForm(p => ({ ...p, price: e.target.value }))} 
              />

              <Input 
                label="Durée en jours *" 
                icon={Calendar} 
                type="number" 
                placeholder="30"
                value={form.duration_days} 
                onChange={e => setForm(p => ({ ...p, duration_days: e.target.value }))} 
              />

              <Input 
                label="Description" 
                placeholder="Accès complet pour 30 jours"
                value={form.description} 
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))} 
              />
            </div>

            <Button type="submit" loading={creating} icon={Plus} className="w-full sm:w-auto">
              Créer le plan
            </Button>
          </form>
        </Card>
      )}

      {/* Plans List */}
      {plans.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <CreditCard className="w-12 h-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-300 font-medium">Aucune offre configurée.</p>
            <p className="text-dark-500 text-sm mt-1">Créez votre premier plan pour permettre à vos clients de s'abonner.</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(plan => (
            <Card key={plan.id} className="relative overflow-hidden group">
              {/* Highlight ribbon */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 to-brand-400"></div>
              
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-brand-400 transition-colors">
                      {plan.name}
                    </h3>
                    <p className="text-sm text-dark-400 mt-1">{plan.duration_days} Jours</p>
                  </div>
                  <div className="p-2 rounded-lg bg-dark-800">
                    <CreditCard className="w-5 h-5 text-brand-400" />
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-2xl font-black text-white">
                    {parseFloat(plan.price).toLocaleString()} <span className="text-sm font-medium text-dark-400">XAF</span>
                  </p>
                </div>

                {plan.description && (
                  <p className="text-sm text-dark-300 bg-dark-800/50 p-3 rounded-lg border border-dark-700">
                    {plan.description}
                  </p>
                )}
                
                <div className="mt-4 flex items-center justify-between text-xs text-dark-500">
                  <span>Créé le {new Date(plan.createdAt).toLocaleDateString('fr-FR')}</span>
                  {plan.is_active ? (
                    <span className="text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">Actif</span>
                  ) : (
                    <span className="text-rose-400 bg-rose-500/10 px-2 py-1 rounded">Inactif</span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
