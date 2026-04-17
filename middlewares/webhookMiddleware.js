/**
 * ============================================================
 * Webhook Security Middleware
 * ============================================================
 * 
 * Défense en profondeur contre les attaques sur les webhooks :
 * 
 * COUCHE 1 — IP Whitelisting (dans provider.verifyWebhookSource)
 * COUCHE 2 — HMAC Signature (dans provider.validateSignature)
 * COUCHE 3 — Anti-Replay (timestamp < 5min dans PaymentManager)
 * COUCHE 4 — Idempotence (webhookId unique dans webhookController)
 * 
 * Ce middleware gère la couche de sécurité HTTP avant que le
 * contrôleur ne fasse le traitement métier.
 * 
 * PROTECTION ANTI-REPLAY :
 * 
 * Une attaque par rejeu (replay attack) consiste à intercepter
 * un webhook légitime et à le renvoyer plus tard pour obtenir
 * un double crédit. Nos défenses :
 * 
 * 1. TIMESTAMP : Le webhook doit avoir < 5 minutes d'âge
 *    → Un webhook intercepté et rejoué après 5 min est rejeté
 * 
 * 2. WEBHOOK_ID UNIQUE : Chaque notification du provider a un ID
 *    unique stocké en BDD avec contrainte UNIQUE
 *    → Impossible de traiter le même webhook deux fois
 * 
 * 3. HMAC : Sans la clé secrète, un attaquant ne peut pas
 *    modifier le timestamp pour contourner la protection
 *    → Le timestamp dans le body est protégé par la signature
 * 
 * 4. STATUS CHECK : Même si tout le reste échouait, le contrôleur
 *    vérifie que la transaction est en 'pending' avant mise à jour
 *    → Une transaction déjà 'success' ne sera jamais re-créditée
 */

const paymentManager = require('../services/payments/PaymentManager');

/**
 * Middleware de validation de webhook de paiement.
 * 
 * Injecté avant le webhookController dans la route :
 *   POST /api/webhooks/:provider
 * 
 * Effectue les vérifications de sécurité et attache les données
 * normalisées à req.webhookData si tout est valide.
 */
const webhookSecurityMiddleware = async (req, res, next) => {
  const { provider: providerName } = req.params;

  if (!providerName) {
    return res.status(400).json({ error: 'Provider non spécifié dans l\'URL.' });
  }

  try {
    // PaymentManager.processWebhook() effectue :
    // 1. Vérification IP source (COUCHE 1)
    // 2. Validation signature HMAC (COUCHE 2)
    // 3. Vérification anti-replay timestamp (COUCHE 3)
    // 4. Extraction des données normalisées
    const webhookData = await paymentManager.processWebhook(providerName, req);

    // Attacher les données validées à la requête
    req.webhookData = webhookData;
    req.providerName = providerName;

    next();
  } catch (error) {
    // Réponses de sécurité — volontairement vagues pour ne pas aider l'attaquant
    switch (error.message) {
      case 'SECURITY_IP_REJECTED':
        console.error(`🚫 ALERTE SÉCURITÉ: Webhook depuis IP non autorisée — Provider: ${providerName}, IP: ${req.ip}`);
        return res.status(403).json({ error: 'Forbidden.' });

      case 'SECURITY_SIGNATURE_INVALID':
        console.error(`🚫 ALERTE SÉCURITÉ: Signature HMAC invalide — Provider: ${providerName}`);
        return res.status(403).json({ error: 'Forbidden.' });

      case 'SECURITY_REPLAY_DETECTED':
        console.error(`🚫 ALERTE SÉCURITÉ: Tentative de replay détectée — Provider: ${providerName}`);
        return res.status(403).json({ error: 'Forbidden.' });

      default:
        console.error(`⚠️ Erreur webhook middleware (${providerName}):`, error.message);
        return res.status(400).json({ error: 'Bad Request.' });
    }
  }
};

module.exports = { webhookSecurityMiddleware };
