import { Loader2 } from 'lucide-react';

const variants = {
  primary: 'bg-brand-600 hover:bg-brand-700 text-white border-transparent shadow-lg shadow-brand-500/20',
  secondary: 'bg-dark-700 hover:bg-dark-600 text-dark-100 border-dark-600',
  danger: 'bg-rose-600 hover:bg-rose-700 text-white border-transparent shadow-lg shadow-rose-500/20',
  ghost: 'bg-transparent hover:bg-dark-800 text-dark-300 hover:text-dark-100 border-transparent',
  success: 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent shadow-lg shadow-emerald-500/20',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded-md gap-1.5',
  md: 'px-4 py-2.5 text-sm rounded-lg gap-2',
  lg: 'px-6 py-3 text-base rounded-lg gap-2.5',
};

/**
 * Button — Composant bouton universel
 * 
 * Props :
 *   variant : 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'
 *   size : 'sm' | 'md' | 'lg'
 *   loading : boolean (affiche un spinner et désactive le bouton)
 *   icon : composant Lucide (affiché à gauche)
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  className = '',
  type = 'button',
  ...props
}) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center font-semibold border transition-all duration-200
        focus-ring
        ${variants[variant]}
        ${sizes[size]}
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.98]'}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : Icon ? (
        <Icon className="w-4 h-4" />
      ) : null}
      {children}
    </button>
  );
}
