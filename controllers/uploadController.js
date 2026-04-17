const { createUploader, processUpload, deleteUpload, UPLOAD_PROFILES } = require('../services/uploadService');
const { AdminLog } = require('../models');

/**
 * ============================================================
 * Upload Controller — Gestion des fichiers par rôle
 * ============================================================
 * 
 * CLIENT : photo de profil, justificatif de paiement, KYC
 * ADMIN  : logo, bannière, import CSV, signature
 * SUPERADMIN : config, templates, exports
 * 
 * Chaque upload passe par le pipeline complet :
 * MIME → Magic Number → EXIF strip → Rename → Save isolé
 */

/**
 * Détermine le rôle effectif pour l'upload
 */
function getEffectiveRole(user, isSuperAdmin) {
  if (isSuperAdmin) return 'superadmin';
  if (user.role === 'admin') return 'admin';
  return 'client';
}

/**
 * POST /api/uploads/:category
 * Upload générique avec validation automatique par rôle
 */
exports.upload = async (req, res) => {
  try {
    const { category } = req.params;
    const role = getEffectiveRole(req.user, req.isSuperAdmin);
    const profile = UPLOAD_PROFILES[role];

    if (!profile) {
      return res.status(403).json({ error: 'Rôle non reconnu pour l\'upload.' });
    }

    if (!profile.categories[category]) {
      return res.status(400).json({
        error: `Catégorie '${category}' non autorisée pour votre rôle.`,
        allowedCategories: Object.keys(profile.categories)
      });
    }

    // Créer l'uploader Multer pour ce rôle et cette catégorie
    const uploader = createUploader(role, category);
    const multerUpload = uploader.single('file');

    // Exécuter Multer
    multerUpload(req, res, async (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            error: 'Fichier trop volumineux.',
            maxSize: `${profile.maxSize / (1024 * 1024)}MB`
          });
        }
        return res.status(400).json({ error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier envoyé. Champ attendu: "file".' });
      }

      // Pipeline de validation complet
      const result = await processUpload(
        req.file,
        req.user.organizationId,
        category,
        role
      );

      if (!result.success) {
        return res.status(422).json({
          error: 'Fichier rejeté par la validation de sécurité.',
          details: result.error,
          detectedType: result.detectedType || null
        });
      }

      // Log d'audit pour les admins
      if (role === 'admin' || role === 'superadmin') {
        setImmediate(async () => {
          try {
            await AdminLog.create({
              adminId: req.user.id,
              organizationId: role === 'superadmin' ? null : req.user.organizationId,
              action: 'SYSTEM_CONFIG',
              targetType: 'Upload',
              targetId: null,
              changes: {
                after: {
                  category,
                  filename: result.filename,
                  originalName: result.originalName,
                  mimeType: result.mimeType,
                  size: result.size
                }
              },
              ipAddress: req.ip,
              userAgent: req.headers['user-agent']?.substring(0, 500)
            });
          } catch (logErr) {
            console.error('⚠️ Erreur audit upload:', logErr.message);
          }
        });
      }

      res.status(201).json({
        message: 'Fichier uploadé avec succès.',
        data: {
          url: result.publicUrl,
          filename: result.filename,
          mimeType: result.mimeType,
          size: result.size,
          exifStripped: result.exifStripped,
          category
        }
      });
    });
  } catch (error) {
    console.error('Erreur upload:', error);
    res.status(500).json({ error: 'Erreur interne lors de l\'upload.' });
  }
};

/**
 * GET /api/uploads/allowed
 * Retourne les catégories et types autorisés pour le rôle courant
 */
exports.getAllowedUploads = (req, res) => {
  const role = getEffectiveRole(req.user, req.isSuperAdmin);
  const profile = UPLOAD_PROFILES[role];

  res.status(200).json({
    data: {
      role,
      allowedTypes: profile.allowedTypes,
      maxSize: `${profile.maxSize / (1024 * 1024)}MB`,
      categories: Object.entries(profile.categories).map(([name, config]) => ({
        name,
        maxFiles: config.maxFiles
      }))
    }
  });
};

/**
 * DELETE /api/uploads/:category/:filename
 * Supprime un fichier uploadé (admin et superadmin uniquement)
 */
exports.deleteFile = async (req, res) => {
  try {
    const { category, filename } = req.params;
    const role = getEffectiveRole(req.user, req.isSuperAdmin);

    if (role === 'client') {
      return res.status(403).json({ error: 'Seuls les administrateurs peuvent supprimer des fichiers.' });
    }

    const { buildUploadPath } = require('../services/uploadService');
    const path = require('path');
    const uploadDir = buildUploadPath(req.user.organizationId, category, role);
    const filePath = path.join(uploadDir, filename);

    // Vérifier que le fichier est dans le bon dossier (anti path traversal)
    const resolved = path.resolve(filePath);
    const resolvedDir = path.resolve(uploadDir);
    if (!resolved.startsWith(resolvedDir)) {
      return res.status(403).json({ error: 'Accès refusé — tentative de path traversal détectée.' });
    }

    const deleted = deleteUpload(filePath);
    if (!deleted) {
      return res.status(404).json({ error: 'Fichier introuvable.' });
    }

    res.status(200).json({ message: 'Fichier supprimé.' });
  } catch (error) {
    console.error('Erreur deleteFile:', error);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};
