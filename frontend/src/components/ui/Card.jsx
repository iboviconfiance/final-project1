/**
 * Card — Conteneur glassmorphism avec variantes
 */
export default function Card({
  children,
  className = '',
  padding = 'md',
  hover = false,
  ...props
}) {
  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={`
        glass-card
        ${paddings[padding]}
        ${hover ? 'hover:border-dark-600 hover:shadow-lg hover:shadow-dark-950/50 transition-all duration-300' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
