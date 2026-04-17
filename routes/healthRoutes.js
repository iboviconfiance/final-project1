const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');
const { monitorAuth, healthRateLimiter } = require('../middlewares/monitorAuth');

/**
 * ============================================================
 * ROUTES DE SANTÉ — Zero-Trust pour MonitorMe
 * ============================================================
 * 
 * ISOLATION TOTALE :
 * - Auth par X-Monitor-Key (PAS de JWT)
 * - Rate-limit strict (10 req/min)
 * - Retourne uniquement des booléens
 * - Indépendant des routes Super-Admin
 * 
 * SI LA CLÉ FUIT :
 * L'attaquant voit { db: true } — pas de données utilisateur
 * Il ne peut PAS utiliser cette clé pour accéder aux routes JWT
 * Les deux systèmes auth sont COMPLÈTEMENT séparés
 */

// Rate-limit strict + Auth par clé
router.use(healthRateLimiter);

// Ping simple (pas d'auth — juste pour vérifier que le serveur répond)
router.get('/ping', healthController.ping);

// Health check complet (auth requise)
router.get('/', monitorAuth, healthController.getHealth);

module.exports = router;
