import { useAuth } from '../context/AuthContext';
import Forbidden from '../pages/Forbidden';

/**
 * RoleGuard — Vérifie le rôle de l'utilisateur.
 * Si le rôle ne correspond pas → affiche la page 403 (pas de redirect).
 * 
 * Usage :
 *   <RoleGuard allowedRoles={['admin', 'superadmin']}>
 *     <AdminDashboard />
 *   </RoleGuard>
 */
export default function RoleGuard({ allowedRoles = [], children }) {
  const { role } = useAuth();

  if (!allowedRoles.includes(role)) {
    return <Forbidden />;
  }

  return children;
}
