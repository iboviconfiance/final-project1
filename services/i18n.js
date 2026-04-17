/**
 * ============================================================
 * i18n — Service d'Internationalisation Minimaliste
 * ============================================================
 * 
 * Gère les traductions FR/EN pour les messages API.
 * Structure prête pour ajouter d'autres langues.
 * 
 * UTILISATION :
 *   const { t } = require('./services/i18n');
 * 
 *   // Dans un contrôleur :
 *   res.json({ message: t('auth.login_success', req.lang) });
 * 
 *   // Avec variables :
 *   t('sub.expires_in', 'fr', { days: 3 }); → "Expire dans 3 jour(s)"
 * 
 * DÉTECTION DE LANGUE :
 *   1. Header Accept-Language
 *   2. Query string ?lang=en
 *   3. User preference (future)
 *   4. Fallback → 'fr'
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// CHARGEMENT DES FICHIERS DE LANGUE
// ============================================================

const localesDir = path.join(__dirname, '..', 'locales');
const locales = {};

/**
 * Charge tous les fichiers .json du dossier locales/
 */
function loadLocales() {
  if (!fs.existsSync(localesDir)) {
    console.warn('⚠️ i18n: Dossier locales/ introuvable. Utilisation du français par défaut.');
    return;
  }

  const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const lang = path.basename(file, '.json');
    try {
      const content = fs.readFileSync(path.join(localesDir, file), 'utf8');
      locales[lang] = JSON.parse(content);
      console.log(`🌐 i18n: Langue "${lang}" chargée (${Object.keys(flattenObject(locales[lang])).length} clés).`);
    } catch (err) {
      console.error(`❌ i18n: Erreur de chargement pour "${file}":`, err.message);
    }
  }
}

/**
 * Aplatit un objet imbriqué pour compter les clés.
 * { auth: { login: "..." } } → { "auth.login": "..." }
 */
function flattenObject(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, fullKey));
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}

// ============================================================
// FONCTION DE TRADUCTION
// ============================================================

/**
 * Traduit une clé avec remplacement de variables.
 * 
 * @param {string} key - Clé de traduction (ex: 'auth.login_success')
 * @param {string} lang - Code langue ('fr', 'en')
 * @param {object} variables - Variables à remplacer (ex: { days: 3 })
 * @returns {string} Le texte traduit
 */
function t(key, lang = 'fr', variables = {}) {
  // Fallback sur le français si la langue n'existe pas
  const translations = locales[lang] || locales['fr'] || {};

  // Naviguer dans l'objet imbriqué avec la clé pointée
  const keys = key.split('.');
  let value = translations;
  for (const k of keys) {
    if (value && typeof value === 'object') {
      value = value[k];
    } else {
      value = undefined;
      break;
    }
  }

  // Si la clé n'existe pas, retourner la clé elle-même (debug)
  if (value === undefined || typeof value !== 'string') {
    return key;
  }

  // Remplacer les variables : {{variable}}
  let result = value;
  for (const [varName, varValue] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${varName}\\}\\}`, 'g'), String(varValue));
  }

  return result;
}

// ============================================================
// MIDDLEWARE DE DÉTECTION DE LANGUE
// ============================================================

/**
 * Middleware Express qui détecte la langue et l'ajoute à req.lang.
 * Priorité : query ?lang= > header Accept-Language > défaut 'fr'
 */
function langMiddleware(req, res, next) {
  // 1. Query string ?lang=en
  if (req.query.lang && locales[req.query.lang]) {
    req.lang = req.query.lang;
    return next();
  }

  // 2. Header Accept-Language (ex: "en-US,en;q=0.9,fr;q=0.8")
  const acceptLang = req.headers['accept-language'];
  if (acceptLang) {
    const preferred = acceptLang.split(',')
      .map(part => {
        const [lang] = part.trim().split(';');
        return lang.substring(0, 2).toLowerCase();
      })
      .find(lang => locales[lang]);

    if (preferred) {
      req.lang = preferred;
      return next();
    }
  }

  // 3. Défaut : français
  req.lang = 'fr';
  next();
}

/**
 * Retourne la liste des langues disponibles.
 */
function getAvailableLanguages() {
  return Object.keys(locales);
}

// ============================================================
// INITIALISATION
// ============================================================
loadLocales();

module.exports = { t, langMiddleware, getAvailableLanguages, loadLocales };
