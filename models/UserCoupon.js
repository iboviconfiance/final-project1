/**
 * Modèle UserCoupon — Usage unique par utilisateur
 * 
 * Empêche un utilisateur d'utiliser le même code promo deux fois.
 */
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserCoupon = sequelize.define('UserCoupon', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  couponId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  transactionId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Transaction liée à l\'utilisation',
  },
  discountAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Montant réel de la réduction appliquée (XAF)',
  },
  usedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  }, {
    tableName: 'user_coupons',
    indexes: [
      { unique: true, fields: ['userId', 'couponId'] },
    ],
  });

  return UserCoupon;
};
