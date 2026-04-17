/**
 * ============================================================
 * Upload Service — Validation ultra-stricte des fichiers
 * ============================================================
 * 
 * PROTECTIONS :
 * 1. MAGIC NUMBERS : Lit les premiers octets du fichier pour vérifier
 *    le vrai type (un script PHP renommé en .jpg sera détecté)
 * 2. MIME TYPE : Double vérification du Content-Type
 * 3. RENOMMAGE : Chaque fichier reçoit un UUID + timestamp
 *    (logo_client.png → a7f8-92b1-55c3.png)
 * 4. ISOLATION : Chaque organisation a son propre dossier
 *    (/uploads/org_[UUID]/profiles/, /uploads/org_[UUID]/logos/)
 * 5. TAILLE LIMITÉE : 5MB max images, 10MB max documents
 * 6. EXIF STRIPPING : Les métadonnées GPS sont supprimées
 *    pour protéger la localisation des utilisateurs
 * 7. NO-EXECUTE : Extension de fichier forcée côté serveur
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ============================================================
// MAGIC NUMBERS — Signatures binaires des formats autorisés
// ============================================================
const MAGIC_NUMBERS = {
  // Images
  'image/jpeg': [
    { offset: 0, bytes: [0xFF, 0xD8, 0xFF] }
  ],
  'image/png': [
    { offset: 0, bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }
  ],
  'image/gif': [
    { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] }  // GIF8
  ],
  'image/webp': [
    { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] }   // WEBP à offset 8
  ],
  // Documents
  'application/pdf': [
    { offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }   // %PDF
  ],
  // CSV : pas de magic number, validation par contenu
  'text/csv': null,
  // XLSX/DOCX (format ZIP)
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
    { offset: 0, bytes: [0x50, 0x4B, 0x03, 0x04] }   // PK (ZIP)
  ]
};

// ============================================================
// PROFILS D'UPLOAD par rôle
// ============================================================
const UPLOAD_PROFILES = {
  // CLIENT (abonné final)
  client: {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSize: 5 * 1024 * 1024,  // 5MB
    categories: {
      profile: { subdir: 'profiles', maxFiles: 1 },
      payment_proof: { subdir: 'payment_proofs', maxFiles: 3 },
      kyc: { subdir: 'kyc', maxFiles: 5 }
    }
  },
  // ADMIN (propriétaire de l'entreprise)
  admin: {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    maxSize: 10 * 1024 * 1024, // 10MB
    categories: {
      logo: { subdir: 'logos', maxFiles: 1 },
      banner: { subdir: 'banners', maxFiles: 5 },
      import: { subdir: 'imports', maxFiles: 3 },
      signature: { subdir: 'signatures', maxFiles: 1 }
    }
  },
  // SUPERADMIN
  superadmin: {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf', 'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    maxSize: 50 * 1024 * 1024, // 50MB
    categories: {
      config: { subdir: '_system/config', maxFiles: 10 },
      templates: { subdir: '_system/templates', maxFiles: 10 },
      exports: { subdir: '_system/exports', maxFiles: 50 }
    }
  }
};

// ============================================================
// VÉRIFICATION DES MAGIC NUMBERS
// ============================================================

/**
 * Vérifie que les premiers octets du fichier correspondent au type déclaré.
 * Un fichier PHP/JS caché dans un .jpg sera REJETÉ ici.
 * 
 * @param {Buffer} buffer - Les données du fichier
 * @param {string} declaredMime - Le type MIME déclaré (ex: 'image/jpeg')
 * @returns {{ valid: boolean, detectedType: string|null, error?: string }}
 */
function verifyMagicNumber(buffer, declaredMime) {
  const signatures = MAGIC_NUMBERS[declaredMime];

  // CSV : pas de magic number, vérifier que c'est du texte pur
  if (signatures === null && declaredMime === 'text/csv') {
    return validateCSV(buffer);
  }

  if (!signatures) {
    return { valid: false, detectedType: null, error: `Type MIME non autorisé: ${declaredMime}` };
  }

  for (const sig of signatures) {
    const slice = buffer.slice(sig.offset, sig.offset + sig.bytes.length);
    if (slice.length < sig.bytes.length) continue;

    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (slice[i] !== sig.bytes[i]) { match = false; break; }
    }
    if (match) return { valid: true, detectedType: declaredMime };
  }

  return {
    valid: false,
    detectedType: detectActualType(buffer),
    error: `Le contenu du fichier ne correspond pas au type '${declaredMime}'. Fichier potentiellement malveillant.`
  };
}

/**
 * Tente de détecter le vrai type d'un fichier suspect
 */
function detectActualType(buffer) {
  for (const [mime, sigs] of Object.entries(MAGIC_NUMBERS)) {
    if (!sigs) continue;
    for (const sig of sigs) {
      const slice = buffer.slice(sig.offset, sig.offset + sig.bytes.length);
      let match = true;
      for (let i = 0; i < sig.bytes.length; i++) {
        if (slice[i] !== sig.bytes[i]) { match = false; break; }
      }
      if (match) return mime;
    }
  }
  return 'unknown';
}

/**
 * Valide qu'un fichier CSV est du texte pur (pas un script)
 */
function validateCSV(buffer) {
  const str = buffer.toString('utf8', 0, Math.min(buffer.length, 4096));

  // Rejeter si ça contient du code (PHP, JS, HTML)
  const dangerousPatterns = [
    /<\?php/i, /<script/i, /<%/i, /<!DOCTYPE/i,
    /import\s+/i, /require\s*\(/i, /function\s*\(/i,
    /\x00/ // octets nuls = binaire, pas CSV
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(str)) {
      return { valid: false, detectedType: 'suspicious_script', error: 'Le fichier CSV contient du code suspect.' };
    }
  }

  return { valid: true, detectedType: 'text/csv' };
}

// ============================================================
// SUPPRESSION EXIF (métadonnées GPS)
// ============================================================

/**
 * Supprime les métadonnées EXIF d'une image JPEG.
 * Méthode : On copie les données de l'image en sautant les segments EXIF (APP1).
 * Pas de dépendance externe requise.
 * 
 * @param {Buffer} buffer - Image JPEG en mémoire
 * @returns {Buffer} Image sans EXIF
 */
function stripExifFromJPEG(buffer) {
  // Vérifier que c'est bien un JPEG
  if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) return buffer;

  const chunks = [];
  chunks.push(Buffer.from([0xFF, 0xD8])); // SOI marker

  let offset = 2;
  while (offset < buffer.length - 1) {
    if (buffer[offset] !== 0xFF) break;

    const marker = buffer[offset + 1];

    // SOS (Start of Scan) → copier le reste tel quel
    if (marker === 0xDA) {
      chunks.push(buffer.slice(offset));
      break;
    }

    // Taille du segment
    const segLength = buffer.readUInt16BE(offset + 2);

    // APP1 (0xE1) = EXIF → SAUTER ce segment
    if (marker === 0xE1) {
      offset += 2 + segLength;
      continue;
    }

    // Copier tous les autres segments
    chunks.push(buffer.slice(offset, offset + 2 + segLength));
    offset += 2 + segLength;
  }

  return Buffer.concat(chunks);
}

/**
 * Nettoie une image : supprime EXIF si JPEG
 */
function sanitizeImage(buffer, mimeType) {
  if (mimeType === 'image/jpeg') {
    return stripExifFromJPEG(buffer);
  }
  // PNG et WebP n'ont généralement pas de données GPS dangereuses
  return buffer;
}

// ============================================================
// GÉNÉRATION DE NOM DE FICHIER SÉCURISÉ
// ============================================================

/**
 * Génère un nom de fichier aléatoire impossible à deviner.
 * logo_client.png → 8a3f7b2e-1d4c-9e6f-0a8b.png
 */
function generateSecureFilename(originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const safeExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.csv', '.xlsx'];

  // Forcer une extension sûre
  const finalExt = safeExts.includes(ext) ? ext : '.bin';
  const uniqueId = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();

  return `${uniqueId}-${timestamp}${finalExt}`;
}

// ============================================================
// CONSTRUCTION DU CHEMIN ISOLÉ PAR ORGANISATION
// ============================================================

/**
 * Construit le chemin d'upload isolé par organisation.
 * /uploads/org_[UUID]/[category]/
 * Le Super-Admin utilise /uploads/_system/[category]/
 */
function buildUploadPath(organizationId, category, role) {
  const baseDir = path.join(__dirname, '..', 'uploads');

  let orgDir;
  if (role === 'superadmin') {
    orgDir = path.join(baseDir, '_system');
  } else {
    if (!organizationId) throw new Error('Organization ID requis pour l\'upload.');
    orgDir = path.join(baseDir, `org_${organizationId}`);
  }

  const profile = UPLOAD_PROFILES[role] || UPLOAD_PROFILES.client;
  const categoryConfig = profile.categories[category];
  if (!categoryConfig) throw new Error(`Catégorie d'upload invalide: ${category}`);

  const finalDir = path.join(orgDir, categoryConfig.subdir);

  // Créer le dossier s'il n'existe pas
  if (!fs.existsSync(finalDir)) {
    fs.mkdirSync(finalDir, { recursive: true });
  }

  return finalDir;
}

// ============================================================
// CONFIGURATION MULTER SÉCURISÉE
// ============================================================

/**
 * Crée une instance Multer configurée pour un rôle et une catégorie.
 */
function createUploader(role, category) {
  const profile = UPLOAD_PROFILES[role] || UPLOAD_PROFILES.client;
  const categoryConfig = profile.categories[category];

  if (!categoryConfig) {
    throw new Error(`Catégorie '${category}' non autorisée pour le rôle '${role}'.`);
  }

  const storage = multer.memoryStorage(); // On garde en mémoire pour valider AVANT d'écrire

  const upload = multer({
    storage,
    limits: {
      fileSize: profile.maxSize,
      files: categoryConfig.maxFiles
    },
    fileFilter: (req, file, cb) => {
      // Vérification du MIME déclaré
      if (!profile.allowedTypes.includes(file.mimetype)) {
        return cb(new Error(`Type de fichier non autorisé: ${file.mimetype}. Autorisés: ${profile.allowedTypes.join(', ')}`));
      }
      cb(null, true);
    }
  });

  return upload;
}

// ============================================================
// PIPELINE DE VALIDATION COMPLET
// ============================================================

/**
 * Valide et sauvegarde un fichier uploadé.
 * Pipeline : MIME check → Magic Number → EXIF strip → Rename → Save
 * 
 * @param {object} file - L'objet fichier Multer (req.file)
 * @param {string} organizationId - UUID de l'organisation
 * @param {string} category - Catégorie d'upload (profile, logo, etc.)
 * @param {string} role - Rôle de l'utilisateur
 * @returns {{ success: boolean, filePath: string, publicUrl: string, error?: string }}
 */
async function processUpload(file, organizationId, category, role) {
  const profile = UPLOAD_PROFILES[role] || UPLOAD_PROFILES.client;

  // ÉTAPE 1 : Vérifier le type MIME déclaré
  if (!profile.allowedTypes.includes(file.mimetype)) {
    return { success: false, error: `Type non autorisé: ${file.mimetype}` };
  }

  // ÉTAPE 2 : Vérifier le MAGIC NUMBER (contenu réel)
  const magicCheck = verifyMagicNumber(file.buffer, file.mimetype);
  if (!magicCheck.valid) {
    return {
      success: false,
      error: magicCheck.error,
      detectedType: magicCheck.detectedType
    };
  }

  // ÉTAPE 3 : Supprimer les métadonnées EXIF (images uniquement)
  let cleanBuffer = file.buffer;
  if (file.mimetype.startsWith('image/')) {
    cleanBuffer = sanitizeImage(file.buffer, file.mimetype);
  }

  // ÉTAPE 4 : Générer un nom de fichier aléatoire
  const secureFilename = generateSecureFilename(file.originalname);

  // ÉTAPE 5 : Construire le chemin isolé par organisation
  const uploadDir = buildUploadPath(organizationId, category, role);
  const filePath = path.join(uploadDir, secureFilename);

  // ÉTAPE 6 : Écrire le fichier nettoyé sur le disque
  fs.writeFileSync(filePath, cleanBuffer);

  // Construire l'URL publique relative
  const relativePath = path.relative(
    path.join(__dirname, '..'),
    filePath
  ).replace(/\\/g, '/');

  return {
    success: true,
    filePath,
    publicUrl: `/${relativePath}`,
    filename: secureFilename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: cleanBuffer.length,
    exifStripped: file.mimetype === 'image/jpeg'
  };
}

/**
 * Supprime un fichier uploadé (pour le cleanup)
 */
function deleteUpload(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  createUploader,
  processUpload,
  deleteUpload,
  verifyMagicNumber,
  sanitizeImage,
  generateSecureFilename,
  buildUploadPath,
  UPLOAD_PROFILES
};
