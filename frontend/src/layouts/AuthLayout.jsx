/**
 * AuthLayout — Layout minimal pour les pages Login / Register
 */
export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-dark-950">
      {children}
    </div>
  );
}
