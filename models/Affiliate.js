/**
 * Modèle Affiliate — Partenaires BtoB (Option C)
 * 
 * Géré exclusivement par le Super-Admin.
 * Trace les apporteurs d'affaires qui ramènent de nouvelles organisations.
 */
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Affiliate = sequelize.define('Affiliate', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Nom du partenaire/influenceur',
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  affiliateCode: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true,
    comment: 'Code affilié unique (ex: PARTNER-KONGO)',
  },
  commissionType: {
    type: DataTypes.ENUM('percentage', 'fixed'),
    defaultValue: 'percentage',
  },
  commissionValue: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 10,
    comment: 'Commission : 10% ou montant fixe',
  },
  totalEarned: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    comment: 'Total des commissions gagnées (XAF)',
  },
  totalPaid: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    comment: 'Total des commissions déjà versées',
  },
  organizationsReferred: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Nombre d\'organisations ramenées',
  },
  status: {
    type: DataTypes.ENUM('active', 'paused', 'terminated'),
    defaultValue: 'active',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'affiliates',
});

/**
 * Modèle AffiliateCommission — Trace chaque commission
 */
const AffiliateCommission = sequelize.define('AffiliateCommission', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  affiliateId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  organizationId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'Organisation ramenée par le partenaire',
  },
  transactionId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Paiement qui a déclenché la commission',
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Montant de la commission (XAF)',
  },
    status: {
      type: DataTypes.ENUM('pending', 'paid', 'cancelled'),
      defaultValue: 'pending',
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'affiliate_commissions',
  });

  return { Affiliate, AffiliateCommission };
};
