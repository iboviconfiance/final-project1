require('dotenv').config();

// ============================================================
// PHASE 1 : VALIDATION DE L'ENVIRONNEMENT
// L'application REFUSE de démarrer si la config est dangereuse
// ============================================================
const { enforceEnvironment } = require('./middlewares/envValidator');
enforceEnvironment();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { sequelize } = require('./models');
const { logger } = require('./services/loggerService');
const { validateLicense, licenseMiddleware } = require('./services/licenseService');
const { scannerGuard, scannerTracker, notFoundHandler } = require('./middlewares/scannerProtection');
const { langMiddleware } = require('./services/i18n');

const app = express();
const server = http.createServer(app);
const socketService = require('./services/socketService');
socketService.init(server);

const PORT = process.env.PORT || 3000;

// ============================================================
// PHASE 2 : VÉRIFICATION DE LICENCE (Option B)
// ============================================================
const licenseInfo = validateLicense();
if (!licenseInfo.valid) {
  logger.error(`❌ FATAL: ${licenseInfo.error}`);
  process.exit(1);
}
logger.info(`📋 Mode: ${licenseInfo.mode} (Type ${licenseInfo.type})`);
if (licenseInfo.expiresAt) {
  logger.info(`📋 Licence: ${licenseInfo.org} — expire le ${licenseInfo.expiresAt}`);
}

// ============================================================
// SÉCURITÉ : Helmet avec headers renforcés
// ============================================================
app.use(helmet({
  // Content-Security-Policy strict
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'none'"],
      frameSrc: ["'none'"]
    }
  },
  // Empêcher le clic-jacking
  frameguard: { action: 'deny' },
  // Empêcher le sniffing MIME
  noSniff: true,
  // HSTS en production
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false
}));

// Header No-Cache pour les routes sensibles (abonnements, paiements)
app.use('/api/subscriptions', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});
app.use('/api/v1/superadmin', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// ============================================================
// SÉCURITÉ : CORS
// ============================================================
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Monitor-Key'],
  credentials: true
}));

// ============================================================
// SÉCURITÉ : Anti-scanner global (AVANT les rate-limiters)
// Bloque les IPs qui génèrent trop de 404
// ============================================================
app.use(scannerGuard);

// ============================================================
// SÉCURITÉ : Rate Limiting global
// ============================================================
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes depuis cette IP, veuillez réessayer dans 15 minutes.' }
});
app.use(globalLimiter);

// Rate Limiting strict sur les routes d'auth
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives d\'authentification. Réessayez dans 1 minute.' }
});

// ============================================================
// LICENCE MIDDLEWARE (Option B)
// ============================================================
app.use(licenseMiddleware);

// ============================================================
// Body parsers (avec capture rawBody pour HMAC webhooks)
// ============================================================
app.use(express.json({
  verify: (req, res, buf) => {
    if (req.originalUrl.startsWith('/api/webhooks')) {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({ extended: true }));

// ============================================================
// Tracker de 404 (APRÈS les parsers, AVANT les routes)
// ============================================================
app.use(scannerTracker);

// ============================================================
// i18n — Détection de la langue (Accept-Language / ?lang=)
// ============================================================
app.use(langMiddleware);

// ============================================================
// FICHIERS STATIQUES — PWA (manifest.json, sw.js, offline.html)
// ============================================================
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// IMPORT DES ROUTES
// ============================================================
const authRoutes = require('./routes/authRoutes');
const subRoutes = require('./routes/subRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const auditRoutes = require('./routes/auditRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');
const healthRoutes = require('./routes/healthRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const adminRoutes = require('./routes/adminRoutes');
const clientRoutes = require('./routes/clientRoutes');
const pushRoutes = require('./routes/pushRoutes');

// ============================================================
// MONTAGE DES ROUTES
// ============================================================

// Auth (rate-limité)
app.use('/api/auth', authLimiter, authRoutes);

// Business
app.use('/api/subscriptions', subRoutes);

// Webhooks paiement (pas de rate-limit — serveurs opérateurs)
app.use('/api/webhooks', webhookRoutes);

// Audit des communications (lecture seule)
app.use('/api/audit', auditRoutes);

// Delivery callbacks (pas d'auth — providers externes)
app.use('/api/delivery', deliveryRoutes);

// Super-Admin "God Mode" (double auth : JWT + superadmin role)
app.use('/api/v1/superadmin', superAdminRoutes);

// Health check MonitorMe (auth par X-Monitor-Key, rate-limité)
app.use('/api/v1/health', healthRoutes);

// Uploads sécurisés (auth JWT + validation par rôle)
app.use('/api/uploads', uploadRoutes);

// Tickets de support (auth JWT + RBAC multi-tenant)
app.use('/api/tickets', ticketRoutes);

// Admin Dashboard & Gestion org (auth JWT + RBAC)
app.use('/api/v1/admin', adminRoutes);

// Portail Client Self-Service (auth JWT)
app.use('/api/client', clientRoutes);

// Push Notifications (VAPID key publique + auth JWT)
app.use('/api/push', pushRoutes);

// Notifications in-app (Historique)
const notificationRoutes = require('./routes/notificationRoutes');
app.use('/api/notifications', notificationRoutes);

// Système — Mode Platform/Licence + QR Code
const systemRoutes = require('./routes/systemRoutes');
app.use('/api/v1/system', systemRoutes);

// Coupons, Promos & Parrainage
const couponRoutes = require('./routes/couponRoutes');
app.use('/api/v1/coupons', couponRoutes);

// Route de test (info minimale)
app.get('/', (req, res) => {
  res.json({
    message: 'API is running',
    environment: process.env.NODE_ENV || 'development',
    licenseType: licenseInfo.type
  });
});

// ============================================================
// 404 HANDLER — Doit être APRÈS toutes les routes
// Renvoie un 404 propre sans détails techniques
// Le scannerTracker compte ces 404 pour bannir les scanners
// ============================================================
app.use(notFoundHandler);

// ============================================================
// DÉMARRAGE DU SERVEUR
// ============================================================
sequelize.authenticate()
  .then(() => {
    logger.info('✅ Database connected successfully.');
    return sequelize.sync({ alter: process.env.NODE_ENV === 'development' ? { drop: false } : false });
  })
  .then(() => {
    // Créer les dossiers nécessaires
    const dirs = [
      path.join(__dirname, 'storage', 'receipts'),
      path.join(__dirname, 'logs'),
      path.join(__dirname, 'uploads')
    ];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(`📁 Dossier créé: ${path.relative(__dirname, dir)}/`);
      }
    }

    server.listen(PORT, () => {
      logger.info(`🚀 Server is running on http://localhost:${PORT}`);
      logger.info(`🔌 WebSockets: initialisés via socket.io`);
      logger.info(`🛡️  Helmet: activé (CSP + HSTS + No-Sniff + Frameguard)`);
      logger.info(`🌐 CORS: ${process.env.CORS_ORIGIN || '*'}`);
      logger.info(`⏱️  Rate limit global: 100 req/15min`);
      logger.info(`⏱️  Rate limit auth: 5 req/min`);
      logger.info(`🚫 Anti-scanner: ban après 15× 404 en 5min`);
      logger.info(`💳 Système de paiement: chargé`);
      logger.info(`🔔 Webhooks: /api/webhooks/:provider`);
      logger.info(`📝 Audit: /api/audit (lecture seule)`);
      logger.info(`📨 Delivery: /api/delivery/email, /api/delivery/sms`);
      logger.info(`👑 Super-Admin: /api/v1/superadmin`);
      logger.info(`❤️  Health: /api/v1/health (MonitorMe)`);
      logger.info(`📤 Uploads: /api/uploads (7 couches de sécurité)`);
      logger.info(`📋 Licence: ${licenseInfo.type === 'B' ? 'Licence autohébergée (Type B)' : 'Plateforme SaaS (multi-tenant) (Type A)'}`);
      logger.info(`📄 Stockage: storage/receipts/ + uploads/`);
      logger.info(`📊 Logs: logs/app.log + logs/error.log`);
      logger.info(`👤 Client: /api/client (self-service)`);
      logger.info(`🔔 Push: /api/push (Web Push VAPID)`);
      logger.info(`📝 Templates: /api/v1/admin/templates`);
      logger.info(`📌 Versions: /api/v1/superadmin/versions`);
      logger.info(`🌐 i18n: FR/EN (Accept-Language)`);
      logger.info(`📱 PWA: /manifest.json + /sw.js`);

      // Initialiser le CronService (relances) une fois le serveur lancé
      const { initCronJobs } = require('./services/cronService');
      initCronJobs();
    });
  })
  .catch((error) => {
    logger.error('❌ Unable to connect to the database:', error);
  });
