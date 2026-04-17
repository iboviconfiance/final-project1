import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { Mail, Lock, LogIn, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Page de Login — Enterprise Dark Design
 * 
 * Sécurité :
 * - Anti-double-submit (bouton désactivé pendant le chargement)
 * - Messages d'erreur vagues (pas de fuite d'info)
 * - Sanitization des inputs via le composant Input
 */
export default function Login() {
  const { isAuthenticated, login, getDefaultPath, role } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  // Si déjà connecté, rediriger vers le dashboard
  if (isAuthenticated) {
    return <Navigate to={getDefaultPath(role)} replace />;
  }

  // Validation côté client
  function validate() {
    const newErrors = {};
    if (!email.trim()) {
      newErrors.email = 'L\'email est requis.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Format d\'email invalide.';
    }
    if (!password) {
      newErrors.password = 'Le mot de passe est requis.';
    } else if (password.length < 4) {
      newErrors.password = 'Mot de passe trop court.';
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
      await login(email.trim(), password);
      toast.success('Connexion réussie !');
    } catch (err) {
      const message = err.customMessage || err.response?.data?.error || 'Une erreur est survenue.';
      setServerError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950 px-4 py-8">
      {/* Background gradient effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600/20 border border-brand-500/30 mb-4">
            <Zap className="w-7 h-7 text-brand-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            SubFlow
          </h1>
          <p className="text-dark-400 mt-1 text-sm">
            Plateforme de gestion d'abonnements
          </p>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          <h2 className="text-lg font-semibold text-dark-100 mb-6">
            Connexion
          </h2>

          {/* Erreur serveur */}
          {serverError && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm animate-fade-in">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Adresse email"
              type="email"
              icon={Mail}
              placeholder="vous@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              autoComplete="email"
              required
            />

            <Input
              label="Mot de passe"
              type="password"
              icon={Lock}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              autoComplete="current-password"
              required
            />

            <Button
              type="submit"
              loading={loading}
              icon={LogIn}
              className="w-full"
              size="lg"
            >
              Se connecter
            </Button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <p className="text-dark-500 text-sm">
              Vous êtes un abonné ?{' '}
              <Link
                to="/join"
                className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
              >
                S'inscrire comme client
              </Link>
            </p>
            <p className="text-dark-500 text-sm">
              Propriétaire d'entreprise ?{' '}
              <Link
                to="/register"
                className="text-brand-400 hover:text-brand-300 font-medium transition-colors"
              >
                Créer une organisation
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-dark-600 text-xs mt-6">
          © {new Date().getFullYear()} SubFlow — Tous droits réservés.
        </p>
      </div>
    </div>
  );
}
