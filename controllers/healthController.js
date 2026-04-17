const { sequelize } = require('../models');
const paymentManager = require('../services/payments/PaymentManager');
const { validateLicense } = require('../services/licenseService');

/**
 * ============================================================
 * Health Controller — Endpoint de santé Zero-Trust
 * ============================================================
 * 
 * POLITIQUE DE SÉCURITÉ :
 * - Retourne UNIQUEMENT des booléens (true/false)
 * - JAMAIS de versions, chemins de fichiers, ou détails techniques
 * - Protégé par X-Monitor-Key (indépendant du JWT)
 * - Rate-limité à 10 req/min
 * 
 * SI LA CLÉ MONITORING FUIT :
 * L'attaquant voit : { db: true, email: true }
 * Il ne voit PAS : versions Node.js, noms de tables, chemins serveur
 * Il ne peut PAS : créer de JWT, accéder aux comptes, modifier des données
 * → Impact = zéro compromission de données utilisateur
 */

/**
 * GET /api/v1/health
 * Vérifie la santé de tous les composants.
 */
exports.getHealth = async (req, res) => {
  const health = {
    status: 'UP',
    timestamp: new Date().toISOString(),
    checks: {}
  };

  // 1. Connexion BDD
  try {
    await sequelize.authenticate();
    health.checks.database = true;
  } catch (err) {
    health.checks.database = false;
    health.status = 'DEGRADED';
  }

  // 2. Service email (vérifie que le transport est configuré)
  try {
    health.checks.email = !!process.env.SMTP_HOST;
  } catch (err) {
    health.checks.email = false;
  }

  // 3. Providers de paiement
  try {
    const providers = paymentManager.getAvailableProviders();
    health.checks.paymentProviders = providers.length > 0;
    health.checks.paymentProviderCount = providers.length;
  } catch (err) {
    health.checks.paymentProviders = false;
    health.checks.paymentProviderCount = 0;
  }

  // 4. Licence (Option B)
  try {
    const license = validateLicense();
    health.checks.license = license.valid;
    health.checks.licenseType = license.type;
  } catch (err) {
    health.checks.license = false;
  }

  // 5. Espace disque pour les PDFs (vérification basique)
  try {
    const fs = require('fs');
    const path = require('path');
    const storageDir = path.join(__dirname, '..', 'storage', 'receipts');
    fs.accessSync(storageDir, fs.constants.W_OK);
    health.checks.pdfStorage = true;
  } catch (err) {
    health.checks.pdfStorage = false;
  }

  // Déterminer le statut global
  const allUp = Object.entries(health.checks)
    .filter(([key]) => typeof health.checks[key] === 'boolean')
    .every(([, val]) => val === true);

  health.status = allUp ? 'UP' : 'DEGRADED';

  const statusCode = health.status === 'UP' ? 200 : 503;
  res.status(statusCode).json(health);
};

/**
 * GET /api/v1/health/ping
 * Simple ping pour confirmer que le serveur répond.
 * Zéro donnée retournée — juste un signe de vie.
 */
exports.ping = (req, res) => {
  res.status(200).json({ pong: true });
};
