import { useState, useEffect } from 'react';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listOrganizations, registerClient } from '../api/authService';
import { getSystemMode } from '../api/systemService';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { Mail, Lock, User, Phone, Zap, UserPlus, Search, Building2, Tag, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Page d'inscription Client (Abonné)
 * 
 * Supporte 2 modes :
 * - Option A (Plateforme) : Le client choisit dans la liste des organisations
 * - Option B (Licence)    : L'organisation est pré-sélectionnée automatiquement
 * 
 * SÉCURITÉ :
 * - Le rôle est FORCÉ à "user" côté backend
 * - Validation UUID de l'organisation côté frontend
 * - L'organisation doit être active
 */
export default function ClientRegister() {
  const { isAuthenticated, getDefaultPath, role } = useAuth();
  const [searchParams] = useSearchParams();

  // Si un orgId est passé en URL (lien de l'admin), on le pré-sélectionne
  const preselectedOrg = searchParams.get('org') || '';

  const [mode, setMode] = useState(null); // 'platform' ou 'license'
  const [step, setStep] = useState(preselectedOrg ? 2 : 1);
  const [organizations, setOrganizations] = useState([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
    referralCode: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  // Rediriger si déjà connecté
  if (isAuthenticated) {
    return <Navigate to={getDefaultPath(role)} replace />;
  }

  // Charger le mode système + organisations
  useEffect(() => {
    loadSystemAndOrgs();
  }, []);

  async function loadSystemAndOrgs() {
    try {
      // 1. Détecter le mode (Platform vs Licence)
      const modeRes = await getSystemMode();
      const sysData = modeRes.data.data;
      setMode(sysData.mode);

      if (sysData.mode === 'license' && sysData.organization) {
        // Mode Licence (Option B) — organisation pré-sélectionnée
        setSelectedOrg(sysData.organization);
        setStep(2);
        setLoadingOrgs(false);
        return;
      }

      // 2. Mode Plateforme (Option A) — charger la liste des organisations
      const orgs = await listOrganizations();
      setOrganizations(orgs);

      // Si un orgId est pré-sélectionné via l'URL
      if (preselectedOrg) {
        const found = orgs.find(o => o.id === preselectedOrg || o.slug === preselectedOrg);
        if (found) {
          setSelectedOrg(found);
          setStep(2);
        }
      }
    } catch (err) {
      toast.error('Impossible de charger les organisations.');
    } finally {
      setLoadingOrgs(false);
    }
  }

  function selectOrganization(org) {
    setSelectedOrg(org);
    setStep(2);
  }

  function handleChange(field) {
    return (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  function validate() {
    const newErrors = {};
    if (!form.email.trim()) newErrors.email = 'L\'email est requis.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = 'Email invalide.';
    if (!form.password) newErrors.password = 'Le mot de passe est requis.';
    else if (form.password.length < 8) newErrors.password = 'Minimum 8 caractères.';
    if (form.password !== form.confirmPassword) newErrors.confirmPassword = 'Les mots de passe ne correspondent pas.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError('');
    if (!validate() || !selectedOrg) return;

    // Validation UUID côté frontend
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(selectedOrg.id)) {
      setServerError('Organisation invalide. Veuillez réessayer.');
      return;
    }
    setLoading(true);
    try {
      const result = await registerClient({
        email: form.email.trim(),
        password: form.password,
        organizationId: selectedOrg.id,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        referralCode: form.referralCode.trim(),
      });

      // Stocker les infos dans le contexte Auth
      localStorage.setItem('sf_user', JSON.stringify(result.user));
      localStorage.setItem('sf_org', JSON.stringify(result.organization));

      toast.success(`Bienvenue chez ${result.organization.name} !`);
      // Forcer un reload pour que AuthContext re-lise le localStorage
      window.location.href = '/dashboard';
    } catch (err) {
      setServerError(err.customMessage || err.response?.data?.error || 'Erreur lors de l\'inscription.');
    } finally {
      setLoading(false);
    }
  }

  // Filtrer les organisations par la recherche
  const filteredOrgs = organizations.filter(org =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-dark-950 px-4 py-8">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 -left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 -right-1/4 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-lg mx-auto animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 mb-4">
            <Zap className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Rejoindre SubFlow</h1>
          <p className="text-dark-400 mt-1 text-sm">Inscrivez-vous comme abonné</p>
        </div>

        {/* ──────── ÉTAPE 1 : Choix de l'organisation ──────── */}
        {step === 1 && (
          <div className="space-y-4">
            <Card>
              <h2 className="text-lg font-semibold text-dark-100 mb-2">
                Choisissez votre organisation
              </h2>
              <p className="text-dark-400 text-sm mb-4">
                Où souhaitez-vous vous abonner ?
              </p>

              {/* Barre de recherche */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                <input
                  type="text"
                  placeholder="Rechercher une organisation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-dark-800 border border-dark-600 text-dark-100 placeholder-dark-500 rounded-lg pl-10 pr-4 py-2.5 text-sm
                    focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all"
                />
              </div>

              {/* Liste des organisations */}
              {loadingOrgs ? (
                <div className="text-center py-8">
                  <div className="w-6 h-6 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto" />
                  <p className="text-dark-500 text-sm mt-3">Chargement...</p>
                </div>
              ) : filteredOrgs.length === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="w-10 h-10 text-dark-600 mx-auto mb-2" />
                  <p className="text-dark-400 text-sm">
                    {searchQuery ? 'Aucune organisation trouvée.' : 'Aucune organisation disponible.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {filteredOrgs.map(org => (
                    <button
                      key={org.id}
                      onClick={() => selectOrganization(org)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg bg-dark-800/50 border border-dark-700/50
                        hover:bg-dark-700/50 hover:border-brand-500/30 transition-all duration-200 text-left group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center flex-shrink-0
                        group-hover:bg-brand-500/20 transition-colors">
                        <Building2 className="w-5 h-5 text-brand-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-dark-200 group-hover:text-white transition-colors truncate">
                          {org.name}
                        </p>
                        <p className="text-xs text-dark-500">{org.slug}</p>
                      </div>
                      <span className="text-xs text-dark-500 group-hover:text-brand-400 transition-colors">
                        Rejoindre →
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            {/* Liens */}
            <div className="text-center space-y-2">
              <p className="text-dark-500 text-sm">
                Vous êtes un propriétaire d'entreprise ?{' '}
                <Link to="/register" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
                  Créer une organisation
                </Link>
              </p>
              <p className="text-dark-500 text-sm">
                Déjà un compte ?{' '}
                <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
                  Se connecter
                </Link>
              </p>
            </div>
          </div>
        )}

        {/* ──────── ÉTAPE 2 : Formulaire d'inscription ──────── */}
        {step === 2 && selectedOrg && (
          <div className="space-y-4">
            {/* Org sélectionnée */}
            <Card className="!p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{selectedOrg.name}</p>
                  <p className="text-xs text-dark-500">
                    {mode === 'license' ? 'Organisation dédiée' : 'Vous rejoignez cette organisation'}
                  </p>
                </div>
                {mode !== 'license' && (
                  <button
                    onClick={() => { setStep(1); setSelectedOrg(null); }}
                    className="text-xs text-dark-400 hover:text-brand-400 transition-colors"
                  >
                    Changer
                  </button>
                )}
                {mode === 'license' && (
                  <div className="flex items-center gap-1 text-xs text-emerald-400">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Vérifié</span>
                  </div>
                )}
              </div>
            </Card>

            {/* Formulaire */}
            <Card>
              <h2 className="text-lg font-semibold text-dark-100 mb-5">Vos informations</h2>

              {serverError && (
                <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm animate-fade-in">
                  {serverError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="Prénom" icon={User} placeholder="Jean"
                    value={form.firstName} onChange={handleChange('firstName')} />
                  <Input label="Nom" icon={User} placeholder="Mbemba"
                    value={form.lastName} onChange={handleChange('lastName')} />
                </div>

                <Input label="Email *" type="email" icon={Mail} placeholder="vous@email.com"
                  value={form.email} onChange={handleChange('email')} error={errors.email}
                  autoComplete="email" />

                <Input label="Téléphone" icon={Phone} placeholder="+242 06 XXX XXXX"
                  value={form.phone} onChange={handleChange('phone')} />

                <Input label="Mot de passe *" type="password" icon={Lock} placeholder="Minimum 8 caractères"
                  value={form.password} onChange={handleChange('password')} error={errors.password}
                  autoComplete="new-password" />

                <Input label="Confirmer le mot de passe *" type="password" icon={Lock} placeholder="••••••••"
                  value={form.confirmPassword} onChange={handleChange('confirmPassword')}
                  error={errors.confirmPassword} autoComplete="new-password" />

                <Input label="Code de parrainage (optionnel)" icon={Tag} placeholder="ABC123DEF456"
                  value={form.referralCode} onChange={handleChange('referralCode')} />

                <Button type="submit" loading={loading} icon={UserPlus} className="w-full" size="lg">
                  Créer mon compte
                </Button>
              </form>
            </Card>

            <div className="text-center">
              <p className="text-dark-500 text-sm">
                Déjà un compte ?{' '}
                <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
                  Se connecter
                </Link>
              </p>
            </div>
          </div>
        )}

        <p className="text-center text-dark-600 text-xs mt-6">
          © {new Date().getFullYear()} SubFlow — Tous droits réservés.
        </p>
      </div>
    </div>
  );
}
