/**
 * ============================================================
 * Encryption Service — Chiffrement AES-256-GCM
 * ============================================================
 * 
 * Chiffre/déchiffre les données sensibles (numéro MoMo, etc.)
 * avec AES-256-GCM — le standard gold pour le chiffrement symétrique.
 * 
 * SÉCURITÉ :
 * - Utilise `crypto` natif Node.js (zéro dépendance externe)
 * - Chaque chiffrement utilise un IV unique (12 bytes)
 * - Authentification intégrée via GCM (anti-tampering)
 * - Clé dérivée de ENCRYPTION_KEY via scrypt (résistant au brute-force)
 * 
 * ⚠️ IMPORTANT :
 * Si ENCRYPTION_KEY est perdue, les données chiffrées sont IRRÉCUPÉRABLES.
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;          // 96 bits — optimal pour GCM
const AUTH_TAG_LENGTH = 16;    // 128 bits
const SALT = 'subflow-saas-encryption-salt-v1'; // Salt fixe (la clé dans .env est déjà unique)
const KEY_LENGTH = 32;         // 256 bits

// ============================================================
// DÉRIVATION DE CLÉ
// ============================================================

let derivedKey = null;

/**
 * Dérive une clé de chiffrement à partir de ENCRYPTION_KEY.
 * Utilise scrypt (résistant aux attaques par rainbow table et GPU).
 */
function getDerivedKey() {
  if (derivedKey) return derivedKey;

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey || encryptionKey.length < 16) {
    throw new Error(
      'ENCRYPTION_KEY manquante ou trop courte (min 16 caractères). ' +
      'Générez-en une avec : node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  derivedKey = crypto.scryptSync(encryptionKey, SALT, KEY_LENGTH);
  return derivedKey;
}

// ============================================================
// CHIFFREMENT / DÉCHIFFREMENT
// ============================================================

/**
 * Chiffre un texte en clair avec AES-256-GCM.
 * 
 * @param {string} plaintext - Le texte à chiffrer
 * @returns {{ encrypted: string, iv: string, authTag: string }}
 *          Données chiffrées encodées en hex
 */
function encrypt(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('Le texte à chiffrer doit être une chaîne non vide.');
  }

  const key = getDerivedKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

/**
 * Déchiffre des données chiffrées avec AES-256-GCM.
 * 
 * @param {{ encrypted: string, iv: string, authTag: string }} data
 * @returns {string} Le texte en clair
 * @throws {Error} Si les données ont été altérées (authTag invalide)
 */
function decrypt(data) {
  if (!data || !data.encrypted || !data.iv || !data.authTag) {
    throw new Error('Données de chiffrement incomplètes (encrypted, iv, authTag requis).');
  }

  const key = getDerivedKey();
  const iv = Buffer.from(data.iv, 'hex');
  const authTag = Buffer.from(data.authTag, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Masque un numéro de téléphone pour affichage.
 * Ex: "+242065551234" → "****1234"
 * 
 * @param {string} phoneNumber - Le numéro en clair
 * @returns {string} Le numéro masqué
 */
function maskPhoneNumber(phoneNumber) {
  if (!phoneNumber || phoneNumber.length < 4) return '****';
  const lastFour = phoneNumber.slice(-4);
  return `****${lastFour}`;
}

/**
 * Chiffre un numéro MoMo et retourne l'objet complet à stocker en BDD.
 * Inclut le numéro masqué pour affichage sans déchiffrement.
 * 
 * @param {string} phoneNumber - Le numéro MoMo en clair
 * @returns {{ encrypted: string, iv: string, authTag: string, maskedNumber: string }}
 */
function encryptPaymentMethod(phoneNumber) {
  const encryptedData = encrypt(phoneNumber);
  return {
    ...encryptedData,
    maskedNumber: maskPhoneNumber(phoneNumber)
  };
}

/**
 * Déchiffre un numéro MoMo stocké en BDD.
 * 
 * @param {{ encrypted: string, iv: string, authTag: string }} data
 * @returns {string} Le numéro MoMo en clair
 */
function decryptPaymentMethod(data) {
  return decrypt(data);
}

module.exports = {
  encrypt,
  decrypt,
  maskPhoneNumber,
  encryptPaymentMethod,
  decryptPaymentMethod
};
