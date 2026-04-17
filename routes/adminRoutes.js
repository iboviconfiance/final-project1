const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const templateController = require('../controllers/templateController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { checkPermission } = require('../middlewares/roleMiddleware');

/**
 * ============================================================
 * ROUTES ADMIN — Dashboard Organisation
 * ============================================================
 * 
 * PROTECTION :
 * 1. authMiddleware : JWT valide → req.user
 * 2. checkPermission : RBAC granulaire par action
 * 
 * Toutes les données sont automatiquement scopées
 * à l'organizationId du user connecté.
 */

router.use(authMiddleware);

// ── DASHBOARD STATS ────────────────────────────────────────
// Accessible par : admin, manager, accountant (view_reports)
router.get('/stats', checkPermission('view_reports'), adminController.getDashboardStats);

// ── EXPORT CSV ─────────────────────────────────────────────
// Accessible par : admin, accountant (export_data)
router.get('/export/transactions', checkPermission('export_data'), adminController.exportTransactionsCSV);

// ── GESTION DES MEMBRES ────────────────────────────────────
// Lister les membres : admin, manager, staff, accountant (view_users)
router.get('/members', checkPermission('view_users'), adminController.listMembers);

// Ajouter un membre : admin, manager, staff (create_user)
router.post('/members', checkPermission('create_user'), adminController.addMember);

// Changer le rôle d'un membre : admin uniquement (manage_roles)
router.put('/members/:id/role', checkPermission('manage_roles'), adminController.changeRole);

// ── TEMPLATES DE NOTIFICATION ──────────────────────────────
// Personnaliser les messages de relance SMS/Email (texte brut)
// Accessible par : admin uniquement (customize_templates)
router.get('/templates', checkPermission('customize_templates'), templateController.listTemplates);
router.put('/templates/:templateName', checkPermission('customize_templates'), templateController.updateTemplate);
router.post('/templates/:templateName/preview', checkPermission('customize_templates'), templateController.previewTemplate);
router.post('/templates/:templateName/reset', checkPermission('customize_templates'), templateController.resetTemplate);

module.exports = router;
