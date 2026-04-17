/**
 * ============================================================
 * BaseProvider — Classe abstraite pour tous les fournisseurs de paiement
 * ============================================================
 * 
 * Tout nouveau provider (Orange Cameroun, M-Pesa Kenya, etc.)
 * DOIT hériter de cette classe et implémenter TOUTES les méthodes.
 * 
 * C'est le "contrat" que chaque driver doit respecter pour être
 * compatible avec le PaymentManager.
 */

class BaseProvider {
  /**
   * @param {object} config
   * @param {string} config.name - Identifiant unique du provider (ex: 'mtn-congo')
   * @param {string} config.apiUrl - URL de l'API du provider
   * @param {string} config.webhookSecret - Clé secrète pour la validation HMAC
   */
  constructor(config) {
    if (new.target === BaseProvider) {
      throw new Error(
        'BaseProvider est une classe abstraite. ' +
        'Créez un provider spécifique qui en hérite.'
      );
    }
    this.name = config.name;
    this.config = config;
  }

  // ============================================================
  // MÉTHODES À IMPLÉMENTER PAR CHAQUE PROVIDER
  // ============================================================

  /**
   * Initie un paiement Mobile Money auprès de l'opérateur.
   * 
   * @param {object} params
   * @param {string} params.phoneNumber - Numéro de téléphone du payeur
   * @param {number} params.amount - Montant à débiter
   * @param {string} params.currency - Devise (ex: 'XAF')
   * @param {string} params.externalRef - Référence unique interne (notre Transaction.id)
   * @param {object} params.metadata - Données supplémentaires
   * @returns {Promise<{ providerRef: string, status: string, rawResponse: object }>}
   */
  async initiate(params) {
    throw new Error(`[${this.name}] initiate() non implémenté.`);
  }

  /**
   * Vérifie le statut d'une transaction auprès du provider.
   * Utilisé pour le polling ou la vérification manuelle.
   * 
   * @param {string} providerRef - Référence unique du provider
   * @returns {Promise<{ status: string, rawResponse: object }>}
   */
  async getStatus(providerRef) {
    throw new Error(`[${this.name}] getStatus() non implémenté.`);
  }

  /**
   * Valide la signature HMAC d'un webhook entrant.
   * Chaque provider utilise un algorithme et un header différent.
   * 
   * CRITIQUE : Doit utiliser crypto.timingSafeEqual() pour éviter
   * les attaques par timing (side-channel).
   * 
   * @param {object} req - L'objet Express Request (avec req.rawBody)
   * @returns {boolean} true si la signature est valide
   */
  validateSignature(req) {
    throw new Error(`[${this.name}] validateSignature() non implémenté.`);
  }

  /**
   * Vérifie que la requête webhook provient d'une IP autorisée.
   * 
   * @param {object} req - L'objet Express Request
   * @returns {boolean} true si l'IP source est dans la whitelist
   */
  verifyWebhookSource(req) {
    throw new Error(`[${this.name}] verifyWebhookSource() non implémenté.`);
  }

  /**
   * Extrait et normalise les données d'un webhook en un format standard.
   * Chaque provider envoie les données dans un format différent,
   * cette méthode les convertit en un objet uniforme.
   * 
   * @param {object} req - L'objet Express Request
   * @returns {{ 
   *   providerRef: string, 
   *   externalRef: string,
   *   status: string, 
   *   amount: number, 
   *   phoneNumber: string, 
   *   webhookId: string, 
   *   timestamp: Date, 
   *   rawData: object 
   * }}
   */
  parseWebhookPayload(req) {
    throw new Error(`[${this.name}] parseWebhookPayload() non implémenté.`);
  }

  /**
   * Retourne les plages d'IP autorisées pour les webhooks de ce provider.
   * Utilisé par verifyWebhookSource() pour le filtrage.
   * 
   * @returns {string[]} Liste d'IPs ou de plages CIDR
   */
  getAllowedIPs() {
    throw new Error(`[${this.name}] getAllowedIPs() non implémenté.`);
  }
}

module.exports = BaseProvider;
