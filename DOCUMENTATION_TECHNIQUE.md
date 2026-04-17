# 📋 SubFlow — Documentation Technique Backend

> **Version** : 1.0.0  
> **Stack** : Node.js + Express 5 + Sequelize 6 + PostgreSQL  
> **Architecture** : Multi-tenant SaaS (Option A) / White-Label (Option B)  
> **Date** : Avril 2026

---

## Table des Matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Stack technique & Dépendances](#2-stack-technique--dépendances)
3. [Architecture des fichiers](#3-architecture-des-fichiers)
4. [Base de données (Modèles Sequelize)](#4-base-de-données-modèles-sequelize)
5. [Authentification & JWT](#5-authentification--jwt)
6. [RBAC — Contrôle d'accès par rôle](#6-rbac--contrôle-daccès-par-rôle)
7. [API Endpoints (Routes)](#7-api-endpoints-routes)
8. [Système de Paiement (MoMo/Airtel)](#8-système-de-paiement-momoairtel)
9. [Sécurité & Hardening](#9-sécurité--hardening)
10. [Services métier](#10-services-métier)
11. [Notifications](#11-notifications)
12. [Mode Platform vs Licence](#12-mode-platform-vs-licence)
13. [Variables d'environnement](#13-variables-denvironnement)
14. [Démarrage & Déploiement](#14-démarrage--déploiement)

---

## 1. Vue d'ensemble

SubFlow est une plateforme SaaS de **gestion d'abonnements** conçue pour le marché africain (Congo-Brazzaville). Elle permet aux entreprises (salles de sport, clubs, écoles) de gérer leurs abonnés, collecter les paiements via Mobile Money, et contrôler l'accès via QR Code.

### Deux modes de fonctionnement

| Mode | Variable `.env` | Description |
|------|----------------|-------------|
| **Option A — Plateforme** | *(pas de LICENSE_KEY)* | Multi-tenant : plusieurs organisations sur une même instance |
| **Option B — Licence** | `LICENSE_KEY` + `LICENSE_SECRET` | Mono-tenant : une seule entreprise sur son propre serveur |

---

## 2. Stack technique & Dépendances

### Runtime
- **Node.js** (v18+)
- **Express** v5.2 (dernière version stable)

### Base de données
- **PostgreSQL** (via `pg` v8.20)
- **Sequelize** v6.37 (ORM)

### Sécurité

| Package | Version | Rôle |
|---------|---------|------|
| `helmet` | 8.1 | Headers HTTP sécurisés (CSP, HSTS, X-Frame, etc.) |
| `cors` | 2.8 | Politique CORS restrictive |
| `express-rate-limit` | 8.3 | Protection brute-force (login, API) |
| `bcryptjs` | 3.0 | Hashage de mots de passe (bcrypt, 12 rounds) |
| `jsonwebtoken` | 9.0 | Tokens JWT (HS256) |
| `joi` | 18.1 | Validation stricte des inputs |

### Services

| Package | Version | Rôle |
|---------|---------|------|
| `nodemailer` | 8.0 | Envoi d'emails (SMTP/relais) |
| `pdfkit` | 0.18 | Génération de reçus PDF |
| `qrcode` | 1.5 | Génération de QR Codes de validation |
| `web-push` | 3.6 | Push Notifications (VAPID/WebPush) |
| `winston` | 3.19 | Logging structuré (fichiers + console) |
| `multer` | 2.1 | Upload de fichiers sécurisé |

### Développement
- `nodemon` pour le hot-reload en développement

---

## 3. Architecture des fichiers

```
projet2/
├── app.js                        ← Point d'entrée principal
├── package.json
├── .env                          ← Variables sensibles (JAMAIS commité)
├── .env.example                  ← Template de configuration
│
├── config/
│   └── database.js               ← Config Sequelize (dialecte, pool, logs)
│
├── models/                       ← 10 modèles Sequelize
│   ├── index.js                  ← Auto-discovery + associations
│   ├── Organization.js           ← Organisation (tenant)
│   ├── User.js                   ← Utilisateur (6 rôles)
│   ├── Plan.js                   ← Plans d'abonnement
│   ├── Subscription.js           ← Abonnements actifs
│   ├── Transaction.js            ← Paiements / factures
│   ├── Ticket.js                 ← Tickets de support
│   ├── AuditLog.js               ← Logs de communication (email/SMS)
│   ├── AdminLog.js               ← Logs d'actions admin
│   ├── Announcement.js           ← Annonces globales
│   └── PushSubscription.js       ← Abonnements push navigateur
│
├── controllers/                  ← 14 contrôleurs
│   ├── authController.js         ← Login, Register (org + client)
│   ├── subController.js          ← Abonnements, statut, plans
│   ├── clientController.js       ← Portail client self-service
│   ├── adminController.js        ← Dashboard admin (stats, membres, export)
│   ├── superAdminController.js   ← God Mode (impersonation, annonces)
│   ├── ticketController.js       ← Support tickets CRUD
│   ├── webhookController.js      ← Réception paiements (MTN/Airtel)
│   ├── templateController.js     ← Templates de notification
│   ├── auditController.js        ← Logs d'audit
│   ├── deliveryController.js     ← Callbacks livraison (email/SMS)
│   ├── healthController.js       ← Health check monitoring
│   ├── uploadController.js       ← Upload sécurisé
│   ├── versionController.js      ← Gestion des versions
│   └── systemController.js       ← Mode platform/licence + QR token
│
├── routes/                       ← 13 fichiers de routes
│   ├── authRoutes.js             ← /api/auth/*
│   ├── subRoutes.js              ← /api/subscriptions/*
│   ├── clientRoutes.js           ← /api/client/*
│   ├── adminRoutes.js            ← /api/v1/admin/*
│   ├── superAdminRoutes.js       ← /api/v1/superadmin/*
│   ├── ticketRoutes.js           ← /api/tickets/*
│   ├── webhookRoutes.js          ← /api/webhooks/*
│   ├── auditRoutes.js            ← /api/audit/*
│   ├── deliveryRoutes.js         ← /api/delivery/*
│   ├── healthRoutes.js           ← /api/v1/health/*
│   ├── uploadRoutes.js           ← /api/uploads/*
│   ├── pushRoutes.js             ← /api/push/*
│   └── systemRoutes.js           ← /api/v1/system/*
│
├── middlewares/                  ← 8 middlewares de sécurité
│   ├── authMiddleware.js         ← Vérification JWT
│   ├── roleMiddleware.js         ← RBAC granulaire (28 permissions)
│   ├── superAdminAuth.js         ← Double vérification super-admin
│   ├── adminAuditMiddleware.js   ← Journalisation automatique
│   ├── webhookMiddleware.js      ← Signature HMAC des webhooks
│   ├── envValidator.js           ← Crash si config dangereuse
│   ├── scannerProtection.js      ← Anti-scan (404 tracking + ban)
│   └── monitorAuth.js            ← Auth monitoring (X-Monitor-Key)
│
├── services/                     ← 10 services métier
│   ├── subscriptionService.js    ← Logique d'abonnement (Lazy Evaluation)
│   ├── encryptionService.js      ← Chiffrement AES-256-GCM
│   ├── notificationService.js    ← Email + SMS multi-canal
│   ├── pdfService.js             ← Génération reçus PDF
│   ├── statsService.js           ← Analytics (MRR, Churn, Growth)
│   ├── loggerService.js          ← Winston (fichier + console)
│   ├── licenseService.js         ← Validation licence (Option B)
│   ├── uploadService.js          ← Upload sécurisé + magic bytes
│   ├── pushService.js            ← WebPush VAPID
│   ├── i18n.js                   ← Internationalisation (FR/EN)
│   └── payments/                 ← Système de paiement hybride
│       ├── PaymentManager.js     ← Orchestrateur (routing auto)
│       ├── BaseProvider.js       ← Interface abstraite
│       ├── providers/
│       │   ├── MtnCongoProvider.js     ← MTN Mobile Money Congo
│       │   ├── AirtelCongoProvider.js  ← Airtel Money Congo
│       │   ├── AggregatorProvider.js   ← Agrégateur (fallback)
│       │   └── MockProvider.js         ← Mock pour tests
│       └── config/               ← Config des providers
│
├── locales/                      ← Fichiers i18n
│   ├── fr.json                   ← Français (défaut)
│   └── en.json                   ← Anglais
│
├── public/                       ← PWA assets
│   ├── manifest.json
│   ├── sw.js                     ← Service Worker (offline)
│   └── offline.html
│
└── logs/                         ← Fichiers de log (Winston)
    ├── app-*.log
    └── error-*.log
```

---

## 4. Base de données (Modèles Sequelize)

### Schéma Relationnel

```
Organization (1) ──────── (N) User
     │                         │
     │                         ├── (N) Subscription
     │                         │         │
     │                         │         └── (N) Transaction
     │                         │
     │                         ├── (N) Ticket
     │                         │
     │                         └── (1) PushSubscription
     │
     ├── (N) Plan
     ├── (N) AuditLog
     └── (N) AdminLog
```

### Modèles détaillés

| Modèle | Champs clés | Notes |
|--------|-------------|-------|
| **Organization** | `id` (UUID), `name`, `slug` (unique), `status` (active/suspended/trial), `settings` (JSONB) | Tenant principal |
| **User** | `id` (UUID), `email`, `password` (bcrypt), `role`, `firstName`, `lastName`, `phone`, `referral_code`, `referred_by`, `organizationId` | 6 rôles possibles |
| **Plan** | `id` (UUID), `name`, `price`, `durationDays`, `description`, `organizationId` | Plans par organisation |
| **Subscription** | `id` (UUID), `userId`, `planId`, `status` (active/grace_period/expired), `startDate`, `endDate` | Lazy Evaluation du statut |
| **Transaction** | `id` (UUID), `amount`, `currency`, `status` (success/pending/failed), `method`, `provider`, `providerRef`, `userId`, `subscriptionId` | Trace de paiement |
| **Ticket** | `id` (UUID), `subject`, `message`, `status` (open/in_progress/resolved/closed), `priority`, `responses` (JSONB), `userId`, `assignedTo` | Support interne immuable |
| **AuditLog** | `id`, `action`, `channel`, `recipient`, `status`, `metadata` (JSONB), `organizationId` | Logs communication |
| **AdminLog** | `id`, `action`, `performedBy`, `targetId`, `details` (JSONB), `ip`, `organizationId` | Logs actions admin |
| **Announcement** | `id`, `title`, `message`, `type`, `targetRole`, `targetOrg`, `createdBy` | Annonces globales |
| **PushSubscription** | `id`, `endpoint`, `keys` (JSONB), `userId` | Abonnements push |

---

## 5. Authentification & JWT

### Flux d'authentification

```
Client → POST /api/auth/login { email, password }
       → Serveur vérifie bcrypt (12 rounds)
       → Génère JWT { id, role, organizationId }
       → Token valide 24h (HS256)
       → Client stocke dans localStorage
       → Chaque requête : Authorization: Bearer <token>
```

### Format du JWT Payload

```json
{
  "id": "uuid-user",
  "role": "admin",
  "organizationId": "uuid-org",
  "iat": 1712000000,
  "exp": 1712086400
}
```

### Sécurité JWT

- Algorithme **HS256** (HMAC-SHA256)
- Secret minimum **64 caractères** (vérifié au démarrage par `envValidator`)
- Expiration **24 heures**
- **Aucune donnée sensible** dans le payload (pas d'email, pas de password)
- Le middleware `authMiddleware.js` vérifie le token sur chaque route protégée

---

## 6. RBAC — Contrôle d'accès par rôle

### Hiérarchie des 6 rôles

```
superadmin         ← Contrôle total de la plateforme
  └── admin        ← Tout dans son organisation
       └── manager ← Gestion opérationnelle (pas de facturation)
            ├── staff      ← Vérification accès + inscription
            └── accountant ← Lecture finances + exports
                 └── user  ← Portail client (son propre compte)
```

### Matrice de Permissions (28 permissions)

| Permission | superadmin | admin | manager | staff | accountant | user |
|-----------|:---------:|:-----:|:-------:|:-----:|:----------:|:----:|
| `create_user` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `view_users` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `update_user` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `delete_user` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `check_subscription` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `create_subscription` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `cancel_subscription` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `view_plans` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `create_plan` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `delete_plan` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `view_transactions` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| `export_data` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `validate_payment` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `view_reports` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| `view_analytics` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `update_org` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `delete_org` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `manage_billing` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `manage_roles` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `create_ticket` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `view_tickets` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `respond_ticket` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `close_ticket` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `upload_files` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `delete_files` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `send_notification` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `impersonate` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `view_audit_logs` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `manage_system` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `verify_access` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

---

## 7. API Endpoints (Routes)

### 🔓 Routes publiques (aucune authentification)

| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/api/auth/register` | Inscription org + admin |
| `POST` | `/api/auth/login` | Connexion (tous rôles) |
| `GET` | `/api/auth/organizations` | Liste des orgs actives (pour inscription client) |
| `POST` | `/api/auth/register-client` | Inscription client dans une org |
| `GET` | `/api/v1/system/mode` | Mode plateforme/licence |
| `GET` | `/api/v1/health` | Health check (auth par X-Monitor-Key) |

### 👤 Routes Client (JWT requis, rôle `user`)

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/client/profile` | Profil utilisateur |
| `PUT` | `/api/client/profile` | Modifier profil |
| `GET` | `/api/client/invoices` | Liste factures (paginée) |
| `GET` | `/api/client/invoices/:id/pdf` | Télécharger reçu PDF |
| `GET` | `/api/client/consumption` | Consommation/statut |
| `GET/PUT/DELETE` | `/api/client/payment-method` | Méthode de paiement (chiffrée AES-256-GCM) |
| `GET` | `/api/subscriptions/status` | Statut abonnement |
| `GET` | `/api/subscriptions/plans` | Plans disponibles |
| `POST` | `/api/subscriptions/subscribe` | Souscrire à un plan |
| `GET` | `/api/subscriptions/history` | Historique abonnements |
| `POST` | `/api/tickets` | Créer un ticket |
| `GET` | `/api/tickets/my` | Mes tickets |
| `GET` | `/api/v1/system/qr-token` | QR Code rotatif signé |

### 🏢 Routes Admin (JWT + rôle admin/manager/staff/accountant)

| Méthode | Route | Permission RBAC | Description |
|---------|-------|----------------|-------------|
| `GET` | `/api/v1/admin/stats` | `view_reports` | Dashboard KPI |
| `GET` | `/api/v1/admin/members` | `view_users` | Liste membres org |
| `POST` | `/api/v1/admin/members` | `create_user` | Ajouter membre |
| `PUT` | `/api/v1/admin/members/:id/role` | `manage_roles` | Changer rôle |
| `GET` | `/api/v1/admin/export/transactions` | `export_data` | Export CSV |
| `GET` | `/api/v1/admin/templates` | `customize_templates` | Templates notif |
| `PUT` | `/api/v1/admin/templates/:name` | `customize_templates` | Modifier template |
| `POST` | `/api/v1/admin/templates/:name/reset` | `customize_templates` | Reset template |
| `GET` | `/api/tickets` | `view_tickets` | Tickets org |
| `POST` | `/api/tickets/:id/respond` | `respond_ticket` | Répondre ticket |
| `POST` | `/api/v1/system/verify-qr` | `verify_access` | Scanner QR Code |

### 👑 Routes Super-Admin (JWT + rôle `superadmin`)

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/superadmin/stats` | Stats globales plateforme |
| `GET` | `/api/v1/superadmin/organizations` | Liste toutes les orgs |
| `POST` | `/api/v1/superadmin/organizations/:id/suspend` | Suspendre org |
| `POST` | `/api/v1/superadmin/organizations/:id/activate` | Activer org |
| `POST` | `/api/v1/superadmin/impersonate/:userId` | Shadowing (JWT 1h) |
| `GET/POST/DELETE` | `/api/v1/superadmin/announcements` | Annonces globales |
| `POST` | `/api/v1/superadmin/payments/:id/validate` | Forcer validation paiement |
| `GET` | `/api/v1/superadmin/logs` | Logs d'audit |
| `GET` | `/api/v1/superadmin/versions` | Versions déployées |

### 🔔 Routes Webhook (aucune auth JWT, signature HMAC)

| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/api/webhooks/mtn-congo` | Callback MTN MoMo |
| `POST` | `/api/webhooks/airtel-congo` | Callback Airtel Money |
| `POST` | `/api/webhooks/aggregator` | Callback Agrégateur |

---

## 8. Système de Paiement (MoMo/Airtel)

### Architecture hybride

```
Client → subController (choisit plan + numéro)
       → PaymentManager (routing automatique)
       → Provider (MTN / Airtel / Agrégateur)
       → API Opérateur (envoi requête)
       → Webhook callback (asynchrone)
       → webhookController (validation signature HMAC)
       → Mise à jour Transaction + Subscription
       → Notification email/SMS au client
```

### Providers implémentés

| Provider | Fichier | Webhook Secret |
|----------|---------|---------------|
| MTN Mobile Money Congo | `MtnCongoProvider.js` | `MTN_CONGO_WEBHOOK_SECRET` |
| Airtel Money Congo | `AirtelCongoProvider.js` | `AIRTEL_CONGO_WEBHOOK_SECRET` |
| Agrégateur (fallback) | `AggregatorProvider.js` | `AGGREGATOR_WEBHOOK_SECRET` |
| Mock (tests) | `MockProvider.js` | — |

### Sécurité des Webhooks

- Vérification de la **signature HMAC-SHA256** sur chaque webhook
- Le `rawBody` est conservé via un middleware spécial dans Express
- Un webhook sans signature valide est **rejeté avec 401**
- **Idempotence** : un même `providerRef` ne peut pas être traité deux fois

---

## 9. Sécurité & Hardening

### Couche 1 — Démarrage (Pre-flight checks)

| Mécanisme | Fichier | Ce qu'il fait |
|-----------|---------|---------------|
| **Validateur d'environnement** | `envValidator.js` | **CRASH si** : JWT_SECRET < 32 chars, valeur par défaut détectée, DB_PASS manquant, ENCRYPTION_KEY absent |
| **Validation de licence** | `licenseService.js` | Vérifie JWT de licence en mode Option B, refuse le démarrage si expirée |

### Couche 2 — Headers HTTP (Helmet)

```
Content-Security-Policy: default-src 'self'; script-src 'self'; ...
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0 (désactivé en faveur de CSP)
Referrer-Policy: strict-origin-when-cross-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
```

### Couche 3 — Rate Limiting

| Cible | Limite | Fenêtre | Réponse |
|-------|--------|---------|---------|
| Login (`/api/auth`) | 10 requêtes | 15 min | 429 + `Retry-After` |
| API générale | 100 requêtes | 15 min | 429 |

### Couche 4 — Anti-Scanner (scannerProtection)

- Traque les requêtes vers des URLs inexistantes (`.env`, `/wp-admin`, `phpmyadmin`, etc.)
- **5 requêtes 404** depuis la même IP → **ban temporaire** (toutes les requêtes de cette IP sont rejetées)
- Protège contre les outils de scan automatique

### Couche 5 — Chiffrement des données sensibles

| Donnée | Algorithme | Clé |
|--------|-----------|-----|
| Mots de passe | **bcrypt** (12 rounds) | — (hash irréversible) |
| Numéro MoMo/Airtel | **AES-256-GCM** | `ENCRYPTION_KEY` (32 bytes) |
| QR Code tokens | **HMAC-SHA256** | `JWT_SECRET` |
| Webhooks | **HMAC-SHA256** | `*_WEBHOOK_SECRET` par provider |

### Couche 6 — Validation des entrées

- **Joi** pour la validation stricte des schemas (email, password, UUID, etc.)
- Chaque contrôleur définit un **schema Joi** avant de toucher aux données
- Les erreurs de validation retournent un **400** avec les messages détaillés

### Couche 7 — Upload sécurisé

| Protection | Détail |
|------------|--------|
| **Magic Bytes** | Vérification de la signature binaire réelle du fichier (bypass des fausses extensions) |
| **Taille max** | 5MB par fichier |
| **Types autorisés** | JPEG, PNG, PDF uniquement |
| **Virus** | Pas d'exécution côté serveur |
| **Nom de fichier** | Sanitisé (UUID + extension originale) |

### Couche 8 — Multi-tenant Isolation

- Chaque requête est scopée par `organizationId` (extrait du JWT)
- Un utilisateur ne peut **JAMAIS** accéder aux données d'une autre organisation
- Le `superadmin` est le seul rôle cross-org

### Couche 9 — Audit Trail

| Log | Fichier modèle | Événements tracés |
|-----|----------------|-------------------|
| **AdminLog** | `AdminLog.js` | Changement de rôle, suspension, ajout membre, impersonation |
| **AuditLog** | `AuditLog.js` | Envoi email, SMS, push, livraison, erreurs |

---

## 10. Services métier

### Subscription Service (Lazy Evaluation)

Le statut de l'abonnement n'est **pas mis à jour par un CRON**. Il est calculé dynamiquement à chaque requête :

```javascript
// Pseudo-code de la Lazy Evaluation
function getStatus(subscription) {
  const now = new Date();
  if (now < endDate) return 'active';
  if (now < endDate + gracePeriod) return 'grace_period';
  return 'expired';
}
```

**Avantage** : Pas de CRON, pas de drift horaire, statut toujours exact.

### Stats Service (Analytics)

Calcule en temps réel :
- **MRR** (Monthly Recurring Revenue)
- **Churn Rate** (taux de perte d'abonnés)
- **Growth** (nouveaux abonnés / mois)
- **Plan Distribution** (répartition par plan)
- **Renewal Forecast** (prévisions de renouvellement)

### PDF Service

Génère des reçus PDF professionnels avec :
- Numéro de transaction
- QR Code de vérification
- Logo de l'organisation
- Détails du paiement
- Conforme aux standards fiscaux

### Encryption Service (AES-256-GCM)

```
Chiffrement : plaintext → IV (16 bytes) + cipher + authTag (16 bytes) → hex string
Déchiffrement : hex string → split IV + cipher + tag → plaintext
```

- **IV unique** pour chaque opération (sécurité sémantique)
- **AuthTag** pour l'intégrité (détecte toute altération)
- Utilisé pour les numéros MoMo stockés en BDD

---

## 11. Notifications

### Canaux supportés

| Canal | Service | Configuration |
|-------|---------|---------------|
| **Email** | `nodemailer` (SMTP) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` |
| **Push** | `web-push` (VAPID) | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` |
| **SMS** | Via agrégateur | Intégré dans `notificationService` |

### Templates personnalisables

Les admins peuvent customiser les messages via l'interface :
- **Rappel d'expiration** (`expiry_reminder`)
- **Confirmation de paiement** (`payment_confirmation`)
- **Bienvenue** (`welcome`)

Variables disponibles : `{{nom}}`, `{{email}}`, `{{plan}}`, `{{date_expiration}}`, `{{montant}}`

### PWA (Service Worker)

- `sw.js` gère le cache offline
- `manifest.json` pour l'installation sur l'écran d'accueil
- `offline.html` affiché quand l'utilisateur est hors-ligne

---

## 12. Mode Platform vs Licence

### Option A — Plateforme (Multi-tenant)

```env
# Pas de LICENSE_KEY → mode Plateforme
PORT=3000
```

- Plusieurs organisations sur un même serveur
- Le client choisit son organisation à l'inscription
- Isolation par `organizationId` dans le JWT

### Option B — Licence (White-Label)

```env
LICENSE_KEY=eyJhbGciOiJIUzI1NiIs...  ← JWT signé
LICENSE_SECRET=clé_de_vérification
LICENSE_ORG_ID=uuid-de-l-organisation
```

- Une seule organisation visible
- L'inscription client est directe (pas de choix d'org)
- L'app peut être rebranded (logo, couleurs)
- La licence a une **date d'expiration** vérifiée au démarrage

### Détection côté Frontend

```
GET /api/v1/system/mode

→ { mode: "platform", organization: null }      // Option A
→ { mode: "license", organization: { id, name } } // Option B
```

---

## 13. Variables d'environnement

### ⚠️ Variables OBLIGATOIRES (crash si manquantes)

| Variable | Min Length | Description |
|----------|-----------|-------------|
| `JWT_SECRET` | 32 chars | Secret de signature JWT |
| `DB_HOST` | — | Adresse PostgreSQL |
| `DB_NAME` | — | Nom de la base |
| `DB_USER` | — | Utilisateur BDD |
| `DB_PASS` | — | Mot de passe BDD |
| `ENCRYPTION_KEY` | 16 chars | Clé AES-256-GCM |

### Variables optionnelles

| Variable | Défaut | Description |
|----------|--------|-------------|
| `PORT` | 3000 | Port du serveur |
| `NODE_ENV` | development | Environnement |
| `CORS_ORIGIN` | * | Origine CORS |
| `LOG_LEVEL` | info | Niveau de log Winston |
| `APP_URL` | — | URL publique (pour QR codes) |
| `APP_VERSION` | 1.0.0 | Version affichée |
| `SMTP_HOST/PORT/USER/PASS` | — | Config email |
| `MTN_CONGO_API_KEY` | — | Clé API MTN |
| `AIRTEL_CONGO_API_KEY` | — | Clé API Airtel |
| `VAPID_PUBLIC_KEY/PRIVATE_KEY` | — | Clés Web Push |
| `MONITOR_API_KEY` | — | Clé monitoring |
| `LICENSE_KEY/SECRET` | — | Mode Licence (Option B) |

---

## 14. Démarrage & Déploiement

### Développement

```bash
# 1. Cloner et installer
npm install

# 2. Copier et configurer l'environnement
cp .env.example .env
# Remplir les valeurs dans .env

# 3. Lancer PostgreSQL
# (doit être accessible sur DB_HOST:DB_PORT)

# 4. Démarrer en dev (hot-reload)
npm run dev
```

### Production

```bash
# 1. Variables d'environnement sécurisées
NODE_ENV=production

# 2. Démarrer
npm start

# 3. L'app va :
#    - Vérifier l'environnement (crash si dangereux)
#    - Vérifier la licence (si Option B)
#    - Sync Sequelize
#    - Écouter sur PORT
```

### Check-list production

- [ ] `JWT_SECRET` = 64+ chars aléatoires
- [ ] `ENCRYPTION_KEY` = 32+ chars aléatoires
- [ ] `DB_PASS` = mot de passe fort
- [ ] `NODE_ENV=production`
- [ ] `CORS_ORIGIN` = domaine spécifique (pas `*`)
- [ ] HTTPS actif (reverse proxy Nginx/Caddy)
- [ ] PostgreSQL avec TLS
- [ ] Logs rotés et archivés
- [ ] Backup BDD automatique

---

> **Document généré automatiquement** — SubFlow Backend v1.0.0
