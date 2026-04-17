const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Plan extends Model {
    static associate(models) {
      // Un plan appartient à une organisation (isolation multi-tenant)
      Plan.belongsTo(models.Organization, {
        foreignKey: 'organizationId',
        as: 'organization'
      });

      // Un plan peut avoir plusieurs abonnements
      Plan.hasMany(models.Subscription, {
        foreignKey: 'planId',
        as: 'subscriptions'
      });
    }
  }

  Plan.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: {
          args: [2, 100],
          msg: 'Le nom du plan doit contenir entre 2 et 100 caractères.'
        }
      }
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: {
          args: [0],
          msg: 'Le prix ne peut pas être négatif.'
        }
      }
    },
    duration_days: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: {
          args: [1],
          msg: 'La durée doit être d\'au moins 1 jour.'
        }
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    organizationId: {
      type: DataTypes.UUID,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Plan',
    tableName: 'plans',
    timestamps: true,
    indexes: [
      {
        fields: ['organizationId']
      },
      {
        fields: ['organizationId', 'name'],
        unique: true // Un nom de plan doit être unique au sein d'une organisation
      }
    ]
  });

  return Plan;
};
