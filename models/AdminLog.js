const { Model, DataTypes } = require('sequelize');

/**
 * ============================================================
 * AdminLog — Boîte noire des actions administratives
 * ============================================================
 * 
 * APPEND-ONLY : Impossible de modifier ou supprimer via l'application.
 * 4 hooks Sequelize empêchent toute altération.
 * 
 * TYPES D'ACTIONS TRACÉES :
 * - LOGIN/LOGOUT : Qui s'est connecté, IP, user-agent
 * - CRUD admin : Création/modif/suppression de plans, orgs
 * - Actions Super-Admin : Suspension d'org, validation manuelle
 * - Actions sensibles : Changement de prix, modification d'abonnement
 * 
 * CHAMP `changes` (JSONB) :
 * Stocke l'état AVANT/APRÈS pour pouvoir dire exactement
 * "Le prix est passé de 5000 à 8000 XAF le 10/04 à 14h, par admin X".
 * 
 * ISOLATION :
 * - Un admin client ne voit QUE les logs de son organisation
 * - Le Super-Admin voit TOUT (organizationId = null dans le filtre)
 * - Les logs du Super-Admin ont organizationId = null
 *   → invisibles pour les admins clients même en SQL direct
 */

module.exports = (sequelize) => {
  class AdminLog extends Model {
    static associate(models) {
      AdminLog.belongsTo(models.User, {
        foreignKey: 'adminId',
        as: 'admin'
      });
    }
  }

  AdminLog.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    adminId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'ID de l\'administrateur qui a effectué l\'action'
    },
    organizationId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'NULL si Super-Admin → invisible pour les admins clients'
    },
    action: {
      type: DataTypes.ENUM(
        'LOGIN',
        'LOGOUT',
        'CREATE_ORG',
        'SUSPEND_ORG',
        'ACTIVATE_ORG',
        'CREATE_PLAN',
        'UPDATE_PLAN',
        'DELETE_PLAN',
        'UPDATE_SUBSCRIPTION',
        'CANCEL_SUBSCRIPTION',
        'MANUAL_PAYMENT',
        'VIEW_STATS',
        'SYSTEM_CONFIG',
        'CREATE_USER',
        'UPDATE_USER',
        'DELETE_USER',
        'ASSIGN_ROLE',
        'EXPORT_DATA',
        'IMPERSONATION_START',
        'IMPERSONATION_END',
        'GLOBAL_ANNOUNCEMENT'
      ),
      allowNull: false,
      comment: 'Type d\'action effectuée'
    },
    targetType: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Type de l\'objet modifié (Organization, User, Plan, etc.)'
    },
    targetId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID de l\'objet modifié'
    },
    changes: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
      comment: 'État AVANT/APRÈS : { before: {...}, after: {...} }'
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true
    },
    userAgent: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'AdminLog',
    tableName: 'admin_logs',
    timestamps: true,
    updatedAt: false,

    // ============================================================
    // APPEND-ONLY — Impossible de modifier ou supprimer
    // ============================================================
    hooks: {
      beforeDestroy: () => {
        throw new Error('IMMUTABLE: Les logs d\'administration ne peuvent pas être supprimés.');
      },
      beforeBulkDestroy: () => {
        throw new Error('IMMUTABLE: Suppression en masse interdite sur les logs d\'administration.');
      },
      beforeUpdate: () => {
        throw new Error('IMMUTABLE: Les logs d\'administration ne peuvent pas être modifiés.');
      },
      beforeBulkUpdate: () => {
        throw new Error('IMMUTABLE: Modification en masse interdite sur les logs d\'administration.');
      }
    },

    indexes: [
      { fields: ['adminId'] },
      { fields: ['organizationId'] },
      { fields: ['action'] },
      { fields: ['targetType', 'targetId'] },
      { fields: ['createdAt'] },
      { fields: ['ipAddress'] }
    ]
  });

  return AdminLog;
};
