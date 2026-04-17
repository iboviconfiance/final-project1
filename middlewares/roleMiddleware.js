/**
 * ============================================================
 * RBAC Middleware — Contrôle d'Accès par Rôle Granulaire
 * ============================================================
 * 
 * RÔLES (du plus puissant au plus limité) :
 * - superadmin : Contrôle total (hors organisation)
 * - admin      : Tout dans son organisation
 * - manager    : Tout sauf supprimer l'org et gérer la facturation
 * - staff      : Vérifier les abonnés, créer des comptes
 * - accountant : Voir et exporter les transactions uniquement
 * - user       : Portail client (son propre compte)
 * 
 * UTILISATION :
 * router.delete('/users/:id', checkPermission('delete_user'), controller.delete);
 * → Seuls admin et manager peuvent supprimer un utilisateur
 * → staff et accountant reçoivent 403
 */

// ============================================================
// MATRICE DE PERMISSIONS
// ============================================================
const PERMISSIONS = {
  // ── UTILISATEURS ────────────────────────
  create_user:       ['superadmin', 'admin', 'manager', 'staff'],
  view_users:        ['superadmin', 'admin', 'manager', 'staff', 'accountant'],
  update_user:       ['superadmin', 'admin', 'manager'],
  delete_user:       ['superadmin', 'admin', 'manager'],

  // ── ABONNEMENTS ─────────────────────────
  check_subscription:['superadmin', 'admin', 'manager', 'staff'],
  create_subscription:['superadmin', 'admin', 'manager'],
  update_subscription:['superadmin', 'admin', 'manager'],
  cancel_subscription:['superadmin', 'admin'],

  // ── PLANS ───────────────────────────────
  view_plans:        ['superadmin', 'admin', 'manager', 'staff', 'accountant'],
  create_plan:       ['superadmin', 'admin'],
  update_plan:       ['superadmin', 'admin'],
  delete_plan:       ['superadmin', 'admin'],

  // ── TRANSACTIONS ────────────────────────
  view_transactions: ['superadmin', 'admin', 'manager', 'accountant'],
  export_data:       ['superadmin', 'admin', 'accountant'],
  validate_payment:  ['superadmin', 'admin'],

  // ── RAPPORTS / STATS ────────────────────
  view_reports:      ['superadmin', 'admin', 'manager', 'accountant'],
  view_analytics:    ['superadmin', 'admin', 'manager'],

  // ── ORGANISATION ────────────────────────
  update_org:        ['superadmin', 'admin'],
  delete_org:        ['superadmin', 'admin'],
  manage_billing:    ['superadmin', 'admin'],
  manage_roles:      ['superadmin', 'admin'],

  // ── TICKETS / SUPPORT ───────────────────
  create_ticket:     ['superadmin', 'admin', 'manager', 'staff', 'accountant', 'user'],
  view_tickets:      ['superadmin', 'admin', 'manager'],
  respond_ticket:    ['superadmin', 'admin', 'manager'],
  close_ticket:      ['superadmin', 'admin'],
  escalate_ticket:   ['superadmin', 'admin', 'manager'],

  // ── UPLOADS ─────────────────────────────
  upload_files:      ['superadmin', 'admin', 'manager'],
  delete_files:      ['superadmin', 'admin'],

  // ── NOTIFICATIONS ───────────────────────
  send_notification: ['superadmin', 'admin'],
  customize_templates:['superadmin', 'admin'],

  // ── MARKETING / COUPONS ─────────────────
  manage_coupons:    ['superadmin', 'admin'],
  view_referrals:    ['superadmin', 'admin', 'manager'],

  // ── SYSTÈME ─────────────────────────────
  impersonate:       ['superadmin'],
  view_audit_logs:   ['superadmin', 'admin'],
  manage_system:     ['superadmin'],
  verify_access:     ['superadmin', 'admin', 'manager', 'staff'],
};

/**
 * Middleware de vérification de permission.
 * 
 * @param {string} action - L'action requise (ex: 'delete_user')
 * @returns {function} Express middleware
 * 
 * Exemple :
 * router.delete('/plans/:id', checkPermission('delete_plan'), controller.deletePlan);
 */
function checkPermission(action) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentification requise.' });
    }

    const userRole = req.user.role;
    const allowedRoles = PERMISSIONS[action];

    if (!allowedRoles) {
      console.error(`⚠️ RBAC: Permission inconnue: "${action}"`);
      return res.status(500).json({ error: 'Erreur interne de configuration des permissions.' });
    }

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Permission refusée.',
        requiredPermission: action,
        yourRole: userRole
      });
    }

    next();
  };
}

/**
 * Vérifie si un rôle a une permission donnée (sans middleware).
 */
function hasPermission(role, action) {
  const allowedRoles = PERMISSIONS[action];
  if (!allowedRoles) return false;
  return allowedRoles.includes(role);
}

/**
 * Retourne toutes les permissions d'un rôle.
 */
function getRolePermissions(role) {
  const perms = {};
  for (const [action, roles] of Object.entries(PERMISSIONS)) {
    perms[action] = roles.includes(role);
  }
  return perms;
}

module.exports = { checkPermission, hasPermission, getRolePermissions, PERMISSIONS };
