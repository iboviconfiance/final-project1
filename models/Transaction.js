const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Transaction extends Model {
    static associate(models) {
      // Une transaction appartient à un abonnement
      Transaction.belongsTo(models.Subscription, {
        foreignKey: 'subscriptionId',
        as: 'subscription'
      });

      // Une transaction appartient à un utilisateur
      Transaction.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user'
      });
    }
  }

  Transaction.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    subscriptionId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: {
          args: [0],
          msg: 'Le montant ne peut pas être négatif.'
        }
      }
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'XAF',
      allowNull: false,
      validate: {
        isIn: {
          args: [['XAF', 'EUR', 'USD']],
          msg: 'Devise non supportée. Devises acceptées : XAF, EUR, USD.'
        }
      }
    },
    paymentMethod: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: {
          args: [['mobile_money', 'card', 'bank_transfer', 'cash']],
          msg: 'Méthode de paiement non supportée.'
        }
      }
    },
    status: {
      type: DataTypes.ENUM('success', 'failed', 'pending'),
      defaultValue: 'pending',
      allowNull: false
    },
    providerRef: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Référence de la transaction chez le fournisseur (ex: ID Mobile Money)'
    },
    providerName: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Nom du provider utilisé (ex: mtn-congo, airtel-congo, aggregator, mock)'
    },
    webhookId: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      comment: 'ID unique de la notification webhook — garantit l\'idempotence et empêche le replay'
    },
    receiptAuditLogId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Lien vers le log d\'audit du reçu PDF généré pour cette transaction'
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
      comment: 'Données supplémentaires (détails opérateur, numéro de téléphone masqué, etc.)'
    }
  }, {
    sequelize,
    modelName: 'Transaction',
    tableName: 'transactions',
    timestamps: true,
    indexes: [
      {
        fields: ['subscriptionId']
      },
      {
        fields: ['userId']
      },
      {
        fields: ['status']
      },
      {
        fields: ['providerRef']
      },
      {
        unique: true,
        fields: ['webhookId']  // Anti-replay : un webhookId ne peut être traité qu'une fois
      }
    ]
  });

  return Transaction;
};
