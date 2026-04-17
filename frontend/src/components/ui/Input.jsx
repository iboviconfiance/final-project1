import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Sanitize une entrée utilisateur (supprime HTML).
 */
function sanitize(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

/**
 * Input — Champ de formulaire sécurisé avec label, erreur et icône
 * 
 * Props :
 *   label : string
 *   error : string (message d'erreur)
 *   icon : composant Lucide (affiché à gauche dans le champ)
 *   type : 'text' | 'email' | 'password' | etc.
 */
export default function Input({
  label,
  error,
  icon: Icon,
  type = 'text',
  className = '',
  onChange,
  id,
  ...props
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-') || undefined;

  const handleChange = (e) => {
    // Sanitize avant de remonter la valeur
    const sanitized = sanitize(e.target.value);
    e.target.value = sanitized;
    onChange?.(e);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-dark-300"
        >
          {label}
        </label>
      )}

      <div className="relative">
        {/* Icône gauche */}
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Icon className="w-4 h-4 text-dark-500" />
          </div>
        )}

        <input
          id={inputId}
          type={inputType}
          onChange={handleChange}
          className={`
            w-full bg-dark-800 border text-dark-100 placeholder-dark-500
            rounded-lg transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500
            ${Icon ? 'pl-10' : 'pl-4'} 
            ${isPassword ? 'pr-10' : 'pr-4'} 
            py-2.5 text-sm
            ${error ? 'border-rose-500/50' : 'border-dark-600 hover:border-dark-500'}
          `}
          {...props}
        />

        {/* Toggle mot de passe */}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-300 transition-colors"
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Message d'erreur */}
      {error && (
        <p className="text-xs text-rose-400 mt-1 animate-fade-in">
          {error}
        </p>
      )}
    </div>
  );
}
