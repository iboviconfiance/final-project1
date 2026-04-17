/**
 * Détection automatique de l'opérateur télécom à partir du numéro.
 * Basé sur les préfixes Congolais (Congo-Brazzaville).
 * 
 * MTN Congo  : 04, 05, 06
 * Airtel Congo: 01, 02, 03, 07
 */

const MTN_PREFIXES = ['04', '05', '06'];
const AIRTEL_PREFIXES = ['01', '02', '03', '07'];

/**
 * Détecte l'opérateur à partir du numéro de téléphone.
 * @param {string} phone - Numéro de téléphone (local ou international)
 * @returns {{ operator: 'mtn'|'airtel'|'unknown', formatted: string }}
 */
export function detectOperator(phone) {
  if (!phone || typeof phone !== 'string') {
    return { operator: 'unknown', formatted: phone || '' };
  }

  // Nettoyer le numéro
  let cleaned = phone.replace(/[\s\-\.\(\)]/g, '');

  // Retirer le préfixe international du Congo
  if (cleaned.startsWith('+242')) {
    cleaned = cleaned.substring(4);
  } else if (cleaned.startsWith('00242')) {
    cleaned = cleaned.substring(5);
  } else if (cleaned.startsWith('242') && cleaned.length > 9) {
    cleaned = cleaned.substring(3);
  }

  const prefix = cleaned.substring(0, 2);

  if (MTN_PREFIXES.includes(prefix)) {
    return { operator: 'mtn', formatted: cleaned };
  }

  if (AIRTEL_PREFIXES.includes(prefix)) {
    return { operator: 'airtel', formatted: cleaned };
  }

  return { operator: 'unknown', formatted: cleaned };
}

/**
 * Formatte un numéro de téléphone congolais.
 * Ex: 068901234 → 06 890 12 34
 */
export function formatPhoneNumber(phone) {
  const { formatted } = detectOperator(phone);
  if (formatted.length < 9) return phone;

  return `${formatted.substring(0, 2)} ${formatted.substring(2, 5)} ${formatted.substring(5, 7)} ${formatted.substring(7)}`;
}

/**
 * Retourne les infos de l'opérateur pour l'UI.
 */
export function getOperatorInfo(operator) {
  const operators = {
    mtn: {
      name: 'MTN Mobile Money',
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10 border-yellow-500/30',
      shortName: 'MTN MoMo',
    },
    airtel: {
      name: 'Airtel Money',
      color: 'text-rose-400',
      bg: 'bg-rose-500/10 border-rose-500/30',
      shortName: 'Airtel Money',
    },
    unknown: {
      name: 'Opérateur inconnu',
      color: 'text-dark-400',
      bg: 'bg-dark-700 border-dark-600',
      shortName: 'Inconnu',
    },
  };
  return operators[operator] || operators.unknown;
}
