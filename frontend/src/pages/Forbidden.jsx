import { Link } from 'react-router-dom';
import { ShieldX, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Page 403 — Accès Interdit
 */
export default function Forbidden() {
  const { getDefaultPath, role } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900 px-4">
      <div className="text-center animate-fade-in max-w-md">
        {/* Icône */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-rose-500/10 border border-rose-500/30 mb-6">
          <ShieldX className="w-10 h-10 text-rose-400" />
        </div>

        {/* Code */}
        <h1 className="text-6xl font-bold text-dark-300 mb-2">403</h1>

        {/* Message */}
        <h2 className="text-xl font-semibold text-dark-100 mb-3">
          Accès interdit
        </h2>
        <p className="text-dark-400 mb-8 leading-relaxed">
          Vous n'avez pas les permissions nécessaires pour accéder à cette page.
          Contactez votre administrateur si vous pensez qu'il s'agit d'une erreur.
        </p>

        {/* Bouton retour */}
        <Link
          to={getDefaultPath(role)}
          className="inline-flex items-center gap-2 px-6 py-3 bg-dark-800 hover:bg-dark-700 text-dark-200 border border-dark-600 rounded-lg transition-all duration-200 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au dashboard
        </Link>
      </div>
    </div>
  );
}
