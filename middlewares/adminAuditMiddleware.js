const { AdminLog } = require('../models');

/**
 * ============================================================
 * Admin Audit Middleware — Auto-log des actions administratives
 * ============================================================
 * 
 * S'applique sur les routes SuperAdmin et admin.
 * Enregistre automatiquement chaque POST/PUT/PATCH/DELETE
 * dans la table AdminLog avec :
 * - L'admin qui a agi
 * - L'action effectuée
 * - L'IP source
 * - Le user-agent
 * - Le body de la requête (sanitisé)
 * 
 * APPEND-ONLY : Le log est créé et jamais modifié.
 */

/**
 * Crée un middleware d'audit pour une action spécifique.
 * 
 * @param {string} action - Le type d'action (ex: 'SUSPEND_ORG', 'UPDATE_PLAN')
 * @param {function} [extractTarget] - Fonction pour extraire targetType et targetId de req
 * @returns {function} Express middleware
 * 
 * Usage :
 * router.put('/suspend/:id', adminAudit('SUSPEND_ORG', req => ({
 *   targetType: 'Organization',
 *   targetId: req.params.id
 * })), controller.suspend);
 */
const adminAudit = (action, extractTarget) => {
  return async (req, res, next) => {
    // Capturer les données AVANT que le contrôleur ne s'exécute
    const auditData = {
      adminId: req.user?.id,
      organizationId: req.isSuperAdmin ? null : req.user?.organizationId,
      action,
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent']?.substring(0, 500),
      metadata: {
        method: req.method,
        path: req.originalUrl,
        timestamp: new Date().toISOString()
      }
    };

    // Extraire la cible si le callback est fourni
    if (extractTarget) {
      try {
        const target = extractTarget(req);
        auditData.targetType = target.targetType || null;
        auditData.targetId = target.targetId || null;
      } catch (e) {
        // Si l'extraction échoue, continuer sans cible
      }
    }

    // Intercepter la réponse pour capturer le résultat
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      // Créer le log d'audit en arrière-plan (fire-and-forget)
      setImmediate(async () => {
        try {
          // Capturer les changements depuis le body de la réponse
          if (body?.data) {
            auditData.changes = {
              requestBody: sanitizeBody(req.body),
              responseData: summarizeResponse(body.data)
            };
          }

          await AdminLog.create(auditData);
        } catch (err) {
          console.error('⚠️ Erreur audit middleware:', err.message);
        }
      });

      return originalJson(body);
    };

    next();
  };
};

/**
 * Sanitise le corps de la requête pour le log
 * (supprime les mots de passe et données sensibles)
 */
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return {};
  const sanitized = { ...body };
  const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'key'];
  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    }
  }
  return sanitized;
}

/**
 * Résume les données de réponse pour le log
 * (évite de stocker des payloads énormes)
 */
function summarizeResponse(data) {
  if (!data || typeof data !== 'object') return data;
  const summary = {};
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      summary[key] = `[Array: ${value.length} items]`;
    } else if (typeof value === 'object' && value !== null) {
      summary[key] = value.id ? { id: value.id } : '[Object]';
    } else {
      summary[key] = value;
    }
  }
  return summary;
}

/**
 * Middleware utilitaire pour capturer les changements AVANT/APRÈS.
 * Utilisé pour les opérations de mise à jour.
 * 
 * @param {function} getBefore - Async function(req) qui retourne l'état AVANT
 */
const captureChanges = (getBefore) => {
  return async (req, res, next) => {
    try {
      const before = await getBefore(req);
      req.auditBefore = before;
    } catch (e) {
      // Pas critique, continuer
    }
    next();
  };
};

module.exports = { adminAudit, captureChanges };
