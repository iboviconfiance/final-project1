const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { authMiddleware } = require('../middlewares/authMiddleware');

/**
 * ============================================================
 * ROUTES CLIENT — Portail Self-Service Abonné
 * ============================================================
 * 
 * PROTECTION : authMiddleware uniquement (tout user authentifié)
 * 
 * L'objectif est l'autonomie du client :
 * Moins il appelle l'admin, plus l'admin gagne de l'argent.
 */

router.use(authMiddleware);

// ── PROFIL ─────────────────────────────────────────────────
router.get('/profile', clientController.getProfile);
router.put('/profile', clientController.updateProfile);

// ── FACTURES ───────────────────────────────────────────────
router.get('/invoices', clientController.getInvoices);

// ── CONSOMMATION (pour graphique) ──────────────────────────
router.get('/consumption', clientController.getConsumption);

// ── PAIEMENT RAPIDE (MoMo chiffré) ────────────────────────
router.get('/payment-method', clientController.getPaymentMethod);
router.put('/payment-method', clientController.savePaymentMethod);
router.delete('/payment-method', clientController.deletePaymentMethod);

module.exports = router;
