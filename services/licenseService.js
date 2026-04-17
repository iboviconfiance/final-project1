/**
 * ============================================================
 * SERVICE DE LICENCE — Option B (Licence On-Premise)
 * ============================================================
 * 
 * OPTION A (Plateforme) : LICENSE_KEY absent → mode plateforme (multi-tenant)
 * OPTION B (On-Premise) : LICENSE_KEY présent → vérifie la licence
 * OPTION C (Partenariat) : Comme A, avec le système de parrainage actif
 * 
 * Format de la clé de licence :
 * Base64(JSON{ type, org, expiresAt, maxUsers, signature })
 * 
 * La signature est HMAC-SHA256(type+org+expiresAt+maxUsers, LICENSE_SECRET)
 * Si la clé est invalide ou expirée, l'application refuse de démarrer.
 * 
 * GÉNÉRATION D'UNE CLÉ (script admin) :
 * node -e "
 *   const crypto = require('crypto');
 *   const data = { type: 'B', org: 'ClientX', expiresAt: '2027-01-01', maxUsers: 100 };
 *   const payload = data.type + data.org + data.expiresAt + data.maxUsers;
 *   data.signature = crypto.createHmac('sha256', 'YOUR_LICENSE_SECRET').update(payload).digest('hex');
 *   console.log(Buffer.from(JSON.stringify(data)).toString('base64'));
 * "
 */

const crypto = require('crypto');

/**
 * Vérifie et décode la clé de licence.
 * @returns {{ valid: boolean, type: string, org: string, expiresAt: string, maxUsers: number, error?: string }}
 */
const validateLicense = () => {
  const licenseKey = process.env.LICENSE_KEY;
  const licenseSecret = process.env.LICENSE_SECRET;

  // Pas de licence = mode plateforme (Option A)
  if (!licenseKey) {
    return {
      valid: true,
      type: 'A',
      org: 'PLATFORM_MODE',
      expiresAt: null,
      maxUsers: Infinity,
      mode: 'Plateforme SaaS (multi-tenant)'
    };
  }

  if (!licenseSecret) {
    return {
      valid: false,
      error: 'LICENSE_SECRET manquant dans .env pour valider la licence.'
    };
  }

  try {
    // Décoder la licence (Base64 → JSON)
    const decoded = JSON.parse(Buffer.from(licenseKey, 'base64').toString('utf-8'));
    const { type, org, expiresAt, maxUsers, signature } = decoded;

    if (!type || !org || !expiresAt || !maxUsers || !signature) {
      return { valid: false, error: 'Licence mal formée — champs manquants.' };
    }

    // Vérifier la signature HMAC
    const payload = type + org + expiresAt + maxUsers;
    const expectedSig = crypto.createHmac('sha256', licenseSecret).update(payload).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSig, 'hex'))) {
      return { valid: false, error: 'Signature de licence invalide — clé falsifiée ou corrompue.' };
    }

    // Vérifier l'expiration
    if (new Date(expiresAt) < new Date()) {
      return {
        valid: false,
        error: `Licence expirée le ${expiresAt}. Contactez le fournisseur.`,
        type,
        org,
        expiresAt
      };
    }

    const modeLabels = {
      'A': 'Plateforme SaaS (multi-tenant)',
      'B': 'Licence On-Premise',
      'C': 'Partenariat (multi-tenant + commissions)'
    };

    return {
      valid: true,
      type,
      org,
      expiresAt,
      maxUsers: parseInt(maxUsers),
      mode: modeLabels[type] || `Type ${type}`
    };
  } catch (err) {
    return { valid: false, error: `Erreur décodage licence: ${err.message}` };
  }
};

/**
 * Middleware Express qui bloque les requêtes si la licence est invalide.
 * Appliqué globalement si LICENSE_KEY est défini dans .env.
 */
const licenseMiddleware = (req, res, next) => {
  // Si pas de licence dans .env = mode plateforme, pas de vérification
  if (!process.env.LICENSE_KEY) return next();

  const result = validateLicense();
  if (!result.valid) {
    return res.status(503).json({
      error: 'Licence invalide ou expirée.',
      details: result.error,
      contact: 'Contactez votre fournisseur de licence.'
    });
  }

  // Attacher les infos de licence à la requête
  req.license = result;
  next();
};

module.exports = { validateLicense, licenseMiddleware };
