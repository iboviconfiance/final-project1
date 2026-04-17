/**
 * ============================================================
 * Scanner Protection — Anti brute-force global + anti-scanner
 * ============================================================
 * 
 * POURQUOI UN SCANNER SE FAIT BANNIR :
 * 
 * Les outils comme Dirb, Gobuster, Nikto et Burp Spider envoient
 * des centaines de requêtes vers des URLs qui n'existent pas
 * (/admin, /wp-login, /phpmyadmin, /.env, etc.)
 * 
 * Un utilisateur normal génère 0-1 erreur 404.
 * Un scanner génère 50+ erreurs 404 en quelques secondes.
 * 
 * Ce middleware :
 * 1. Compte les réponses 404 par adresse IP
 * 2. Si une IP dépasse 15 erreurs 404 en 5 minutes → ban temporaire
 * 3. L'IP bannée reçoit un 429 sur TOUTES les routes (pas juste les 404)
 * 4. Le ban dure 15 minutes puis l'IP est libérée
 * 
 * RÉSULTAT :
 * - gobuster dir -u https://target → 15 requêtes puis blocage total
 * - nmap --script http-enum → bloqué rapidement
 * - Un utilisateur normal → jamais affecté
 */

// Stockage en mémoire des compteurs par IP
// En production avec cluster : utiliser Redis
const ipTracker = new Map();

// Configuration
const CONFIG = {
  MAX_404_COUNT: 15,          // 404 max avant ban
  WINDOW_MS: 5 * 60 * 1000,  // Fenêtre de 5 minutes
  BAN_DURATION_MS: 15 * 60 * 1000, // Ban de 15 minutes
  CLEANUP_INTERVAL_MS: 10 * 60 * 1000 // Nettoyage toutes les 10 min
};

// Nettoyage périodique de la mémoire
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of ipTracker.entries()) {
    // Supprimer les entrées expirées
    if (data.bannedUntil && now > data.bannedUntil) {
      ipTracker.delete(ip);
    } else if (now - data.firstSeen > CONFIG.WINDOW_MS && !data.bannedUntil) {
      ipTracker.delete(ip);
    }
  }
}, CONFIG.CLEANUP_INTERVAL_MS);

/**
 * Middleware principal : vérifie si l'IP est bannie AVANT toute route
 */
const scannerGuard = (req, res, next) => {
  const ip = req.ip || req.connection?.remoteAddress;
  const data = ipTracker.get(ip);

  if (data && data.bannedUntil) {
    if (Date.now() < data.bannedUntil) {
      // IP toujours bannie
      const remainingSec = Math.ceil((data.bannedUntil - Date.now()) / 1000);
      return res.status(429).json({
        error: 'Accès temporairement bloqué.',
        reason: 'Activité suspecte détectée depuis votre adresse IP.',
        retryAfterSeconds: remainingSec
      });
    } else {
      // Ban expiré → libérer
      ipTracker.delete(ip);
    }
  }

  next();
};

/**
 * Middleware de tracking : s'exécute APRÈS les routes pour compter les 404
 * Doit être placé après toutes les routes dans app.js
 */
const scannerTracker = (req, res, next) => {
  // Intercepter la fin de la réponse
  const originalEnd = res.end;
  res.end = function (...args) {
    // Compter les 404
    if (res.statusCode === 404) {
      const ip = req.ip || req.connection?.remoteAddress;
      let data = ipTracker.get(ip);

      if (!data) {
        data = { count: 0, firstSeen: Date.now(), paths: [] };
        ipTracker.set(ip, data);
      }

      // Réinitialiser si la fenêtre est expirée
      if (Date.now() - data.firstSeen > CONFIG.WINDOW_MS) {
        data.count = 0;
        data.firstSeen = Date.now();
        data.paths = [];
      }

      data.count++;
      data.paths.push(req.originalUrl);

      // Seuil dépassé → BANNIR
      if (data.count >= CONFIG.MAX_404_COUNT) {
        data.bannedUntil = Date.now() + CONFIG.BAN_DURATION_MS;
        console.warn(
          `🚨 SCANNER DÉTECTÉ: IP=${ip} — ${data.count} erreurs 404 en ` +
          `${Math.round((Date.now() - data.firstSeen) / 1000)}s — ` +
          `Banni pour ${CONFIG.BAN_DURATION_MS / 60000} min. ` +
          `Derniers chemins: ${data.paths.slice(-5).join(', ')}`
        );
      }
    }

    return originalEnd.apply(res, args);
  };

  next();
};

/**
 * Middleware 404 handler : renvoie un 404 propre sans info technique
 * Place en DERNIER dans app.js (après toutes les routes)
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Ressource introuvable.'
    // PAS de détails sur le chemin, la méthode ou la pile d'appel
  });
};

module.exports = { scannerGuard, scannerTracker, notFoundHandler, ipTracker, CONFIG };
