'use strict';

const Sequelize = require('sequelize');
const process = require('process');
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/database.js')[env];

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

// Exporter sequelize avant les modèles (pour éviter les imports circulaires)
module.exports = { sequelize, Sequelize };

// ─── Import des modèles ────────────────────────────────
// ─── Import des modèles ────────────────────────────────
// ─── Import des modèles ────────────────────────────────
const Organization = require('./Organization')(sequelize, Sequelize.DataTypes);
const User = require('./User')(sequelize, Sequelize.DataTypes);
const Plan = require('./Plan')(sequelize, Sequelize.DataTypes);
const Subscription = require('./Subscription')(sequelize, Sequelize.DataTypes);
const Transaction = require('./Transaction')(sequelize, Sequelize.DataTypes);
const Ticket = require('./Ticket')(sequelize, Sequelize.DataTypes);
const AuditLog = require('./AuditLog')(sequelize, Sequelize.DataTypes);
const AdminLog = require('./AdminLog')(sequelize, Sequelize.DataTypes);
const Announcement = require('./Announcement')(sequelize, Sequelize.DataTypes);
const PushSubscription = require('./PushSubscription')(sequelize, Sequelize.DataTypes);
const Coupon = require('./Coupon')(sequelize, Sequelize.DataTypes);
const UserCoupon = require('./UserCoupon')(sequelize, Sequelize.DataTypes);
const Referral = require('./Referral')(sequelize, Sequelize.DataTypes);
const { Affiliate, AffiliateCommission } = require('./Affiliate')(sequelize, Sequelize.DataTypes);
const Notification = require('./Notification')(sequelize, Sequelize.DataTypes);
const NotificationArchive = require('./NotificationArchive')(sequelize, Sequelize.DataTypes);

// ─── Associations ──────────────────────────────────────

// Organization ↔ User
Organization.hasMany(User, { foreignKey: 'organizationId', as: 'users' });
User.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });

// Organization ↔ Plan
Organization.hasMany(Plan, { foreignKey: 'organizationId' });
Plan.belongsTo(Organization, { foreignKey: 'organizationId' });

// User ↔ Subscription
User.hasMany(Subscription, { foreignKey: 'userId', as: 'subscriptions' });
Subscription.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Plan.hasMany(Subscription, { foreignKey: 'planId', as: 'subscriptions' });
Subscription.belongsTo(Plan, { foreignKey: 'planId', as: 'plan' });

// Subscription ↔ Transaction
Subscription.hasMany(Transaction, { foreignKey: 'subscriptionId' });
Transaction.belongsTo(Subscription, { foreignKey: 'subscriptionId' });
User.hasMany(Transaction, { foreignKey: 'userId', as: 'transactions' });
Transaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User ↔ Ticket
User.hasMany(Ticket, { foreignKey: 'userId' });
Ticket.belongsTo(User, { foreignKey: 'userId' });

// User ↔ PushSubscription
User.hasMany(PushSubscription, { foreignKey: 'userId' });
PushSubscription.belongsTo(User, { foreignKey: 'userId' });

// Organization ↔ AuditLog
Organization.hasMany(AuditLog, { foreignKey: 'organizationId' });
AuditLog.belongsTo(Organization, { foreignKey: 'organizationId' });

// Organization ↔ AdminLog
Organization.hasMany(AdminLog, { foreignKey: 'organizationId' });
AdminLog.belongsTo(Organization, { foreignKey: 'organizationId' });

// AdminLog ↔ User
AdminLog.belongsTo(User, { foreignKey: 'adminId', as: 'admin' });
User.hasMany(AdminLog, { foreignKey: 'adminId' });

// AuditLog ↔ User
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(AuditLog, { foreignKey: 'userId' });

// Announcement ↔ User
Announcement.belongsTo(User, { foreignKey: 'authorId', as: 'author' });
User.hasMany(Announcement, { foreignKey: 'authorId' });

// ─── Coupon Associations ───────────────────────────────
Organization.hasMany(Coupon, { foreignKey: 'organizationId' });
Coupon.belongsTo(Organization, { foreignKey: 'organizationId' });
Coupon.hasMany(UserCoupon, { foreignKey: 'couponId' });
UserCoupon.belongsTo(Coupon, { foreignKey: 'couponId' });
User.hasMany(UserCoupon, { foreignKey: 'userId' });
UserCoupon.belongsTo(User, { foreignKey: 'userId' });

// ─── Referral Associations ─────────────────────────────
User.hasMany(Referral, { as: 'referralsMade', foreignKey: 'referrerId' });
Referral.belongsTo(User, { as: 'referrer', foreignKey: 'referrerId' });
User.hasMany(Referral, { as: 'referralsReceived', foreignKey: 'referredId' });
Referral.belongsTo(User, { as: 'referred', foreignKey: 'referredId' });
Organization.hasMany(Referral, { foreignKey: 'organizationId' });
Referral.belongsTo(Organization, { foreignKey: 'organizationId' });

// ─── Affiliate Associations ────────────────────────────
Affiliate.hasMany(AffiliateCommission, { foreignKey: 'affiliateId' });
AffiliateCommission.belongsTo(Affiliate, { foreignKey: 'affiliateId' });
Organization.hasMany(AffiliateCommission, { foreignKey: 'organizationId' });
AffiliateCommission.belongsTo(Organization, { foreignKey: 'organizationId' });

// ─── Notification Associations ─────────────────────────
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Organization.hasMany(Notification, { foreignKey: 'organizationId' });
Notification.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });

User.hasMany(NotificationArchive, { foreignKey: 'userId', as: 'archivedNotifications' });
NotificationArchive.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Organization.hasMany(NotificationArchive, { foreignKey: 'organizationId' });
NotificationArchive.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });

// ─── Export tout ───────────────────────────────────────
module.exports = {
  sequelize,
  Sequelize,
  Organization,
  User,
  Plan,
  Subscription,
  Transaction,
  Ticket,
  AuditLog,
  AdminLog,
  Announcement,
  PushSubscription,
  Coupon,
  UserCoupon,
  Referral,
  Affiliate,
  AffiliateCommission,
  Notification,
  NotificationArchive,
};
