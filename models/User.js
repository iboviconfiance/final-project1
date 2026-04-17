const { Model, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

module.exports = (sequelize) => {
  class User extends Model {
    static associate(models) {
      // Un utilisateur appartient à une organisation
      User.belongsTo(models.Organization, {
        foreignKey: 'organizationId',
        as: 'organization'
      });

      // Lien de parrainage — direction parrain (auto-référence)
      User.belongsTo(models.User, {
        foreignKey: 'referred_by',
        as: 'referrer'
      });

      // Lien de parrainage — direction filleuls (association inverse)
      User.hasMany(models.User, {
        foreignKey: 'referred_by',
        as: 'referrals'
      });

      // Un utilisateur peut avoir plusieurs abonnements
      User.hasMany(models.Subscription, {
        foreignKey: 'userId',
        as: 'subscriptions'
      });

      // Un utilisateur peut avoir plusieurs transactions
      User.hasMany(models.Transaction, {
        foreignKey: 'userId',
        as: 'transactions'
      });

      // Logs d'audit des communications (emails, SMS, PDF)
      User.hasMany(models.AuditLog, {
        foreignKey: 'userId',
        as: 'auditLogs'
      });
    }
  }

  User.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: {
          args: [8, 100],
          msg: 'Le mot de passe doit contenir entre 8 et 100 caractères.'
        }
      }
    },
    role: {
      type: DataTypes.ENUM('superadmin', 'admin', 'manager', 'staff', 'accountant', 'user'),
      defaultValue: 'user',
      allowNull: false
    },
    referral_code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    referred_by: {
      type: DataTypes.UUID,
      allowNull: true
    },
    organizationId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Prénom de l\'utilisateur'
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Nom de famille'
    },
    gender: {
      type: DataTypes.ENUM('male', 'female', 'other'),
      allowNull: true,
      comment: 'Sexe'
    },
    company: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Entreprise / Employeur'
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Numéro de téléphone principal'
    },
    savedPaymentMethod: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'Numéro MoMo chiffré AES-256-GCM : { encrypted, iv, authTag, maskedNumber }'
    }
  }, {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    hooks: {
      beforeValidate: (user) => {
        if (!user.referral_code) {
          // Génération d'un code de parrainage de 12 caractères hex (6 bytes = 281 milliards de combinaisons)
          user.referral_code = crypto.randomBytes(6).toString('hex').toUpperCase();
        }
      },
      beforeCreate: async (user) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      }
    }
  });

  return User;
};
