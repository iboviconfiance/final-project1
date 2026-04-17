const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Subscription extends Model {
    static associate(models) {
      // Un abonnement appartient à un utilisateur
      Subscription.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user'
      });

      // Un abonnement est lié à un plan
      Subscription.belongsTo(models.Plan, {
        foreignKey: 'planId',
        as: 'plan'
      });

      // Un abonnement peut avoir plusieurs transactions de paiement
      Subscription.hasMany(models.Transaction, {
        foreignKey: 'subscriptionId',
        as: 'transactions'
      });
    }
  }

  Subscription.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    planId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: false
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'active', 'grace_period', 'expired'),
      defaultValue: 'pending',
      allowNull: false
    },
    autoRenew: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Subscription',
    tableName: 'subscriptions',
    timestamps: true,
    indexes: [
      {
        fields: ['userId']
      },
      {
        fields: ['planId']
      },
      {
        fields: ['status']
      },
      {
        fields: ['endDate']  // Performance pour les requêtes d'expiration
      }
    ]
  });

  return Subscription;
};
