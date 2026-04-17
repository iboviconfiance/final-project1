import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { getMembers, addMember, changeMemberRole } from '../../api/adminService';
import { Users, UserPlus, Mail, Shield, Loader2, Search } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Page Membres Admin — Gestion des utilisateurs de l'organisation
 */
export default function Members() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ email: '', password: '', role: 'user' });

  useEffect(() => { loadMembers(); }, []);

  async function loadMembers() {
    try {
      const res = await getMembers();
      setMembers(res.data.data?.members || []);
    } catch (err) {
      toast.error(err.customMessage || 'Erreur chargement membres.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.email || !form.password) return toast.error('Email et mot de passe requis.');
    setAdding(true);
    try {
      await addMember(form);
      toast.success('Membre ajouté !');
      setForm({ email: '', password: '', role: 'user' });
      setShowForm(false);
      loadMembers();
    } catch (err) {
      toast.error(err.customMessage || 'Erreur ajout membre.');
    } finally {
      setAdding(false);
    }
  }

  async function handleRoleChange(memberId, newRole) {
    try {
      await changeMemberRole(memberId, newRole);
      toast.success('Rôle modifié');
      loadMembers();
    } catch (err) {
      toast.error(err.customMessage || 'Erreur changement rôle.');
    }
  }

  const roleBadge = {
    admin: 'bg-brand-500/10 text-brand-400 border-brand-500/30',
    manager: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    staff: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    accountant: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    user: 'bg-dark-700 text-dark-400 border-dark-600',
  };

  const filtered = members.filter(m =>
    m.email?.toLowerCase().includes(search.toLowerCase()) ||
    m.firstName?.toLowerCase().includes(search.toLowerCase()) ||
    m.lastName?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Membres</h1>
          <p className="text-dark-400 mt-1">{members.length} membre(s) dans l'organisation</p>
        </div>
        <Button icon={UserPlus} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Annuler' : 'Ajouter'}
        </Button>
      </div>

      {/* Formulaire ajout */}
      {showForm && (
        <Card className="animate-slide-up">
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Email" type="email" icon={Mail} placeholder="nouveau@email.com"
                value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              <Input label="Mot de passe initial" type="password" placeholder="Min 8 caractères"
                value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-dark-300">Rôle</label>
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                className="w-full bg-dark-800 border border-dark-600 text-dark-100 rounded-lg px-4 py-2.5 text-sm
                  focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all">
                <option value="user">Abonné (user)</option>
                <option value="staff">Staff</option>
                <option value="accountant">Comptable</option>
                <option value="manager">Manager</option>
              </select>
            </div>
            <Button type="submit" loading={adding} icon={UserPlus}>Ajouter le membre</Button>
          </form>
        </Card>
      )}

      {/* Recherche */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
        <input
          type="text"
          placeholder="Rechercher un membre..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-dark-800 border border-dark-700 text-dark-100 placeholder-dark-500 rounded-lg pl-10 pr-4 py-2.5 text-sm
            focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all"
        />
      </div>

      {/* Liste des membres */}
      <div className="space-y-2">
        {filtered.map(member => (
          <Card key={member.id} className="!p-4">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-dark-700 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-dark-300">
                  {(member.firstName?.[0] || member.email[0]).toUpperCase()}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-dark-200 truncate">
                  {member.firstName && member.lastName
                    ? `${member.firstName} ${member.lastName}`
                    : member.email}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-dark-500 truncate">{member.email}</p>
                  {member.phone && <p className="text-xs text-dark-400">• {member.phone}</p>}
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex-shrink-0">
                {member.subscriptions && member.subscriptions.length > 0 ? (
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                    Actif
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium border bg-dark-700 text-dark-400 border-dark-600">
                    Inactif
                  </span>
                )}
              </div>

              {/* Badge rôle */}
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium border hidden sm:inline-block ${roleBadge[member.role] || roleBadge.user}`}>
                {member.role === 'user' ? 'Client' : member.role}
              </span>

              {/* Sélecteur de rôle */}
              <select
                value={member.role}
                onChange={e => handleRoleChange(member.id, e.target.value)}
                className="bg-dark-800 border border-dark-700 text-dark-300 rounded-lg px-2 py-1.5 text-xs
                  focus:outline-none focus:ring-1 focus:ring-brand-500/50 transition-all hidden sm:block"
              >
                <option value="user">user</option>
                <option value="staff">staff</option>
                <option value="accountant">accountant</option>
                <option value="manager">manager</option>
                <option value="admin">admin</option>
              </select>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
