const express = require('express');
const router = express.Router();
const superAdminController = require('../controllers/superAdminController');
const versionController = require('../controllers/versionController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { superAdminAuth } = require('../middlewares/superAdminAuth');

/**
 * ============================================================
 * ROUTES SUPER-ADMIN — "God Mode"
 * ============================================================
 * 
 * DOUBLE PROTECTION :
 * 1. authMiddleware : Vérifie le JWT et charge req.user
 * 2. superAdminAuth : Vérifie en BDD que role === 'superadmin'
 * 
 * Un admin d'organisation ne passe JAMAIS la couche 2.
 * → Impossible de tricher avec un JWT admin standard.
 * 
 * INDÉPENDANT des routes de monitoring (/api/v1/health)
 * → Aucun lien entre la clé monitoring et l'accès Super-Admin
 */

// Double protection sur toutes les routes
router.use(authMiddleware);
router.use(superAdminAuth);

// ── ORGANISATIONS ──────────────────────────────────────
router.get('/organizations', superAdminController.listOrganizations);
router.put('/organizations/:id/suspend', superAdminController.suspendOrganization);
router.put('/organizations/:id/activate', superAdminController.activateOrganization);

// ── STATISTIQUES ───────────────────────────────────────
router.get('/stats', superAdminController.getGlobalStats);

// ── PAIEMENTS ──────────────────────────────────────────
router.post('/transactions/:id/validate', superAdminController.manualPaymentValidation);

// ── CHURN / ANNULATION ─────────────────────────────────
router.post('/subscriptions/:id/cancel', superAdminController.cancelSubscription);

// ── LOGS D'AUDIT ───────────────────────────────────────
router.get('/audit-logs', superAdminController.getAuditLogs);

// ── IMPERSONATION (Shadowing) ──────────────────────────
// Sécurité : log IMPERSONATION_START obligatoire, JWT 1h max
router.post('/impersonate/:userId', superAdminController.impersonate);
router.post('/impersonate/end', superAdminController.endImpersonation);

// ── ANNONCES GLOBALES ──────────────────────────────────
router.post('/announcements', superAdminController.createAnnouncement);
router.get('/announcements', superAdminController.listAnnouncements);
router.put('/announcements/:id/deactivate', superAdminController.deactivateAnnouncement);

// ── GESTION DES VERSIONS (Option B) ───────────────────
// Panneau pour voir/mettre à jour les versions par organisation
router.get('/versions', versionController.listVersions);
router.put('/versions/:orgId', versionController.updateVersion);

// ── AFFILIÉS — Option C (BtoB) ────────────────────────
// Partenaires qui ramènent de nouvelles organisations
const affiliateController = require('../controllers/affiliateController');
router.get('/affiliates', affiliateController.listAffiliates);
router.post('/affiliates', affiliateController.createAffiliate);
router.put('/affiliates/:id', affiliateController.updateAffiliate);
router.get('/affiliates/:id/commissions', affiliateController.getCommissions);
router.post('/affiliates/:id/pay', affiliateController.markCommissionsPaid);

module.exports = router;
