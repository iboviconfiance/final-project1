const BaseProvider = require('../BaseProvider');
const crypto = require('crypto');

/**
 * ============================================================
 * Airtel Money Congo-Brazzaville — Driver de paiement direct
 * ============================================================
 * 
 * Intégration directe avec l'API Airtel Money Africa.
 * Endpoint : https://openapi.airtel.africa
 * 
 * Préfixes concernés : +242 05xxxxxxx
 */
class AirtelCongoProvider extends BaseProvider {
  constructor() {
    super({
      name: 'airtel-congo',
      apiUrl: process.env.AIRTEL_CONGO_API_URL || 'https://openapi.airtel.africa',
      clientId: process.env.AIRTEL_CONGO_CLIENT_ID,
      clientSecret: process.env.AIRTEL_CONGO_CLIENT_SECRET,
      webhookSecret: process.env.AIRTEL_CONGO_WEBHOOK_SECRET || ''
    });
  }

  async initiate({ phoneNumber, amount, currency, externalRef, metadata }) {
    const referenceId = crypto.randomUUID();

    try {
      // Structure de la requête Airtel Money Collection API
      const requestBody = {
        reference: externalRef,
        subscriber: {
          country: 'CG',
          currency: currency || 'XAF',
          msisdn: phoneNumber.replace('+242', '')
        },
        transaction: {
          amount: amount,
          country: 'CG',
          currency: currency || 'XAF',
          id: referenceId
        }
      };

      // ──────────────────────────────────────────────────────────
      // TODO PRODUCTION : Remplacer par l'appel HTTP réel
      // ──────────────────────────────────────────────────────────
      // const token = await this._getAccessToken();
      // const response = await fetch(
      //   `${this.config.apiUrl}/merchant/v1/payments/`,
      //   {
      //     method: 'POST',
      //     headers: {
      //       'Authorization': `Bearer ${token}`,
      //       'Content-Type': 'application/json',
      //       'X-Country': 'CG',
      //       'X-Currency': 'XAF'
      //     },
      //     body: JSON.stringify(requestBody)
      //   }
      // );
      // ──────────────────────────────────────────────────────────

      return {
        providerRef: referenceId,
        status: 'pending',
        rawResponse: { referenceId, requestBody }
      };
    } catch (error) {
      console.error('[Airtel-Congo] Erreur initiate:', error);
      throw new Error(`Erreur Airtel Money: ${error.message}`);
    }
  }

  async getStatus(providerRef) {
    try {
      // TODO PRODUCTION :
      // GET {apiUrl}/standard/v1/payments/{providerRef}
      return {
        status: 'pending',
        rawResponse: {}
      };
    } catch (error) {
      throw new Error(`Erreur vérification Airtel: ${error.message}`);
    }
  }

  validateSignature(req) {
    const signature = req.headers['x-airtel-signature'] || req.headers['authorization'];
    if (!signature || !this.config.webhookSecret) return false;

    const payload = req.rawBody || Buffer.from(JSON.stringify(req.body));
    const expectedSignature = crypto
      .createHmac('sha512', this.config.webhookSecret)  // Airtel utilise SHA-512
      .update(payload)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch {
      return false;
    }
  }

  verifyWebhookSource(req) {
    if (process.env.NODE_ENV === 'development') return true;

    const clientIP = req.ip || req.connection?.remoteAddress || '';
    const allowedIPs = this.getAllowedIPs();
    return allowedIPs.some(ip => clientIP.includes(ip));
  }

  parseWebhookPayload(req) {
    const body = req.body;
    const txn = body.transaction || {};
    return {
      providerRef: txn.id || txn.airtel_money_id,
      externalRef: body.reference || txn.reference,
      status: this._mapStatus(txn.status_code || body.status),
      amount: parseFloat(txn.amount || body.amount),
      phoneNumber: body.subscriber?.msisdn,
      webhookId: txn.airtel_money_id || `airtel-${txn.id}-${Date.now()}`,
      timestamp: new Date(body.timestamp || Date.now()),
      rawData: body
    };
  }

  getAllowedIPs() {
    return [
      '41.223.58.',       // Airtel Africa Gateway
      '196.46.192.',      // Airtel Congo
      '102.134.0.',       // Airtel Cloud
      '154.73.32.'        // Airtel Africa backbone
    ];
  }

  _mapStatus(airtelStatus) {
    const statusMap = {
      'TS': 'success',        // Transaction Success
      'TF': 'failed',         // Transaction Failed
      'TA': 'pending',        // Transaction Ambiguous
      'TIP': 'pending',       // Transaction In Progress
      'success': 'success',
      'failed': 'failed'
    };
    return statusMap[airtelStatus] || 'pending';
  }
}

module.exports = AirtelCongoProvider;
