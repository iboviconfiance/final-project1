const BaseProvider = require('../BaseProvider');
const crypto = require('crypto');

/**
 * ============================================================
 * Agrégateur de paiement (CinetPay / Flutterwave)
 * ============================================================
 * 
 * Fallback provider pour les pays/opérateurs sans intégration directe.
 * Un agrégateur supporte plusieurs opérateurs et pays via une seule API.
 * 
 * CinetPay couvre : CI, SN, CM, BF, ML, GN, TD, CG, GA, BJ, TG, NE, etc.
 */
class AggregatorProvider extends BaseProvider {
  constructor() {
    super({
      name: 'aggregator',
      apiUrl: process.env.AGGREGATOR_API_URL || 'https://api-checkout.cinetpay.com/v2',
      apiKey: process.env.AGGREGATOR_API_KEY,
      siteId: process.env.AGGREGATOR_SITE_ID,
      webhookSecret: process.env.AGGREGATOR_WEBHOOK_SECRET || ''
    });
  }

  async initiate({ phoneNumber, amount, currency, externalRef, metadata }) {
    try {
      // Structure CinetPay Payment API
      const requestBody = {
        apikey: this.config.apiKey,
        site_id: this.config.siteId,
        transaction_id: externalRef,
        amount: parseInt(amount),
        currency: currency || 'XAF',
        description: metadata.description || 'Paiement abonnement',
        notify_url: process.env.WEBHOOK_BASE_URL + '/api/webhooks/aggregator',
        return_url: process.env.FRONTEND_URL || 'http://localhost:3000',
        channels: 'MOBILE_MONEY',
        customer_phone_number: phoneNumber.replace('+', ''),
        customer_name: metadata.customerName || 'Client',
        customer_email: metadata.customerEmail || '',
        metadata: JSON.stringify(metadata)
      };

      // ──────────────────────────────────────────────────────────
      // TODO PRODUCTION : Appel HTTP réel
      // ──────────────────────────────────────────────────────────
      // const response = await fetch(
      //   `${this.config.apiUrl}/payment`,
      //   {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify(requestBody)
      //   }
      // );
      // const data = await response.json();
      // ──────────────────────────────────────────────────────────

      return {
        providerRef: externalRef, // CinetPay utilise notre ref comme la sienne
        status: 'pending',
        rawResponse: { requestBody }
      };
    } catch (error) {
      console.error('[Aggregator] Erreur initiate:', error);
      throw new Error(`Erreur agrégateur: ${error.message}`);
    }
  }

  async getStatus(providerRef) {
    try {
      // TODO PRODUCTION :
      // POST {apiUrl}/payment/check
      // Body: { apikey, site_id, transaction_id: providerRef }
      return {
        status: 'pending',
        rawResponse: {}
      };
    } catch (error) {
      throw new Error(`Erreur vérification agrégateur: ${error.message}`);
    }
  }

  validateSignature(req) {
    // CinetPay envoie un token de vérification dans le body
    const signature = req.headers['x-cinetpay-signature'] || req.headers['x-token'];
    if (!signature || !this.config.webhookSecret) return false;

    const payload = req.rawBody || Buffer.from(JSON.stringify(req.body));
    const expectedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
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
    return {
      providerRef: body.cpm_trans_id || body.transaction_id,
      externalRef: body.cpm_custom || body.transaction_id,
      status: this._mapStatus(body.cpm_result || body.status),
      amount: parseFloat(body.cpm_amount || body.amount),
      phoneNumber: body.cpm_phone_prefixed || body.customer_phone_number,
      webhookId: body.cpm_trans_id || `agg-${body.transaction_id}-${Date.now()}`,
      timestamp: new Date(body.cpm_trans_date || Date.now()),
      rawData: body
    };
  }

  getAllowedIPs() {
    return [
      '165.22.0.',        // CinetPay Cloud (DigitalOcean)
      '134.209.',         // CinetPay secondary
      '159.89.',          // CinetPay tertiary
      '41.207.181.'       // CinetPay Côte d'Ivoire
    ];
  }

  _mapStatus(cinetPayResult) {
    const statusMap = {
      '00': 'success',       // Paiement réussi
      'ACCEPTED': 'success',
      'REFUSED': 'failed',
      'ERROR': 'failed',
      '600': 'failed',       // Échec
      'PENDING': 'pending'
    };
    return statusMap[cinetPayResult] || 'pending';
  }
}

module.exports = AggregatorProvider;
