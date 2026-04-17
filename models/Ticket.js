const { Model, DataTypes } = require('sequelize');

/**
 * ============================================================
 * Ticket — Système de support interne
 * ============================================================
 * 
 * Un client ouvre un ticket → l'Admin de son org le voit et répond.
 * Si l'Admin ne s'en sort pas → le Super-Admin peut intervenir.
 * 
 * Le champ `messages` (JSONB Array) stocke l'historique complet
 * des échanges comme un fil de discussion :
 * [
 *   { author: "userId", role: "user", text: "J'ai payé mais...", at: "..." },
 *   { author: "adminId", role: "admin", text: "Vérifions...", at: "..." },
 *   { author: "saId", role: "superadmin", text: "Validé manuellement.", at: "..." }
 * ]
 */

module.exports = (sequelize) => {
  class Ticket extends Model {
    static associate(models) {
      Ticket.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
      Ticket.belongsTo(models.User, { foreignKey: 'assignedTo', as: 'assignee' });
      Ticket.belongsTo(models.Organization, { foreignKey: 'organizationId', as: 'organization' });
    }
  }

  Ticket.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Qui a ouvert le ticket'
    },
    organizationId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Organisation du ticket (pour isolation multi-tenant)'
    },
    assignedTo: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Admin/Manager assigné au ticket'
    },
    subject: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: { len: [3, 200] }
    },
    status: {
      type: DataTypes.ENUM('open', 'in_progress', 'waiting_customer', 'escalated', 'closed'),
      defaultValue: 'open',
      allowNull: false
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      defaultValue: 'medium',
      allowNull: false
    },
    category: {
      type: DataTypes.ENUM('billing', 'technical', 'account', 'general'),
      defaultValue: 'general',
      allowNull: false
    },
    relatedType: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Type lié : Transaction, Subscription, etc.'
    },
    relatedId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID de l\'objet lié'
    },
    messages: {
      type: DataTypes.JSONB,
      defaultValue: [],
      allowNull: false,
      comment: 'Historique des échanges [{ author, role, text, at, attachments }]'
    },
    closedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    closedBy: {
      type: DataTypes.UUID,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Ticket',
    tableName: 'tickets',
    timestamps: true,
    indexes: [
      { fields: ['organizationId'] },
      { fields: ['userId'] },
      { fields: ['status'] },
      { fields: ['priority'] },
      { fields: ['assignedTo'] },
      { fields: ['createdAt'] }
    ]
  });

  return Ticket;
};
