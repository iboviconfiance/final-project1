const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

/**
 * ============================================================
 * Monitor Auth — Authentification Zero-Trust pour MonitorMe
 * ============================================================
 * 
 * CANAL SÉPARÉ : La clé X-Monitor-Key est TOTALEMENT indépendante
 * du système JWT. Même si cette clé fuit :
 * - L'attaquant ne peut QUE consulter /api/v1/health
 * - Il voit uniquement {db: true, api: true} — AUCUNE donnée user
 * - Il ne peut PAS créer de JWT, ni accéder aux comptes utilisateurs
 * - Il ne peut PAS modifier quoi que ce soit (la route est GET only)
 * 
 * COMPARAISON TIMING-SAFE :
 * crypto.timingSafeEqual() empêche les attaques par canal auxiliaire
 * (timing attack) sur la comparaison de la clé.
 */

/**
 * Rate-limit extrêmement strict pour la route de santé
 * 10 requêtes par minute maximum — anti-DoS
 */
const healthRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit atteint sur la route de santé.' }
});

/**
 * Middleware de vérification de la clé de monitoring.
 * Vérifie le header X-Monitor-Key contre MONITOR_API_KEY dans .env.
 */
const monitorAuth = (req, res, next) => {
  const monitorKey = process.env.MONITOR_API_KEY;

  if (!monitorKey) {
    return res.status(503).json({
      error: 'Monitoring non configuré (MONITOR_API_KEY manquant).'
    });
  }

  const providedKey = req.headers['x-monitor-key'];

  if (!providedKey) {
    return res.status(401).json({ error: 'Clé de monitoring manquante. Header: X-Monitor-Key' });
  }

  // Comparaison timing-safe pour empêcher les timing attacks
  try {
    const keyBuffer = Buffer.from(monitorKey, 'utf-8');
    const providedBuffer = Buffer.from(providedKey, 'utf-8');

    if (keyBuffer.length !== providedBuffer.length ||
        !crypto.timingSafeEqual(keyBuffer, providedBuffer)) {
      console.warn(`🚨 Tentative accès monitoring avec clé invalide: ip=${req.ip}`);
      return res.status(403).json({ error: 'Clé de monitoring invalide.' });
    }
  } catch (err) {
    return res.status(403).json({ error: 'Clé de monitoring invalide.' });
  }

  next();
};

module.exports = { monitorAuth, healthRateLimiter };
