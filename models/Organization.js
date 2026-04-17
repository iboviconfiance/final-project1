const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Organization extends Model {
    static associate(models) {
      Organization.hasMany(models.User, {
        foreignKey: 'organizationId',
        as: 'users'
      });

      // Une organisation possède plusieurs plans d'abonnement
      Organization.hasMany(models.Plan, {
        foreignKey: 'organizationId',
        as: 'plans'
      });

      // Logs d'audit des communications de l'organisation
      Organization.hasMany(models.AuditLog, {
        foreignKey: 'organizationId',
        as: 'auditLogs'
      });
    }
  }

  Organization.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    status: {
      type: DataTypes.ENUM('active', 'suspended', 'trial'),
      defaultValue: 'trial',
      allowNull: false
    },
    affiliate_code: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Code de l\'apporteur d\'affaires BtoB ayant amené cette organisation'
    },
    settings: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Organization',
    tableName: 'organizations',
    timestamps: true, // Ajoute createdAt et updatedAt
    indexes: [
      {
        unique: true,
        fields: ['slug']
      }
    ]
  });

  return Organization;
};
