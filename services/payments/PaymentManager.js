/**
 * ============================================================
 * PaymentManager — Routeur central de paiement
 * ============================================================
 * 
 * Pattern utilisé : Strategy + Factory + Singleton
 * 
 * Le PaymentManager :
 * 1. Charge dynamiquement tous les providers du dossier providers/
 * 2. Détecte automatiquement l'opérateur depuis le numéro de téléphone
 * 3. Route les paiements vers le bon driver
 * 4. Valide et traite les webhooks
 * 
 * Le contrôleur n'a AUCUNE connaissance du provider utilisé.
 * Il appelle simplement PaymentManager.initiatePayment() et le
 * routage est automatique.
 * 
 * EXTENSION INTERNATIONALE :
 * Pour ajouter un pays (ex: Gabon), il suffit de :
 * 1. Créer providers/AirtelGabonProvider.js (extends BaseProvider)
 * 2. Ajouter le pays dans config/providers.config.js
 * 3. Ajouter les clés API dans .env
 * → Aucune modification ici.
 */

const fs = require('fs');
const path = require('path');
const providersConfig = require('./config/providers.config');

class PaymentManager {
  constructor() {
    this.providers = {};
    this._loadProviders();
  }

  /**
   * Charge dynamiquement tous les fichiers *Provider.js
   * depuis le dossier providers/.
   * 
   * C'est ce mécanisme qui rend l'ajout d'un opérateur transparent :
   * il suffit de déposer le fichier et il sera automatiquement chargé.
   */
  _loadProviders() {
    const providersDir = path.join(__dirname, 'providers');

    if (!fs.existsSync(providersDir)) {
      console.warn('⚠️  PaymentManager: Dossier providers/ introuvable.');
      return;
    }

    const files = fs.readdirSync(providersDir)
      .filter(f => f.endsWith('Provider.js'));

    for (const file of files) {
      try {
        const ProviderClass = require(path.join(providersDir, file));
        const instance = new ProviderClass();
        this.providers[instance.name] = instance;
      } catch (error) {
        console.error(`⚠️  Erreur chargement provider ${file}:`, error.message);
      }
    }

    const names = Object.keys(this.providers);
    console.log(`💳 PaymentManager: ${names.length} provider(s) chargé(s) → [${names.join(', ')}]`);
  }

  /**
   * Retourne un provider par son nom.
   * @param {string} providerName - ex: 'mtn-congo', 'airtel-congo', 'mock'
   * @returns {BaseProvider|null}
   */
  getProvider(providerName) {
    return this.providers[providerName] || null;
  }

  /**
   * Liste tous les providers chargés.
   * @returns {string[]}
   */
  getAvailableProviders() {
    return Object.keys(this.providers);
  }

  /**
   * Détecte automatiquement le provider adapté au numéro de téléphone.
   * 
   * Algorithme :
   * 1. Normaliser le numéro (+242 06... → 24206...)
   * 2. Pour chaque pays dans la config, vérifier les préfixes
   * 3. Si match → retourner le provider correspondant
   * 4. Si aucun match → utiliser le fallback (agrégateur)
   * 
   * @param {string} phoneNumber - Numéro au format international
   * @returns {{ provider: BaseProvider, operator: object, country: object }|null}
   */
  detectProvider(phoneNumber) {
    const cleaned = phoneNumber.replace(/[\s\-\(\)\.]/g, '');
    const withoutPlus = cleaned.startsWith('+') ? cleaned.substring(1) : cleaned;

    // Parcourir chaque pays
    for (const [countryCode, countryConfig] of Object.entries(providersConfig)) {
      if (countryCode === 'fallback' || !countryConfig.operators) continue;

      const countryPrefix = countryConfig.countryCode.replace('+', '');

      for (const [operatorKey, operatorConfig] of Object.entries(countryConfig.operators)) {
        for (const prefix of operatorConfig.prefixes) {
          // Match avec indicatif pays (ex: 24206)
          const fullPrefix = countryPrefix + prefix;
          if (withoutPlus.startsWith(fullPrefix)) {
            const provider = this.providers[operatorKey];
            if (provider) {
              return { provider, operator: operatorConfig, country: countryConfig };
            }
          }
        }
      }
    }

    // Fallback → agrégateur
    const fallbackConfig = providersConfig.fallback;
    if (fallbackConfig) {
      // Chercher le provider dont la classe correspond au fallback
      const fallbackProvider = Object.values(this.providers).find(
        p => p.constructor.name === fallbackConfig.providerClass
      );
      if (fallbackProvider) {
        return {
          provider: fallbackProvider,
          operator: fallbackConfig,
          country: null
        };
      }
    }

    return null;
  }

  /**
   * Initie un paiement en routant automatiquement vers le bon provider.
   * Le contrôleur appelle cette méthode sans savoir quel opérateur sera utilisé.
   * 
   * @param {object} params
   * @param {string} params.phoneNumber - Numéro de téléphone du payeur
   * @param {number} params.amount - Montant
   * @param {string} params.currency - Devise
   * @param {string} params.externalRef - Notre référence interne (Transaction.id)
   * @param {object} params.metadata - Métadonnées
   * @returns {Promise<{ providerName: string, providerRef: string, status: string, rawResponse: object }>}
   */
  async initiatePayment({ phoneNumber, amount, currency, externalRef, metadata = {} }) {
    const detection = this.detectProvider(phoneNumber);

    if (!detection) {
      throw new Error(
        `Aucun opérateur de paiement trouvé pour le numéro : ${phoneNumber}. ` +
        `Vérifiez le format (ex: +242 06XXXXXXX).`
      );
    }

    const { provider, operator } = detection;

    console.log(`💳 Routage paiement → ${operator.displayName} (${provider.name})`);

    const result = await provider.initiate({
      phoneNumber,
      amount,
      currency,
      externalRef,
      metadata
    });

    return {
      providerName: provider.name,
      operatorDisplayName: operator.displayName,
      ...result
    };
  }

  /**
   * Traite un webhook entrant. Vérifie la source, la signature,
   * et extrait les données normalisées.
   * 
   * @param {string} providerName - Nom du provider (depuis l'URL)
   * @param {object} req - Express Request
   * @returns {Promise<object>} Données normalisées du webhook
   * @throws {Error} Si la source ou la signature est invalide
   */
  async processWebhook(providerName, req) {
    const provider = this.getProvider(providerName);

    if (!provider) {
      throw new Error(`Provider inconnu: ${providerName}`);
    }

    // COUCHE 1 : Vérification de l'IP source
    if (!provider.verifyWebhookSource(req)) {
      const ip = req.ip || req.connection?.remoteAddress;
      console.error(`🚫 Webhook rejeté (IP non autorisée): ${ip} pour ${providerName}`);
      throw new Error('SECURITY_IP_REJECTED');
    }

    // COUCHE 2 : Vérification de la signature HMAC
    if (!provider.validateSignature(req)) {
      console.error(`🚫 Webhook rejeté (signature invalide) pour ${providerName}`);
      throw new Error('SECURITY_SIGNATURE_INVALID');
    }

    // COUCHE 3 : Extraction des données normalisées
    const webhookData = provider.parseWebhookPayload(req);

    // COUCHE 4 : Vérification anti-replay (timestamp)
    const WEBHOOK_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes
    const webhookAge = Date.now() - new Date(webhookData.timestamp).getTime();
    if (webhookAge > WEBHOOK_MAX_AGE_MS) {
      console.error(`🚫 Webhook rejeté (trop ancien): ${webhookAge}ms pour ${providerName}`);
      throw new Error('SECURITY_REPLAY_DETECTED');
    }

    return webhookData;
  }
}

// Singleton — une seule instance partagée dans toute l'application
module.exports = new PaymentManager();
