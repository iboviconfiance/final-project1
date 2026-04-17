const express = require('express');
const router = express.Router();
const subController = require('../controllers/subController');
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');

// ============================================================
// Toutes les routes ci-dessous nécessitent une authentification
// ============================================================
router.use(authMiddleware);

// ============================================================
// PLANS
// ============================================================

// [POST] /api/subscriptions/plans — Créer un plan (admin uniquement)
router.post('/plans', requireRole('admin'), subController.createPlan);

// [GET] /api/subscriptions/plans — Lister les plans de son organisation
router.get('/plans', subController.getPlans);

// ============================================================
// ABONNEMENTS
// ============================================================

// [POST] /api/subscriptions/subscribe — Souscrire à un plan
router.post('/subscribe', subController.subscribe);

// [GET] /api/subscriptions/status — Vérifier le statut de son abonnement
router.get('/status', subController.getStatus);

// [GET] /api/subscriptions/history — Historique des abonnements
router.get('/history', subController.getHistory);

module.exports = router;
