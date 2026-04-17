import { Link } from 'react-router-dom';
import { FileQuestion, Home } from 'lucide-react';

/**
 * Page 404 — Page non trouvée
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900 px-4">
      <div className="text-center animate-fade-in max-w-md">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-brand-500/10 border border-brand-500/30 mb-6">
          <FileQuestion className="w-10 h-10 text-brand-400" />
        </div>

        <h1 className="text-6xl font-bold text-dark-300 mb-2">404</h1>

        <h2 className="text-xl font-semibold text-dark-100 mb-3">
          Page introuvable
        </h2>
        <p className="text-dark-400 mb-8">
          La page que vous cherchez n'existe pas ou a été déplacée.
        </p>

        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-all duration-200 font-medium"
        >
          <Home className="w-4 h-4" />
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}
