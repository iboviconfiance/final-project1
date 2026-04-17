const { Model, DataTypes } = require('sequelize');

/**
 * ============================================================
 * AuditLog — Boîte noire IMMUABLE des communications
 * ============================================================
 * 
 * PRINCIPES DE CONCEPTION :
 * 
 * 1. IMMUABILITÉ : Les logs ne peuvent JAMAIS être supprimés.
 *    Seuls les champs de livraison (status, deliveredAt) 
 *    peuvent être mis à jour. Hooks Sequelize appliqués.
 * 
 * 2. PREUVE DE CONTENU : Le champ `payload` stocke une copie
 *    EXACTE du contenu envoyé (email HTML, SMS texte).
 *    En cas de litige : "Voici exactement ce qui a été envoyé".
 * 
 * 3. PREUVE DE LIVRAISON : `deliveryUpdates` trace la timeline
 *    complète (envoyé → délivré → ouvert). Mis à jour par
 *    les webhooks de SendGrid / DLR SMS.
 * 
 * 4. ARCHIVAGE PDF : `pdfAccessKey` donne accès au reçu archivé
 *    pour re-téléchargement sans re-génération.
 * 
 * SÉCURITÉ (Pentest-Ready) :
 * - beforeDestroy → throw Error (impossible de supprimer)
 * - beforeBulkDestroy → throw Error (impossible en masse)
 * - beforeUpdate → seuls status/deliveredAt/deliveryUpdates autorisés
 * - API : AUCUNE route PUT/PATCH/DELETE exposée
 */

module.exports = (sequelize) => {
  class AuditLog extends Model {
    static associate(models) {
      AuditLog.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user'
      });
      AuditLog.belongsTo(models.Organization, {
        foreignKey: 'organizationId',
        as: 'organization'
      });
    }
  }

  AuditLog.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },

    // ── TYPE D'ACTION ──────────────────────────────────
    actionType: {
      type: DataTypes.ENUM(
        'EMAIL_RECEIPT',       // Email de confirmation avec reçu PDF
        'EMAIL_WELCOME',       // Email de bienvenue
        'EMAIL_EXPIRATION',    // Alerte d'expiration J-3
        'SMS_PAYMENT',         // SMS notification paiement
        'SMS_EXPIRATION',      // SMS rappel expiration
        'PDF_RECEIPT'          // Génération du reçu PDF
      ),
      allowNull: false,
      comment: 'Type exact de la communication envoyée'
    },

    // ── STATUT DE LIVRAISON ────────────────────────────
    status: {
      type: DataTypes.ENUM(
        'QUEUED',              // En file d'attente
        'SENT',                // Envoyé au provider
        'DELIVERED',           // Confirmé comme reçu par le destinataire
        'OPENED',              // Email ouvert (tracking pixel)
        'BOUNCED',             // Email rejeté (adresse invalide)
        'FAILED'               // Échec d'envoi
      ),
      defaultValue: 'QUEUED',
      allowNull: false
    },

    // ── IDENTIFIANT PROVIDER ───────────────────────────
    providerMessageId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'ID unique retourné par le provider (SendGrid msgId, Twilio SID, Nodemailer messageId)'
    },

    // ── DESTINATAIRE ───────────────────────────────────
    recipientEmail: {
      type: DataTypes.STRING,
      allowNull: true
    },
    recipientPhone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Objet de l\'email (preuve du titre)'
    },

    // ── PREUVE DE CONTENU ──────────────────────────────
    payload: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
      comment: 'Copie EXACTE du contenu envoyé (HTML/texte). Preuve irréfutable du contenu.'
    },

    // ── TIMELINE DE LIVRAISON ──────────────────────────
    deliveryUpdates: {
      type: DataTypes.JSONB,
      defaultValue: [],
      allowNull: false,
      comment: 'Timeline complète [{event, timestamp, details}]. Ex: sent→delivered→opened.'
    },

    // ── HORODATAGE DE LIVRAISON ────────────────────────
    deliveredAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp de la confirmation de livraison par le provider'
    },

    // ── ERREUR ─────────────────────────────────────────
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Détail de l\'erreur en cas de FAILED ou BOUNCED'
    },

    // ── ARCHIVAGE PDF ──────────────────────────────────
    pdfAccessKey: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      comment: 'Clé unique pour re-télécharger le reçu PDF archivé'
    },
    pdfStoragePath: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Chemin vers le fichier PDF sur le serveur'
    },

    // ── RELATIONS ──────────────────────────────────────
    relatedTransactionId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    relatedSubscriptionId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    organizationId: {
      type: DataTypes.UUID,
      allowNull: true
    },

    // ── MÉTADONNÉES ────────────────────────────────────
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
      comment: 'Données supplémentaires (taille PDF, provider name, etc.)'
    }
  }, {
    sequelize,
    modelName: 'AuditLog',
    tableName: 'audit_logs',
    timestamps: true,

    // ============================================================
    // HOOKS D'IMMUTABILITÉ — Pentest-Ready
    // ============================================================
    hooks: {
      /**
       * VERROU 1 : Interdiction de supprimer un log d'audit.
       * Même via Sequelize ORM directement.
       */
      beforeDestroy: () => {
        throw new Error(
          'IMMUTABLE_VIOLATION: Les logs d\'audit sont légalement protégés ' +
          'et ne peuvent pas être supprimés. Contact: admin@system.'
        );
      },

      /**
       * VERROU 2 : Interdiction de suppression en masse.
       */
      beforeBulkDestroy: () => {
        throw new Error(
          'IMMUTABLE_VIOLATION: La suppression en masse des logs d\'audit est interdite.'
        );
      },

      /**
       * VERROU 3 : Seuls les champs de livraison peuvent être mis à jour.
       * Les champs de contenu (payload, recipientEmail, actionType, etc.)
       * sont gravés dans le marbre à la création.
       */
      beforeUpdate: (log) => {
        const MUTABLE_FIELDS = ['status', 'deliveredAt', 'deliveryUpdates', 'errorMessage'];
        const changedFields = log.changed();
        if (changedFields) {
          const violations = changedFields.filter(f => !MUTABLE_FIELDS.includes(f));
          if (violations.length > 0) {
            throw new Error(
              `IMMUTABLE_VIOLATION: Les champs [${violations.join(', ')}] ne peuvent pas ` +
              'être modifiés sur un log d\'audit. Seuls les champs de livraison sont mutables.'
            );
          }
        }
      },

      /**
       * VERROU 4 : Interdiction de mise à jour en masse non contrôlée.
       */
      beforeBulkUpdate: (options) => {
        const MUTABLE_FIELDS = ['status', 'deliveredAt', 'deliveryUpdates', 'errorMessage'];
        if (options.fields) {
          const violations = options.fields.filter(f => !MUTABLE_FIELDS.includes(f));
          if (violations.length > 0) {
            throw new Error(
              `IMMUTABLE_VIOLATION: Mise à jour en masse interdite sur [${violations.join(', ')}].`
            );
          }
        }
      }
    },

    indexes: [
      { fields: ['userId'] },
      { fields: ['organizationId'] },
      { fields: ['actionType'] },
      { fields: ['status'] },
      { fields: ['relatedTransactionId'] },
      { fields: ['relatedSubscriptionId'] },
      { fields: ['pdfAccessKey'], unique: true },
      { fields: ['providerMessageId'] },
      { fields: ['createdAt'] }
    ]
  });

  return AuditLog;
};
