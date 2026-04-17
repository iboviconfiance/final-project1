const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * Middleware d'authentification JWT
 * Vérifie le header Authorization au format 'Bearer <token>',
 * décode le JWT, récupère l'utilisateur complet en BDD,
 * et l'attache à req.user pour les routes protégées.
 */
const authMiddleware = async (req, res, next) => {
  try {
    // 1. Vérifier la présence du header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Accès refusé. Aucun token fourni.' });
    }

    // 2. Vérifier le format 'Bearer <token>'
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ error: 'Format du token invalide. Utilisez : Bearer <token>' });
    }

    const token = parts[1];

    // 3. Décoder et vérifier le JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4. Récupérer l'utilisateur complet en BDD (sans le mot de passe)
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(401).json({ error: 'Utilisateur associé au token introuvable.' });
    }

    // 5. Attacher l'objet user complet à la requête
    req.user = user;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expiré. Veuillez vous reconnecter.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token invalide.' });
    }
    console.error('Erreur authMiddleware:', error);
    return res.status(500).json({ error: 'Erreur interne lors de l\'authentification.' });
  }
};

/**
 * Middleware de vérification de rôle
 * Vérifie que l'utilisateur a l'un des rôles autorisés.
 * Doit être utilisé APRÈS authMiddleware.
 * 
 * @param  {...string} roles - Les rôles autorisés (ex: 'admin', 'manager')
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentification requise.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès interdit. Rôle insuffisant.' });
    }
    next();
  };
};

module.exports = { authMiddleware, requireRole };
