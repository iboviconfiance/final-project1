const { User } = require('../models');

/**
 * ============================================================
 * Super-Admin Authentication — Séparé de l'auth standard
 * ============================================================
 * 
 * COMMENT C'EST SÉCURISÉ :
 * 
 * 1. Le rôle 'superadmin' est distinct du rôle 'admin' dans la DB
 * 2. Un 'admin' d'une organisation n'a AUCUN accès aux routes Super-Admin
 * 3. Le rôle 'superadmin' ne peut être attribué que directement en BDD
 *    (pas d'endpoint API pour promouvoir un utilisateur en superadmin)
 * 4. Le middleware vérifie en BDD à chaque requête (pas seulement le JWT)
 *    → même si quelqu'un falsifie le JWT, la BDD dira la vérité
 * 
 * POURQUOI UN ADMIN CLIENT NE PEUT PAS TRICHER :
 * - Le JWT contient user.role = 'admin', pas 'superadmin'
 * - Même si un client modifie son cookie/storage local, le middleware
 *   recharge le user depuis la BDD (pas depuis le JWT)
 * - Le seul moyen d'avoir un 'superadmin' est par INSERT SQL direct
 */

/**
 * Middleware qui vérifie que l'utilisateur est Super-Admin.
 * DOIT être placé APRÈS authMiddleware (qui attache req.user).
 */
const superAdminAuth = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentification requise.' });
    }

    // SÉCURITÉ CRITIQUE : Re-vérifier le rôle depuis la BDD
    // Ne PAS faire confiance au JWT seul — un token volé pourrait
    // avoir un rôle modifié entre-temps
    const freshUser = await User.findByPk(req.user.id, {
      attributes: ['id', 'role']
    });

    if (!freshUser || freshUser.role !== 'superadmin') {
      // Log la tentative d'accès non autorisé
      console.warn(
        `🚨 Tentative accès Super-Admin refusée: user=${req.user.id} ` +
        `role=${freshUser?.role || 'unknown'} ip=${req.ip}`
      );
      return res.status(403).json({
        error: 'Accès refusé. Privilèges Super-Administrateur requis.'
      });
    }

    // Marquer la requête comme Super-Admin
    req.isSuperAdmin = true;
    next();

  } catch (error) {
    console.error('Erreur superAdminAuth:', error);
    return res.status(500).json({ error: 'Erreur interne.' });
  }
};

module.exports = { superAdminAuth };
