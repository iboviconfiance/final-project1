const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/deliveryController');

/**
 * ============================================================
 * ROUTES DE DELIVERY CALLBACKS — Pas d'authentification JWT
 * ============================================================
 * 
 * Ces routes reçoivent les confirmations de livraison des
 * providers de messagerie (SendGrid, Mailgun, Twilio, etc.).
 * 
 * ⚠️  Pas de authMiddleware car les requêtes viennent des
 *     serveurs des providers, pas des utilisateurs.
 *     La sécurité repose sur :
 *     - La validation des données reçues
 *     - Les IPs des providers (en production, ajouter IP whitelisting)
 *     - Le fait que les logs ne peuvent qu'être mis à jour
 *       sur les champs de livraison (hooks d'immutabilité)
 */

// [POST] Callback de livraison email (SendGrid/Mailgun Event Webhook)
router.post('/email', deliveryController.handleEmailDelivery);

// [POST] Callback de livraison SMS (Twilio/Africa's Talking DLR)
router.post('/sms', deliveryController.handleSmsDelivery);

module.exports = router;
