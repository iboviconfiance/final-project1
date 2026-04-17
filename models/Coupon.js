/**
 * Modèle Coupon — Codes promotionnels
 * 
 * Gérés par l'Admin de l'organisation pour ses campagnes marketing.
 * Types : fixe (-2000 XAF) ou pourcentage (-15%)
 */
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Coupon = sequelize.define('Coupon', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
  code: {
    type: DataTypes.STRING(30),
    allowNull: false,
    comment: 'Code promo (ex: FETE2026, BIENVENUE2026)',
  },
  type: {
    type: DataTypes.ENUM('fixed', 'percentage'),
    allowNull: false,
    comment: 'fixed = -X XAF, percentage = -X%',
  },
  value: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Montant fixe ou pourcentage (ex: 2000 ou 15)',
  },
  minPurchase: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: 'Montant minimum d\'achat requis (XAF)',
  },
  maxUses: {
    type: DataTypes.INTEGER,
    defaultValue: null,
    comment: 'Nombre max d\'utilisations (null = illimité)',
  },
  currentUses: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Nombre d\'utilisations actuelles',
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Date d\'expiration (null = pas d\'expiration)',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  organizationId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'Organisation qui a créé ce coupon',
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'Admin qui a créé le coupon',
  },
  }, {
    tableName: 'coupons',
    indexes: [
      { unique: true, fields: ['code', 'organizationId'] },
    ],
  });

  return Coupon;
};
