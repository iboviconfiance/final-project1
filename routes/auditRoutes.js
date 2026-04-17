const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');

/**
 * ============================================================
 * ROUTES D'AUDIT — LECTURE SEULE (Pentest-Ready)
 * ============================================================
 * 
 * ⚠️  AUCUNE route PUT, PATCH ou DELETE n'est exposée.
 *     L'immutabilité est également garantie par les hooks Sequelize
 *     dans le modèle AuditLog (beforeDestroy, beforeUpdate).
 * 
 * Toutes les routes nécessitent une authentification.
 * Les routes de consultation admin nécessitent le rôle 'admin'.
 */

router.use(authMiddleware);

// [GET] Lister les communications de l'organisation (admin)
router.get('/communications', requireRole('admin'), auditController.getCommunications);

// [GET] Communications d'un utilisateur spécifique (admin)
router.get('/user/:userId', requireRole('admin'), auditController.getUserCommunications);

// [GET] Extraire la preuve de livraison pour une transaction (admin)
router.get('/proof/:transactionId', requireRole('admin'), auditController.getProofOfDelivery);

// [GET] Télécharger un reçu PDF archivé (tout utilisateur authentifié)
router.get('/receipt/:accessKey', auditController.downloadReceipt);

module.exports = router;
