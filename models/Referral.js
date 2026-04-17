/**
 * Modèle Referral — Parrainage BtoC (Client à Client)
 * 
 * Géré par l'Admin de l'organisation.
 * Le parrain reçoit un bonus (+X jours) quand le filleul PAIE.
 */
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Referral = sequelize.define('Referral', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
  referrerId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'ID du parrain',
  },
  referredId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'ID du filleul',
  },
  referralCode: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: 'Code utilisé (ex: JEAN242)',
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'rejected'),
    defaultValue: 'pending',
    comment: 'pending = filleul inscrit mais pas payé, completed = filleul a payé, rejected = fraude détectée',
  },
  rewardType: {
    type: DataTypes.ENUM('days', 'discount_percent', 'discount_fixed'),
    defaultValue: 'days',
    comment: 'Type de récompense pour le parrain',
  },
  rewardValue: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 5,
    comment: 'Valeur (ex: 5 jours, 10%, 1000 XAF)',
  },
  rewardApplied: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'true = bonus déjà crédité au parrain',
  },
  referredDiscount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 10,
    comment: 'Réduction filleul en % sur le premier mois',
  },
  organizationId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  // Anti-fraude
  referrerPhone: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Numéro MoMo du parrain (pour cross-check)',
  },
  referredPhone: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Numéro MoMo du filleul',
  },
  referrerIp: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  referredIp: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  referrerDeviceId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  referredDeviceId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  fraudFlags: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Liste des alertes fraude détectées',
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  }, {
    tableName: 'referrals',
    indexes: [
      { fields: ['referrerId'] },
      { fields: ['referredId'] },
      { unique: true, fields: ['referrerId', 'referredId'] },
    ],
  });

  return Referral;
};
