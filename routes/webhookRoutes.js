const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const { webhookSecurityMiddleware } = require('../middlewares/webhookMiddleware');

/**
 * ============================================================
 * ROUTES WEBHOOK — Confirmation de paiement par les opérateurs
 * ============================================================
 * 
 * ⚠️  Ces routes ne sont PAS protégées par authMiddleware !
 *     Les webhooks viennent des serveurs des opérateurs (MTN, Airtel...),
 *     pas des utilisateurs. La sécurité est assurée par :
 *     - IP Whitelisting
 *     - Signature HMAC
 *     - Anti-Replay (timestamp)
 *     - Idempotence (webhookId unique)
 * 
 * URL appelée par les opérateurs :
 *   POST https://votre-domaine.com/api/webhooks/mtn-congo
 *   POST https://votre-domaine.com/api/webhooks/airtel-congo
 *   POST https://votre-domaine.com/api/webhooks/aggregator
 *   POST https://votre-domaine.com/api/webhooks/mock
 */

// [POST] /api/webhooks/:provider — Réception d'une notification de paiement
// Le :provider dans l'URL détermine quel driver vérifie la signature
router.post(
  '/:provider',
  webhookSecurityMiddleware,       // Couches 1-3 : IP + HMAC + Anti-Replay
  webhookController.confirmPayment // Couche 4 : Idempotence + Activation
);

module.exports = router;
