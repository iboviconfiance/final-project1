/**
 * ============================================================
 * Push Service — Notifications Web Push (VAPID)
 * ============================================================
 * 
 * Envoie des notifications push directement sur le téléphone/navigateur
 * de l'utilisateur. Plus moderne et gratuit (vs SMS payant).
 * 
 * FONCTIONNEMENT :
 * 1. Le client s'inscrit via POST /api/push/subscribe (envoie endpoint + keys)
 * 2. Le serveur stocke l'abonnement dans PushSubscription
 * 3. Quand un événement arrive (expiration, paiement), on envoie un push
 * 
 * SÉCURITÉ :
 * - Protocole VAPID (Voluntary Application Server Identification)
 * - Chiffrement end-to-end entre le serveur et le navigateur
 * - Les clés VAPID sont générées une seule fois et stockées dans .env
 * 
 * GÉNÉRATION DES CLÉS VAPID :
 *   node -e "const wp = require('web-push'); const keys = wp.generateVAPIDKeys(); console.log('VAPID_PUBLIC_KEY=' + keys.publicKey); console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);"
 */

const webpush = require('web-push');

// ============================================================
// CONFIGURATION VAPID
// ============================================================

let isConfigured = false;

function configureVAPID() {
  if (isConfigured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const contactEmail = process.env.VAPID_EMAIL || process.env.EMAIL_FROM || 'admin@example.com';

  if (!publicKey || !privateKey) {
    console.warn('⚠️ PushService: VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY manquants dans .env');
    console.warn('   Générez-les avec: node -e "const wp = require(\'web-push\'); const k = wp.generateVAPIDKeys(); console.log(k);"');
    return false;
  }

  try {
    webpush.setVapidDetails(`mailto:${contactEmail}`, publicKey, privateKey);
    isConfigured = true;
    console.log('🔔 PushService: VAPID configuré avec succès.');
    return true;
  } catch (err) {
    console.error('❌ PushService: Erreur config VAPID:', err.message);
    return false;
  }
}

// ============================================================
// ENVOI DE NOTIFICATIONS
// ============================================================

/**
 * Envoie une notification push à un utilisateur spécifique.
 * Envoie à TOUS les appareils enregistrés de l'utilisateur.
 * 
 * @param {string} userId - ID de l'utilisateur
 * @param {object} payload - { title, body, icon?, url?, badge?, tag? }
 * @returns {Promise<{ sent: number, failed: number, errors: Array }>}
 */
async function sendPushToUser(userId, payload) {
  if (!configureVAPID()) {
    return { sent: 0, failed: 0, errors: ['VAPID non configuré'] };
  }

  const { PushSubscription } = require('../models');
  const subscriptions = await PushSubscription.findAll({
    where: { userId, isActive: true }
  });

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0, errors: [] };
  }

  const notifPayload = JSON.stringify({
    title: payload.title || 'Notification',
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/badge-72.png',
    url: payload.url || '/',
    tag: payload.tag || `notif-${Date.now()}`,
    timestamp: Date.now()
  });

  let sent = 0;
  let failed = 0;
  const errors = [];

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        notifPayload,
        { TTL: 86400 } // 24h de validité
      );
      sent++;
    } catch (err) {
      failed++;

      // 410 Gone = l'abonnement n'existe plus côté navigateur
      if (err.statusCode === 410 || err.statusCode === 404) {
        await sub.update({ isActive: false });
        errors.push(`Abonnement ${sub.id} expiré (supprimé).`);
      } else {
        errors.push(`Erreur push ${sub.id}: ${err.message}`);
      }
    }
  }

  return { sent, failed, errors };
}

/**
 * Envoie une notification push à tous les utilisateurs d'une organisation.
 * 
 * @param {string} organizationId - ID de l'organisation
 * @param {object} payload - { title, body, icon?, url? }
 * @returns {Promise<{ totalSent: number, totalFailed: number }>}
 */
async function broadcastToOrg(organizationId, payload) {
  if (!configureVAPID()) {
    return { totalSent: 0, totalFailed: 0 };
  }

  const { PushSubscription } = require('../models');
  const subscriptions = await PushSubscription.findAll({
    where: { organizationId, isActive: true }
  });

  const notifPayload = JSON.stringify({
    title: payload.title || 'Notification',
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192.png',
    url: payload.url || '/',
    tag: payload.tag || `broadcast-${Date.now()}`,
    timestamp: Date.now()
  });

  let totalSent = 0;
  let totalFailed = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        notifPayload,
        { TTL: 86400 }
      );
      totalSent++;
    } catch (err) {
      totalFailed++;
      if (err.statusCode === 410 || err.statusCode === 404) {
        await sub.update({ isActive: false });
      }
    }
  }

  return { totalSent, totalFailed };
}

/**
 * Enregistre un abonnement push pour un utilisateur.
 * Si l'endpoint existe déjà, met à jour les clés.
 * 
 * @param {string} userId
 * @param {string} organizationId  
 * @param {{ endpoint: string, keys: { p256dh: string, auth: string } }} subscription
 * @param {string} userAgent
 * @returns {Promise<PushSubscription>}
 */
async function subscribe(userId, organizationId, subscription, userAgent) {
  const { PushSubscription } = require('../models');

  // Upsert : si l'endpoint existe, mettre à jour
  const [pushSub, created] = await PushSubscription.findOrCreate({
    where: { endpoint: subscription.endpoint },
    defaults: {
      userId,
      organizationId,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      userAgent: userAgent?.substring(0, 500),
      isActive: true
    }
  });

  if (!created) {
    // Mettre à jour le mapping user + keys (cas: reconnexion)
    await pushSub.update({
      userId,
      organizationId,
      keys: subscription.keys,
      userAgent: userAgent?.substring(0, 500),
      isActive: true
    });
  }

  return pushSub;
}

/**
 * Désabonne un endpoint push.
 * 
 * @param {string} endpoint - L'URL du service push
 * @returns {Promise<boolean>}
 */
async function unsubscribe(endpoint) {
  const { PushSubscription } = require('../models');
  const result = await PushSubscription.destroy({ where: { endpoint } });
  return result > 0;
}

/**
 * Retourne la clé publique VAPID pour le frontend.
 */
function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

module.exports = {
  configureVAPID,
  sendPushToUser,
  broadcastToOrg,
  subscribe,
  unsubscribe,
  getVapidPublicKey
};
