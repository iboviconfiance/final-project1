const BaseProvider = require('../BaseProvider');
const crypto = require('crypto');

/**
 * ============================================================
 * MockProvider — Provider de test pour le développement local
 * ============================================================
 * 
 * Simule le comportement d'un paiement Mobile Money sans 
 * aucun appel réseau. Parfait pour les tests unitaires 
 * et le développement local.
 * 
 * Préfixes de test : +000 00xxxxxxx
 * 
 * Comportements simulés :
 *   - Numéro terminant par 0 : simule un ÉCHEC
 *   - Numéro terminant par 1-9 : simule un SUCCÈS après délai
 */
class MockProvider extends BaseProvider {
  constructor() {
    super({
      name: 'mock',
      apiUrl: 'http://localhost',
      webhookSecret: process.env.MOCK_WEBHOOK_SECRET || 'mock-secret-for-testing-only'
    });
  }

  async initiate({ phoneNumber, amount, currency, externalRef, metadata }) {
    const providerRef = `MOCK-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    // Simuler un échec si le numéro se termine par 0
    const lastDigit = phoneNumber.slice(-1);
    const simulatedStatus = lastDigit === '0' ? 'failed' : 'pending';

    console.log(`[MockProvider] 💳 Paiement initié: ${amount} ${currency || 'XAF'} depuis ${phoneNumber}`);
    console.log(`[MockProvider] 📋 Ref: ${providerRef} | Status: ${simulatedStatus}`);

    return {
      providerRef,
      status: simulatedStatus,
      rawResponse: {
        mock: true,
        phoneNumber,
        amount,
        currency: currency || 'XAF',
        externalRef,
        simulatedStatus
      }
    };
  }

  async getStatus(providerRef) {
    // Le mock retourne toujours success après initiation
    return {
      status: providerRef.includes('MOCK') ? 'success' : 'pending',
      rawResponse: { mock: true, providerRef }
    };
  }

  validateSignature(req) {
    const signature = req.headers['x-mock-signature'];

    // En mode test, accepter aussi sans signature
    if (process.env.NODE_ENV === 'development' && !signature) return true;

    if (!signature) return false;

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
    // Le mock accepte toutes les sources
    return true;
  }

  parseWebhookPayload(req) {
    const body = req.body;
    return {
      providerRef: body.providerRef,
      externalRef: body.externalRef,
      status: body.status || 'success',
      amount: parseFloat(body.amount || 0),
      phoneNumber: body.phoneNumber || '000000000',
      webhookId: body.webhookId || `mock-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      timestamp: new Date(body.timestamp || Date.now()),
      rawData: body
    };
  }

  getAllowedIPs() {
    return ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost'];
  }

  /**
   * UTILITAIRE DE TEST : Génère un faux webhook valide 
   * pour tester le flow complet en local.
   * 
   * @param {string} providerRef - La référence du provider
   * @param {string} externalRef - Notre référence interne (Transaction.id)
   * @param {string} status - 'success' ou 'failed'
   * @returns {{ body: object, headers: object }}
   */
  static generateTestWebhook(providerRef, externalRef, status = 'success') {
    const secret = process.env.MOCK_WEBHOOK_SECRET || 'mock-secret-for-testing-only';
    const body = {
      providerRef,
      externalRef,
      status,
      amount: 5000,
      phoneNumber: '000000001',
      webhookId: `mock-test-${Date.now()}`,
      timestamp: new Date().toISOString()
    };

    const signature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(body))
      .digest('hex');

    return {
      body,
      headers: {
        'Content-Type': 'application/json',
        'x-mock-signature': signature
      }
    };
  }
}

module.exports = MockProvider;
