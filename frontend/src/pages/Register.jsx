import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { Mail, Lock, Building2, UserPlus, Zap, Tag } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Page Register — Inscription d'une nouvelle organisation
 */
export default function Register() {
  const { isAuthenticated, register, getDefaultPath, role } = useAuth();
  const [form, setForm] = useState({
    orgName: '',
    adminEmail: '',
    password: '',
    confirmPassword: '',
    referralCode: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  if (isAuthenticated) {
    return <Navigate to={getDefaultPath(role)} replace />;
  }

  function handleChange(field) {
    return (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  function validate() {
    const newErrors = {};
    if (!form.orgName.trim() || form.orgName.trim().length < 2) {
      newErrors.orgName = 'Le nom doit contenir au moins 2 caractères.';
    }
    if (!form.adminEmail.trim()) {
      newErrors.adminEmail = 'L\'email est requis.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adminEmail)) {
      newErrors.adminEmail = 'Format d\'email invalide.';
    }
    if (!form.password) {
      newErrors.password = 'Le mot de passe est requis.';
    } else if (form.password.length < 8) {
      newErrors.password = 'Minimum 8 caractères.';
    }
    if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = 'Les mots de passe ne correspondent pas.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;

    setLoading(true);
    try {
      await register({
        orgName: form.orgName.trim(),
        adminEmail: form.adminEmail.trim(),
        password: form.password,
        referralCode: form.referralCode.trim() || undefined,
      });
      toast.success('Organisation créée avec succès !');
    } catch (err) {
      setServerError(err.customMessage || err.response?.data?.error || 'Erreur lors de l\'inscription.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950 px-4 py-8">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600/20 border border-brand-500/30 mb-4">
            <Zap className="w-7 h-7 text-brand-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">SubFlow</h1>
          <p className="text-dark-400 mt-1 text-sm">Créez votre espace de gestion</p>
        </div>

        <div className="glass-card p-8">
          <h2 className="text-lg font-semibold text-dark-100 mb-6">Nouvelle organisation</h2>

          {serverError && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm animate-fade-in">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nom de l'organisation"
              icon={Building2}
              placeholder="Ma Salle de Sport"
              value={form.orgName}
              onChange={handleChange('orgName')}
              error={errors.orgName}
              autoComplete="organization"
            />

            <Input
              label="Email administrateur"
              type="email"
              icon={Mail}
              placeholder="admin@exemple.com"
              value={form.adminEmail}
              onChange={handleChange('adminEmail')}
              error={errors.adminEmail}
              autoComplete="email"
            />

            <Input
              label="Mot de passe"
              type="password"
              icon={Lock}
              placeholder="Minimum 8 caractères"
              value={form.password}
              onChange={handleChange('password')}
              error={errors.password}
              autoComplete="new-password"
            />

            <Input
              label="Confirmer le mot de passe"
              type="password"
              icon={Lock}
              placeholder="••••••••"
              value={form.confirmPassword}
              onChange={handleChange('confirmPassword')}
              error={errors.confirmPassword}
              autoComplete="new-password"
            />

            <Input
              label="Code de parrainage (optionnel)"
              icon={Tag}
              placeholder="ABC123DEF456"
              value={form.referralCode}
              onChange={handleChange('referralCode')}
            />

            <Button type="submit" loading={loading} icon={UserPlus} className="w-full" size="lg">
              Créer mon organisation
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-dark-500 text-sm">
              Déjà un compte ?{' '}
              <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
                Se connecter
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-dark-600 text-xs mt-6">
          © {new Date().getFullYear()} SubFlow — Tous droits réservés.
        </p>
      </div>
    </div>
  );
}
