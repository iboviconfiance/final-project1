const BaseProvider = require('../BaseProvider');
const crypto = require('crypto');

/**
 * ============================================================
 * MTN MoMo Congo-Brazzaville — Driver de paiement direct
 * ============================================================
 * 
 * Intégration directe avec l'API MTN Mobile Money (MoMo API).
 * Endpoint sandbox : https://sandbox.momoapi.mtn.com
 * Endpoint production : https://momoapi.mtn.com
 * 
 * Préfixes concernés : +242 06xxxxxxx
 */
class MtnCongoProvider extends BaseProvider {
  constructor() {
    super({
      name: 'mtn-congo',
      apiUrl: process.env.MTN_CONGO_API_URL || 'https://sandbox.momoapi.mtn.com',
      apiKey: process.env.MTN_CONGO_API_KEY,
      apiSecret: process.env.MTN_CONGO_API_SECRET,
      webhookSecret: process.env.MTN_CONGO_WEBHOOK_SECRET || '',
      subscriptionKey: process.env.MTN_CONGO_SUBSCRIPTION_KEY
    });
  }

  async initiate({ phoneNumber, amount, currency, externalRef, metadata }) {
    const referenceId = crypto.randomUUID();

    try {
      // Structure de la requête MTN MoMo Collection API v1.0
      const requestBody = {
        amount: String(amount),
        currency: currency || 'XAF',
        externalId: externalRef,
        payer: {
          partyIdType: 'MSISDN',
          partyId: phoneNumber.replace('+', '')
        },
        payerMessage: metadata.description || 'Paiement abonnement',
        payeeNote: `Ref: ${externalRef}`
      };

      // ──────────────────────────────────────────────────────────
      // TODO PRODUCTION : Remplacer par l'appel HTTP réel
      // ──────────────────────────────────────────────────────────
      // const token = await this._getAccessToken();
      // const response = await fetch(
      //   `${this.config.apiUrl}/collection/v1_0/requesttopay`,
      //   {
      //     method: 'POST',
      //     headers: {
      //       'Authorization': `Bearer ${token}`,
      //       'X-Reference-Id': referenceId,
      //       'X-Target-Environment': process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
      //       'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
      //       'Content-Type': 'application/json'
      //     },
      //     body: JSON.stringify(requestBody)
      //   }
      // );
      // if (!response.ok) throw new Error(`MTN API error: ${response.status}`);
      // ──────────────────────────────────────────────────────────

      return {
        providerRef: referenceId,
        status: 'pending',
        rawResponse: { referenceId, requestBody }
      };
    } catch (error) {
      console.error('[MTN-Congo] Erreur initiate:', error);
      throw new Error(`Erreur MTN MoMo: ${error.message}`);
    }
  }

  async getStatus(providerRef) {
    try {
      // TODO PRODUCTION :
      // GET {apiUrl}/collection/v1_0/requesttopay/{providerRef}
      return {
        status: 'pending',
        rawResponse: {}
      };
    } catch (error) {
      throw new Error(`Erreur vérification MTN: ${error.message}`);
    }
  }

  validateSignature(req) {
    const signature = req.headers['x-momo-signature'] || req.headers['x-callback-signature'];
    if (!signature || !this.config.webhookSecret) return false;

    // Utiliser le rawBody pour un calcul HMAC fidèle au payload original
    const payload = req.rawBody || Buffer.from(JSON.stringify(req.body));
    const expectedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(payload)
      .digest('hex');

    // Comparaison en temps constant — immunisé contre les timing attacks
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch {
      return false; // Longueurs différentes = signature invalide
    }
  }

  verifyWebhookSource(req) {
    // En développement, autoriser toutes les IPs (localhost, etc.)
    if (process.env.NODE_ENV === 'development') return true;

    const clientIP = req.ip || req.connection?.remoteAddress || '';
    const allowedIPs = this.getAllowedIPs();
    return allowedIPs.some(ip => clientIP.includes(ip));
  }

  parseWebhookPayload(req) {
    const body = req.body;
    return {
      providerRef: body.referenceId || body.externalId,
      externalRef: body.externalId,
      status: this._mapStatus(body.status),
      amount: parseFloat(body.amount),
      phoneNumber: body.payer?.partyId,
      webhookId: body.financialTransactionId || `mtn-${body.referenceId}-${Date.now()}`,
      timestamp: new Date(body.timestamp || Date.now()),
      rawData: body
    };
  }

  getAllowedIPs() {
    return [
      '196.201.68.',      // MTN API Gateway (Congo)
      '41.223.176.',      // MTN Africa backbone
      '102.176.160.',     // MTN Cloud Services
      '196.12.131.'       // MTN Congo direct
    ];
  }

  /**
   * Mappe les statuts MTN vers nos statuts internes
   */
  _mapStatus(mtnStatus) {
    const statusMap = {
      'SUCCESSFUL': 'success',
      'FAILED': 'failed',
      'PENDING': 'pending',
      'EXPIRED': 'failed',
      'REJECTED': 'failed'
    };
    return statusMap[mtnStatus] || 'pending';
  }
}

module.exports = MtnCongoProvider;
