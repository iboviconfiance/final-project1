const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { authMiddleware } = require('../middlewares/authMiddleware');

/**
 * ============================================================
 * ROUTES D'UPLOAD — Sécurisées par rôle
 * ============================================================
 * 
 * Toutes les routes requièrent une authentification JWT.
 * Le rôle détermine automatiquement les permissions :
 * - Client : profile, payment_proof, kyc
 * - Admin : logo, banner, import, signature
 * - SuperAdmin : config, templates, exports
 * 
 * Le pipeline de sécurité est appliqué automatiquement :
 * MIME → Magic Number → EXIF → Rename → Org Isolation
 */

// Auth requise pour tous les uploads
router.use(authMiddleware);

// Liste des uploads autorisés pour le rôle courant
router.get('/allowed', uploadController.getAllowedUploads);

// Upload d'un fichier dans une catégorie
router.post('/:category', uploadController.upload);

// Suppression d'un fichier (admin/superadmin uniquement)
router.delete('/:category/:filename', uploadController.deleteFile);

module.exports = router;
