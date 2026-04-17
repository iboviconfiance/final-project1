const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Notification extends Model {
    static associate(models) {
      Notification.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user'
      });
      Notification.belongsTo(models.Organization, {
        foreignKey: 'organizationId',
        as: 'organization'
      });
    }
  }

  Notification.init({
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
    organizationId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'e.g., PAYMENT, SECURITY, SYSTEM, INFO'
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Pour le deep linking ({ link: "/admin/path" })'
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    severityLevel: {
      type: DataTypes.ENUM('success', 'warning', 'danger', 'info'),
      defaultValue: 'info'
    }
  }, {
    sequelize,
    modelName: 'Notification',
    tableName: 'notifications',
    timestamps: true
  });

  return Notification;
};
