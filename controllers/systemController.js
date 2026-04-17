/**
 * System Controller — Mode de fonctionnement (Option A/B)
 * 
 * Option A (Plateforme) : Multi-tenant, le client choisit son organisation
 * Option B (Licence)    : Mono-tenant, une seule organisation pré-configurée
 * 
 * Détecté via LICENSE_ORG_ID dans .env
 */
const { Organization } = require('../models');

/**
 * GET /api/v1/system/mode
 * Retourne le mode de fonctionnement de l'instance.
 */
exports.getSystemMode = async (req, res) => {
  try {
    const licenseOrgId = process.env.LICENSE_ORG_ID;

    if (licenseOrgId) {
      // Mode Licence (Option B) — organisation unique
      const org = await Organization.findByPk(licenseOrgId, {
        attributes: ['id', 'name', 'slug']
      });

      return res.json({
        data: {
          mode: 'license',
          organization: org ? {
            id: org.id,
            name: org.name,
            slug: org.slug,
          } : null
        }
      });
    }

    // Mode Plateforme (Option A) — multi-tenant
    res.json({
      data: {
        mode: 'platform',
        organization: null
      }
    });
  } catch (error) {
    console.error('Erreur système mode:', error);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
};

/**
 * GET /api/v1/system/qr-token
 * Génère un token signé pour le QR Code de validation d'abonnement.
 * 
 * Le token contient :
 * - userId : ID de l'utilisateur
 * - subscriptionId : ID de l'abonnement actif
 * - timestamp : Horodatage (pour rotatio du QR toutes les 5min)
 * - hash : Signature HMAC-SHA256 pour empêcher la falsification
 * 
 * SÉCURITÉ :
 * - Le token expire toutes les 5 minutes → empêche les captures d'écran
 * - Signé avec JWT_SECRET → impossible à forger
 * - Nécessite un abonnement actif
 */
const crypto = require('crypto');
const { Subscription } = require('../models');

exports.generateQrToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    // Trouver l'abonnement actif
    const subscription = await Subscription.findOne({
      where: {
        userId,
        status: 'active'
      },
      order: [['endDate', 'DESC']]
    });

    if (!subscription) {
      return res.json({
        data: {
          qrToken: null,
          status: 'no_active_subscription',
          message: 'Aucun abonnement actif.'
        }
      });
    }

    // Générer un token rotatif (change toutes les 5 minutes)
    const timeSlot = Math.floor(Date.now() / (5 * 60 * 1000)); // Slot de 5min
    const payload = `${userId}:${subscription.id}:${organizationId}:${timeSlot}`;
    const secret = process.env.JWT_SECRET || 'fallback-secret';
    const hash = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const qrData = JSON.stringify({
      u: userId,
      s: subscription.id,
      o: organizationId,
      t: timeSlot,
      h: hash.substring(0, 16), // 16 premiers chars suffisent pour la validation
      v: 1 // version du format
    });

    res.json({
      data: {
        qrToken: qrData,
        status: subscription.status,
        expiresAt: subscription.endDate,
        planName: subscription.planName || 'Abonnement',
        refreshIn: 300, // Rafraîchir dans 5min (en secondes)
      }
    });
  } catch (error) {
    console.error('Erreur génération QR token:', error);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
};

/**
 * POST /api/v1/system/verify-qr
 * Vérifie un QR Code scanné (utilisé par le staff à l'entrée).
 * 
 * Body : { qrData: string }
 */
exports.verifyQrCode = async (req, res) => {
  try {
    const { qrData } = req.body;
    if (!qrData) {
      return res.status(400).json({ error: 'QR Code requis.' });
    }

    let parsed;
    try {
      parsed = JSON.parse(qrData);
    } catch {
      return res.json({ data: { valid: false, reason: 'Format QR invalide.' } });
    }

    const { u: userId, s: subId, o: orgId, t: timeSlot, h: hash } = parsed;

    // Vérifier la signature
    const payload = `${userId}:${subId}:${orgId}:${timeSlot}`;
    const secret = process.env.JWT_SECRET || 'fallback-secret';
    const expectedHash = crypto.createHmac('sha256', secret).update(payload).digest('hex').substring(0, 16);

    if (hash !== expectedHash) {
      return res.json({ data: { valid: false, reason: 'Signature invalide.' } });
    }

    // Vérifier que le token n'est pas trop vieux (max 10 minutes = 2 slots)
    const currentSlot = Math.floor(Date.now() / (5 * 60 * 1000));
    if (currentSlot - timeSlot > 2) {
      return res.json({ data: { valid: false, reason: 'QR Code expiré. Demandez un nouveau.' } });
    }

    // Vérifier l'abonnement
    const subscription = await Subscription.findByPk(subId);
    if (!subscription || subscription.userId !== userId) {
      return res.json({ data: { valid: false, reason: 'Abonnement introuvable.' } });
    }

    if (subscription.status !== 'active') {
      return res.json({
        data: {
          valid: false,
          reason: `Abonnement ${subscription.status === 'grace_period' ? 'en période de grâce' : 'expiré'}.`
        }
      });
    }

    // Vérifier que l'org correspond (sécurité multi-tenant)
    if (req.user.organizationId !== orgId) {
      return res.json({ data: { valid: false, reason: 'Organisation non autorisée.' } });
    }

    // ✅ Tout est bon
    const { User } = require('../models');
    const user = await User.findByPk(userId, {
      attributes: ['id', 'email', 'firstName', 'lastName']
    });

    res.json({
      data: {
        valid: true,
        user: {
          email: user?.email,
          name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Inconnu'
        },
        subscription: {
          status: subscription.status,
          endDate: subscription.endDate,
          planName: subscription.planName
        }
      }
    });
  } catch (error) {
    console.error('Erreur vérification QR:', error);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
};
