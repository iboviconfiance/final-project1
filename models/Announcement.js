const { Model, DataTypes } = require('sequelize');

/**
 * ============================================================
 * Announcement — Système d'Annonces Globales (Super-Admin)
 * ============================================================
 * 
 * Permet au Super-Admin d'envoyer des messages à TOUS les admins
 * de la plateforme (maintenance, mises à jour, changements de prix, etc.)
 * 
 * Visibilité :
 * - `target: 'all'`    → Tous les admins
 * - `target: 'org'`    → Une organisation spécifique
 * - `target: 'role'`   → Un rôle spécifique (tous les accountants, etc.)
 * 
 * Le champ `readBy` (JSONB Array) trace qui a lu l'annonce
 * pour permettre un suivi de diffusion.
 */

module.exports = (sequelize) => {
  class Announcement extends Model {
    static associate(models) {
      Announcement.belongsTo(models.User, { foreignKey: 'authorId', as: 'author' });
    }
  }

  Announcement.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    authorId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Super-Admin qui a créé l\'annonce'
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: { len: [3, 200] }
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: { len: [10, 5000] }
    },
    type: {
      type: DataTypes.ENUM('info', 'warning', 'maintenance', 'update', 'urgent'),
      defaultValue: 'info',
      allowNull: false
    },
    target: {
      type: DataTypes.ENUM('all', 'org', 'role'),
      defaultValue: 'all',
      allowNull: false,
      comment: 'Qui reçoit l\'annonce'
    },
    targetValue: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'organizationId si target=org, nom du rôle si target=role'
    },
    priority: {
      type: DataTypes.ENUM('low', 'normal', 'high', 'critical'),
      defaultValue: 'normal',
      allowNull: false
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Auto-désactivation après cette date'
    },
    readBy: {
      type: DataTypes.JSONB,
      defaultValue: [],
      allowNull: false,
      comment: 'Liste des userId qui ont lu l\'annonce'
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Announcement',
    tableName: 'announcements',
    timestamps: true,
    indexes: [
      { fields: ['authorId'] },
      { fields: ['type'] },
      { fields: ['target'] },
      { fields: ['isActive'] },
      { fields: ['createdAt'] },
      { fields: ['expiresAt'] }
    ]
  });

  return Announcement;
};
