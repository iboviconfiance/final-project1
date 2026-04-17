const { Model, DataTypes } = require('sequelize');

/**
 * ============================================================
 * PushSubscription — Abonnements aux Notifications Push
 * ============================================================
 * 
 * Stocke les abonnements Web Push de chaque utilisateur.
 * Un utilisateur peut avoir plusieurs abonnements (multi-appareil).
 * 
 * SÉCURITÉ :
 * - L'endpoint et les clés sont propres au navigateur du client
 * - Si un abonnement échoue (410 Gone), il est supprimé automatiquement
 * - Les données sont liées au userId ET à l'organizationId
 */

module.exports = (sequelize) => {
  class PushSubscription extends Model {
    static associate(models) {
      PushSubscription.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user'
      });
    }
  }

  PushSubscription.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Utilisateur propriétaire de l\'abonnement push'
    },
    organizationId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Organisation (pour broadcast par org)'
    },
    endpoint: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
      comment: 'URL du service push du navigateur'
    },
    keys: {
      type: DataTypes.JSONB,
      allowNull: false,
      comment: '{ p256dh: "...", auth: "..." } — clés de chiffrement du client'
    },
    userAgent: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Navigateur/appareil du client'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: 'Désactivé si le service push retourne 410 Gone'
    }
  }, {
    sequelize,
    modelName: 'PushSubscription',
    tableName: 'push_subscriptions',
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['organizationId'] },
      { unique: true, fields: ['endpoint'] },
      { fields: ['isActive'] }
    ]
  });

  return PushSubscription;
};
