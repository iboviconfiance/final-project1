const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');
const pushService = require('../services/pushService');
const Joi = require('joi');

/**
 * ============================================================
 * ROUTES PUSH — Notifications Web Push
 * ============================================================
 * 
 * Le client récupère la clé VAPID publique, s'abonne,
 * et reçoit des notifications push sur son appareil.
 * 
 * FLOW CLIENT :
 * 1. GET /api/push/vapid-key              → Récupérer la clé publique
 * 2. navigator.serviceWorker.ready.then() → Enregistrer le SW
 * 3. registration.pushManager.subscribe() → Obtenir la subscription
 * 4. POST /api/push/subscribe             → Envoyer au serveur
 */

// ── SCHÉMA DE VALIDATION ────────────────────────────────

const subscribeSchema = Joi.object({
  endpoint: Joi.string().uri().required()
    .messages({ 'any.required': 'L\'endpoint push est requis.' }),
  keys: Joi.object({
    p256dh: Joi.string().required(),
    auth: Joi.string().required()
  }).required()
    .messages({ 'any.required': 'Les clés push (p256dh, auth) sont requises.' })
});

// ============================================================
// GET /api/push/vapid-key
// Clé publique VAPID (pas besoin d'auth — le client en a besoin avant login)
// ============================================================

router.get('/vapid-key', (req, res) => {
  const publicKey = pushService.getVapidPublicKey();

  if (!publicKey) {
    return res.status(503).json({
      error: 'Notifications push non configurées sur ce serveur.',
      hint: 'VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY manquants dans .env'
    });
  }

  res.status(200).json({
    message: 'Clé VAPID publique.',
    data: { publicKey }
  });
});

// ── Routes protégées ────────────────────────────────────
router.use(authMiddleware);

// ============================================================
// POST /api/push/subscribe
// Enregistrer un abonnement push
// ============================================================

router.post('/subscribe', async (req, res) => {
  const { error, value } = subscribeSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({ error: 'Erreur de validation.', details: error.details.map(d => d.message) });
  }

  try {
    const pushSub = await pushService.subscribe(
      req.user.id,
      req.user.organizationId,
      { endpoint: value.endpoint, keys: value.keys },
      req.headers['user-agent']
    );

    res.status(201).json({
      message: 'Notifications push activées.',
      data: { subscriptionId: pushSub.id }
    });
  } catch (err) {
    console.error('Erreur push subscribe:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// ============================================================
// DELETE /api/push/unsubscribe
// Désabonner l'appareil actuel
// ============================================================

router.delete('/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: 'L\'endpoint est requis.' });
    }

    const result = await pushService.unsubscribe(endpoint);

    res.status(200).json({
      message: result ? 'Notifications push désactivées.' : 'Abonnement introuvable.',
      data: { unsubscribed: result }
    });
  } catch (err) {
    console.error('Erreur push unsubscribe:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

module.exports = router;
