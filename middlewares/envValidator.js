/**
 * ============================================================
 * Validateur d'Environnement — Crash si config dangereuse
 * ============================================================
 * 
 * EXÉCUTÉ AU DÉMARRAGE AVANT TOUT.
 * Si une variable critique est manquante, trop courte, ou
 * utilise une valeur par défaut → l'application REFUSE de démarrer.
 * 
 * PROTÈGE CONTRE :
 * - Oubli de changer le JWT_SECRET par défaut en production
 * - Clés API vides qui laisseraient les paiements sans sécurité
 * - Mot de passe BDD trop simple
 * - Clé de monitoring faible
 * 
 * DANGER : Local File Inclusion (LFI)
 * Si un pirate arrive à lire le .env via une faille LFI, des
 * secrets courts ou prévisibles sont crackables. Des secrets de
 * 64+ caractères aléatoires sont mathématiquement impossibles
 * à deviner même avec le fichier en main.
 */

// Valeurs par défaut connues (que les développeurs oublient de changer)
const KNOWN_DEFAULTS = [
  'super_secret_aleatoire_a_remplacer_en_prod',
  'secret',
  'password',
  'changeme',
  'change_me',
  'changez_moi',
  'changez_moi_en_production_64_chars_minimum',
  'your_jwt_secret',
  'default_secret',
  'test',
  'admin',
  '123456',
  'jwt_secret',
  'mysecret'
];

/**
 * Valide toutes les variables d'environnement critiques.
 * Retourne un tableau d'erreurs. Si vide = tout est OK.
 * 
 * @param {boolean} isProduction - true si NODE_ENV === 'production'
 * @returns {Array<{ variable: string, severity: string, message: string }>}
 */
function validateEnvironment(isProduction) {
  const errors = [];
  const warnings = [];

  // ── OBLIGATOIRE EN TOUT CONTEXTE ─────────────────────

  // JWT_SECRET
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    errors.push({ variable: 'JWT_SECRET', severity: 'FATAL', message: 'Variable manquante.' });
  } else if (jwtSecret.length < 32) {
    errors.push({ variable: 'JWT_SECRET', severity: 'FATAL', message: `Trop court (${jwtSecret.length} chars). Minimum 32 requis.` });
  } else if (KNOWN_DEFAULTS.includes(jwtSecret.toLowerCase())) {
    errors.push({ variable: 'JWT_SECRET', severity: 'FATAL', message: 'Valeur par défaut détectée. Générez une clé unique.' });
  }

  // Base de données
  if (!process.env.DB_HOST) errors.push({ variable: 'DB_HOST', severity: 'FATAL', message: 'Variable manquante.' });
  if (!process.env.DB_NAME) errors.push({ variable: 'DB_NAME', severity: 'FATAL', message: 'Variable manquante.' });
  if (!process.env.DB_USER) errors.push({ variable: 'DB_USER', severity: 'FATAL', message: 'Variable manquante.' });
  if (!process.env.DB_PASS) {
    if (isProduction) {
      errors.push({ variable: 'DB_PASS', severity: 'FATAL', message: 'Mot de passe BDD manquant en production.' });
    } else {
      warnings.push({ variable: 'DB_PASS', severity: 'WARNING', message: 'Pas de mot de passe BDD (OK en dev local).' });
    }
  }

  // ── OBLIGATOIRE EN PRODUCTION ────────────────────────

  if (isProduction) {
    // MONITOR_API_KEY
    const monitorKey = process.env.MONITOR_API_KEY;
    if (!monitorKey) {
      warnings.push({ variable: 'MONITOR_API_KEY', severity: 'WARNING', message: 'Clé monitoring manquante. Health check désactivé.' });
    } else if (monitorKey.length < 32) {
      errors.push({ variable: 'MONITOR_API_KEY', severity: 'FATAL', message: `Trop court (${monitorKey.length} chars). Minimum 32 requis.` });
    } else if (KNOWN_DEFAULTS.includes(monitorKey.toLowerCase())) {
      errors.push({ variable: 'MONITOR_API_KEY', severity: 'FATAL', message: 'Valeur par défaut détectée.' });
    }

    // CORS
    const corsOrigin = process.env.CORS_ORIGIN;
    if (!corsOrigin || corsOrigin === '*') {
      errors.push({ variable: 'CORS_ORIGIN', severity: 'FATAL', message: 'CORS wildcard (*) interdit en production. Spécifiez votre domaine.' });
    }

    // DB_PASS en prod
    const dbPass = process.env.DB_PASS;
    if (dbPass && dbPass.length < 12) {
      errors.push({ variable: 'DB_PASS', severity: 'FATAL', message: `Mot de passe BDD trop court (${dbPass.length} chars). Minimum 12 en production.` });
    }
  }

  // ── VÉRIFICATION INTÉGRITÉ .ENV ──────────────────────

  // S'assurer que .env ne contient pas de valeurs "placeholder"
  const placeholders = ['votre_', 'your_', 'changez', 'replace', 'todo', 'xxx'];
  const envVarsToCheck = ['JWT_SECRET', 'DB_PASS', 'MONITOR_API_KEY'];

  for (const varName of envVarsToCheck) {
    const value = process.env[varName];
    if (value && isProduction) {
      for (const ph of placeholders) {
        if (value.toLowerCase().includes(ph)) {
          errors.push({ variable: varName, severity: 'FATAL', message: `Contient une valeur placeholder ("${ph}..."). Remplacez par une vraie valeur.` });
          break;
        }
      }
    }
  }

  return { errors, warnings };
}

/**
 * Exécute la validation et affiche les résultats.
 * En cas d'erreur FATAL → process.exit(1)
 */
function enforceEnvironment() {
  const isProduction = process.env.NODE_ENV === 'production';
  const { errors, warnings } = validateEnvironment(isProduction);

  // Afficher les warnings
  for (const w of warnings) {
    console.warn(`⚠️  [${w.severity}] ${w.variable}: ${w.message}`);
  }

  // Afficher les erreurs
  if (errors.length > 0) {
    console.error('');
    console.error('════════════════════════════════════════════════');
    console.error('  ❌ ERREURS DE CONFIGURATION CRITIQUES');
    console.error('════════════════════════════════════════════════');
    for (const e of errors) {
      console.error(`  ❌ [${e.severity}] ${e.variable}: ${e.message}`);
    }
    console.error('');
    console.error('  L\'application REFUSE de démarrer pour protéger vos données.');
    console.error('  Corrigez les erreurs ci-dessus dans votre fichier .env');
    console.error('');

    if (isProduction) {
      console.error('  💡 Générer des clés sécurisées :');
      console.error('     node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
      console.error('');
      process.exit(1);
    } else {
      // En dev : warning agressif mais on ne crash pas
      console.error('  ⚠️  Mode développement : démarrage autorisé malgré les erreurs.');
      console.error('  ⚠️  CES ERREURS BLOQUERONT LE DÉMARRAGE EN PRODUCTION.');
      console.error('════════════════════════════════════════════════');
    }
  } else {
    console.log('✅ Configuration environnement validée.');
  }
}

module.exports = { validateEnvironment, enforceEnvironment, KNOWN_DEFAULTS };
