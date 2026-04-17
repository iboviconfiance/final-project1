const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class NotificationArchive extends Model {
    static associate(models) {
      NotificationArchive.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user'
      });
      NotificationArchive.belongsTo(models.Organization, {
        foreignKey: 'organizationId',
        as: 'organization'
      });
    }
  }

  NotificationArchive.init({
    id: {
      type: DataTypes.UUID,
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
      allowNull: false
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
      allowNull: true
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    severityLevel: {
      type: DataTypes.ENUM('success', 'warning', 'danger', 'info'),
      defaultValue: 'info'
    },
    originalCreatedAt: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'NotificationArchive',
    tableName: 'notifications_archive',
    timestamps: true,
    updatedAt: false
  });

  return NotificationArchive;
};
