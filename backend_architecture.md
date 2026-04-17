# 📖 Architecture et Documentation Technique (Backend SubFlow)

Ce document récapitule l'intégralité de la structure, des choix technologiques et des mécanismes de sécurité mis en place dans le backend de SubFlow.

## 🛠 1. Stack Technologique

- **Runtime & Serveur** : Node.js avec Express.js.
- **Base de données** : PostgreSQL.
- **ORM** : Sequelize (pour l'interaction objet-relationnel et les transactions de sécurité).
- **Communication Asynchrone** : Webhooks (pour paiements MoMo/Airtel), setImmediate (pour le fire-and-forget CPU intensif sans bloquer le main thread).

## 🔒 2. Hardening & Sécurité Totale (Security-First)

L'application a été "hardened" (blindée) pour garantir la sécurité absolue des données et éviter toute fraude (Bypass, Impersonation, Manipulation de prix) :

### A. Phase de Démarrage Bloquante (Env Validator)
L'application refuse de démarrer (`process.exit(1)`) si des clés de sécurité critiques (JWT_SECRET, ENCRYPTION_KEY, clés Webhook) sont manquantes ou si des mots de passe en dur (comme "secret", "password") sont fournis en environnement de production.

### B. Contrôle d'Accès Triple Couche (RBAC)
1. **JWT (JSON Web Token)** : Vérifie la validité cryptographique du token.
2. **Double Autorisation (`roleMiddleware`)** : Vérifie non seulement le rôle dans le JWT, mais croise cette information dynamiquement avec la base de données.
3. **Double Vérification Super-Admin** : Même si un pirate forge un JWT "Admin", il ne pourra jamais accéder aux routes réservées au Super-Admin.

### C. Sécurité sur les Fichiers (Uploads)
- **Signature Binaire** : Un fichier corrompu ou malveillant (ex: malware renommé en image.jpg) est détecté via les "Magic Bytes" de son contenu brut (Signature binaire transparente).
- **Validation Taille et MIME** : Limite stricte pour empêcher le DoS par saturation de stockage sur le serveur.

### D. Prévention Intrusion Absolue (Scanner Guard)
- **Détection des Scanners de vulns** : Les IPs effectuant des requêtes aléatoires typiques des attaques web (ex: /.env, /.git/, /wp-login.php, /phpmyadmin) sont **black-listées globalement** après 3 échecs (Rate Limit au niveau IP complet sur Nginx/Express).

### E. Blindage des Prix (Coupons/Parrainages)
- **Séparation Client/Serveur** : Le frontend ne manipule jamais le prix. Le service backend `DiscountService` recalcule entièrement un "Checkout sécurisé" : Prix Initial - (Réduction Parrainage) - (Coupons). Le total net est imposé aux passerelles de paiement.

## 🏗 3. Modèles de Données (Base de Données)

Le schéma historique s'est enrichi pour supporter l'écosystème SaaS actuel.
*Historique:*
- **Organization** : Les clients BtoB (salles de sport, clubs, entreprises clientes).
- **User** : Multi-rôles (Super-Admin `=>` Propriétaire plateforme, Admin `=>` gérant org, Client `=>` utilisateur final/abonné de l'org).
- **Plan & Subscription** : Les forfaits et abonnements des membres.
- **Transaction** : Les logs immuables et certifiés de paiements reçus par MoMo/Airtel.
- **AuditLog & AdminLog** : Tracabilité inaltérable métier pour responsabiliser toutes les actions des Admins.

*Les nouveaux ajouts Marketing (Growth Engine) :*
- **Coupon & UserCoupon** : Gestion des codes promos, expirations, limites d'utilisation globales et tracking de l'usage par client.
- **Referral** : Moteur BtoC anti-fraude (parrainage d'abonnés). Inclus triple check cryptographique (comparaison d'IP, du Device ID (Headers) et du Numéro MoMo unique) pour éviter les auto-parrainages et le farming de réductions gratuites.
- **Affiliate & AffiliateCommission** : Moteur BtoB (Option C) pour les "Bringers" (partenaires qui ramènent des clients (Organisations) à la plateforme finale).

## 🚦 4. Écosystème Marketing (Le "Growth Engine")

### Parrainage BtoC (Viralité virale)
Chaque utilisateur reçoit un code unique à la création du compte (ex: `JEAN242`).
- Le parrain partage son code à un prospect.
- Le prospect saisit le code à l'inscription. L'anti-fraude confirme sa validité.
- Le prospect (filleul) reçoit `X%` de rabais instantané, déduit lors du checkout (appel automatique au `DiscountService`).
- Lorsque le webhook réseau confirme le paiement du filleul, une tâche asynchrone (`completeReferral`) incrémente la durée de l'abonnement du parrain de `{rewardValue}` jours gratuits, poussant à une viralité d'acquisition massive en réduisant le CAC (Customer Acquisition Cost) à 0.

### Codes Promo (Opérations ciblées)
- Flexibles : Réductions `fixes` (-1000 XAF) ou `pourcentages` (-15%).
- Scoping dynamique : chaque organisation génère ses coupons sans interférer avec les bases clients des autres.
- Usage unique : une fois validé en base de données, impossible de tricher sur les usages restants.

### Affiliation BtoB (Super-Admin exclusif)
Modèle exclusif de facturation et rétro-cession pour la **Plateforme**.
- `recordCommission()` est appelé silencieusement sur chaque paiement de souscription finale où l'organisation est liée à un code affilié.
- Un tableau de bord affiche ce que l'apporteur d'affaires a généré vs ce que vous lui avez physiquement "rétrocéder", créant un solde comptable sécurisé (non imputable côté plateforme automatique MoMo, donc à gérer sans risque tiers).

## 🛡 5. Flux de Paiement (MoMo / Airtel) et Idempotence Absolute

Le service d'abonnement gère les micro-coupures et les instabilités réseaux :
1. **Demande de Paiement (Client)** : 
   - Création de la couche `Transaction` et `Subscription` avec un "Status: Pending". Le client est refusé d'accès. L'appel externe (API MTN/Airtel) est lancé.
2. **Le Flottement (Réseau)** : 
   - Un Timeout ou crash applicatif client n'interfère plus avec le statut. 
3. **Confirmation (Webhook Backend)** : Le webhook MoMo contacte la plateforme.
   - `webhookController`: Verrouille immédiatement l'enregistrement (`LOCK UPDATE`), valide la signature et assure l'**Idempotence**. MTN peut frapper la route 5 fois de suite à cause d'un "Network Retry", la base de données ne validera et n'accordera les bonus (Commission / Parrainage) qu'UNE SEULE fois historiquement.
   - Si tout est validé : l'abonné obtient un "Access Granted", avec la mise à jour des statistiques dynamiques.
   - Le reçu est calculé (`PDFService`), consigné dans l'historique légal (`AuditLog`) puis envoyé par courriel (`NotificationService`), tout ceci programmé via de l'ASYNCHRONE (`setImmediate`) dans le Node Event Loop pour répondre un "200 Success" à la passerelle téléphonique en moins de ~50ms.

## 📈 6. Orientations et Suite

1. Le socle Backend est prêt à 98% pour l'exploitation en production. Un nettoyage des logs locaux peut être finalisé.
2. Basculement sur les clés d'API Mobile Money dynamiques (Réel / Production) à configurer via le panel Super-Admin / ENV lors de la livraison sur le serveur cible.
3. Potentielle Dockerisation des configurations pour optimiser l'équilibrage de charge si le trafic augmente drastiquement.
