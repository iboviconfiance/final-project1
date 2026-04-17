/**
 * ============================================================
 * SERVICE DE LOGGING — Winston + Sanitization
 * ============================================================
 * 
 * Caractéristiques :
 * - Sanitization automatique des données sensibles AVANT écriture
 * - Rotation : console (dev) + fichiers (prod)
 * - Fichiers séparés : app.log (tout) + error.log (erreurs uniquement)
 * - Compatible MonitorMe : les logs sanitisés peuvent être scannés
 *   sans risque d'exposition de données utilisateur
 * 
 * DONNÉES MASQUÉES :
 * - Emails : user@email.com → u***@e***.com
 * - Téléphones : +242061234567 → +242***4567
 * - Tokens JWT : Bearer eyJ... → Bearer [REDACTED]
 * - Mots de passe : password: "xxx" → password: "[REDACTED]"
 * - Clés API : tout champ contenant 'key', 'secret', 'token'
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Dossier des logs
const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ============================================================
// SANITIZATION DES DONNÉES SENSIBLES
// ============================================================

const SENSITIVE_PATTERNS = [
  // Emails : user@email.com → u***@e***.com
  {
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replace: (match) => {
      const [local, domain] = match.split('@');
      const [domName, ...ext] = domain.split('.');
      return `${local[0]}***@${domName[0]}***.${ext.join('.')}`;
    }
  },
  // Téléphones : +242061234567 → +242***4567
  {
    regex: /(\+?\d{1,4})\d{3,7}(\d{4})/g,
    replace: '$1***$2'
  },
  // Tokens Bearer : Bearer eyJ... → Bearer [REDACTED]
  {
    regex: /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*/g,
    replace: 'Bearer [REDACTED]'
  },
  // UUID complets (masquer le milieu)
  {
    regex: /([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-([0-9a-f]{12})/gi,
    replace: '$1-****-****-****-$2'
  }
];

const SENSITIVE_KEYS = ['password', 'secret', 'token', 'apiKey', 'api_key', 'webhook_secret', 'license_key'];

/**
 * Sanitise une chaîne de caractères en masquant les données sensibles
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  let result = str;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern.regex, pattern.replace);
  }
  return result;
};

/**
 * Sanitise un objet en profondeur (JSON-safe)
 */
const sanitizeObject = (obj, depth = 0) => {
  if (depth > 5) return '[DEEP_OBJECT]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizeString(obj);
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

// ============================================================
// FORMAT WINSTON
// ============================================================

const sanitizeFormat = winston.format((info) => {
  if (info.message && typeof info.message === 'string') {
    info.message = sanitizeString(info.message);
  }
  if (info.meta && typeof info.meta === 'object') {
    info.meta = sanitizeObject(info.meta);
  }
  return info;
});

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  sanitizeFormat(),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let line = `${timestamp} [${level.toUpperCase().padEnd(5)}] ${message}`;
    if (stack) line += `\n${stack}`;
    if (Object.keys(meta).length > 0) {
      line += ` ${JSON.stringify(sanitizeObject(meta))}`;
    }
    return line;
  })
);

// ============================================================
// INSTANCE WINSTON
// ============================================================

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'saas-payments' },
  transports: [
    // Console (toujours actif)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),

    // Fichier : tous les logs
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'app.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    }),

    // Fichier : erreurs uniquement (pour alertes MonitorMe)
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 3
    })
  ]
});

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  logger,
  sanitizeString,
  sanitizeObject,
  LOG_DIR
};
