const { AuditLog, Transaction, Subscription, Plan, User, Organization } = require('../models');

/**
 * ============================================================
 * Audit Controller — Lecture seule + Extraction de preuves
 * ============================================================
 * 
 * ⚠️  AUCUNE méthode PUT, PATCH, DELETE n'existe.
 *     Les logs d'audit sont IMMUABLES par conception.
 *     Même les hooks Sequelize empêchent la suppression.
 * 
 * Endpoints :
 * - GET /api/audit/communications      → Toutes les comms de l'org
 * - GET /api/audit/proof/:transactionId → Preuve légale structurée
 * - GET /api/audit/receipt/:accessKey   → Téléchargement du PDF archivé
 * - GET /api/audit/user/:userId         → Comms d'un utilisateur spécifique (admin)
 */

const path = require('path');
const fs = require('fs');

// ============================================================
// GET /api/audit/communications
// Liste toutes les communications de l'organisation
// ============================================================
exports.getCommunications = async (req, res) => {
  try {
    const { page = 1, limit = 50, actionType, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Filtre de base : isolation par organisation
    const where = { organizationId: req.user.organizationId };

    if (actionType) where.actionType = actionType;
    if (status) where.status = status;

    const { count, rows: logs } = await AuditLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
      attributes: {
        exclude: ['payload'] // Exclure le payload par défaut (lourd)
      }
    });

    res.status(200).json({
      message: 'Logs d\'audit récupérés.',
      data: {
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
        logs
      }
    });
  } catch (error) {
    console.error('Erreur récupération audit logs:', error);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

// ============================================================
// GET /api/audit/user/:userId
// Communications d'un utilisateur spécifique (admin)
// ============================================================
exports.getUserCommunications = async (req, res) => {
  try {
    const { userId } = req.params;

    // Sécurité : vérifier que le user appartient à l'org de l'admin
    const targetUser = await User.findOne({
      where: { id: userId, organizationId: req.user.organizationId }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Utilisateur introuvable dans votre organisation.' });
    }

    const logs = await AuditLog.findAll({
      where: { userId, organizationId: req.user.organizationId },
      order: [['createdAt', 'DESC']],
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'email']
      }]
    });

    res.status(200).json({
      message: `${logs.length} communication(s) pour ${targetUser.email}.`,
      data: { user: { id: targetUser.id, email: targetUser.email }, logs }
    });
  } catch (error) {
    console.error('Erreur récupération comms utilisateur:', error);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

// ============================================================
// GET /api/audit/proof/:transactionId
// ============================================================
/**
 * EXTRACTION DE PREUVE LÉGALE
 * 
 * Retourne un dossier structuré contenant TOUTES les preuves
 * de communication liées à une transaction de paiement.
 * 
 * En cas de litige, l'admin appelle cet endpoint et obtient :
 * - L'horodatage exact de chaque envoi
 * - Le contenu exact envoyé (payload)
 * - L'ID du provider (preuve que le service de mail l'a pris en charge)
 * - La timeline de livraison (sent → delivered → opened)
 * - Le lien de téléchargement du reçu PDF archivé
 * 
 * Réponse type :
 * "Monsieur, le reçu PDF a été généré à 14h00, l'email de confirmation
 *  a été envoyé à 14h01 à votre adresse user@mail.com, et la livraison
 *  a été confirmée par le serveur de messagerie à 14h02.
 *  Voici le reçu : /api/audit/receipt/abc123"
 */
exports.getProofOfDelivery = async (req, res) => {
  try {
    const { transactionId } = req.params;

    // 1. Récupérer la transaction (avec vérification d'org)
    const transaction = await Transaction.findByPk(transactionId, {
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'email', 'organizationId']
      }]
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction introuvable.' });
    }

    // Sécurité : vérifier que la transaction appartient à l'org
    if (transaction.user?.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Accès refusé.' });
    }

    // 2. Récupérer TOUS les logs liés à cette transaction
    const auditLogs = await AuditLog.findAll({
      where: { relatedTransactionId: transactionId },
      order: [['createdAt', 'ASC']]
    });

    // 3. Récupérer l'abonnement lié
    const subscription = await Subscription.findOne({
      where: { id: transaction.subscriptionId },
      include: [{ model: Plan, as: 'plan', attributes: ['id', 'name', 'price', 'duration_days'] }]
    });

    // 4. Construire le dossier de preuve
    const proof = {
      generatedAt: new Date().toISOString(),
      generatedBy: req.user.email,
      caseSubject: `Preuve de communication — Transaction ${transactionId.substring(0, 8).toUpperCase()}`,

      // Informations de la transaction
      transaction: {
        id: transaction.id,
        amount: transaction.amount,
        currency: transaction.currency,
        paymentMethod: transaction.paymentMethod,
        status: transaction.status,
        providerRef: transaction.providerRef,
        createdAt: transaction.createdAt
      },

      // Informations du client
      client: {
        email: transaction.user?.email,
        userId: transaction.userId
      },

      // Informations de l'abonnement
      subscription: subscription ? {
        id: subscription.id,
        plan: subscription.plan?.name,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        status: subscription.status
      } : null,

      // ═══════════════════════════════════════════════
      // PREUVES DE COMMUNICATION
      // ═══════════════════════════════════════════════
      communications: auditLogs.map(log => ({
        id: log.id,
        actionType: log.actionType,
        sentAt: log.createdAt,
        deliveredAt: log.deliveredAt,
        status: log.status,
        recipient: log.recipientEmail || log.recipientPhone,
        subject: log.subject,
        providerMessageId: log.providerMessageId,
        deliveryTimeline: log.deliveryUpdates,
        payload: log.payload,     // Contenu EXACT envoyé
        errorDetails: log.errorMessage,
        pdfDownloadUrl: log.pdfAccessKey
          ? `/api/audit/receipt/${log.pdfAccessKey}`
          : null
      })),

      // ═══════════════════════════════════════════════
      // RÉSUMÉ (pour lecture rapide)
      // ═══════════════════════════════════════════════
      summary: {
        totalCommunications: auditLogs.length,
        pdfGenerated: auditLogs.some(l => l.actionType === 'PDF_RECEIPT' && l.status === 'SENT'),
        emailsSent: auditLogs.filter(l => l.actionType.startsWith('EMAIL_') && ['SENT', 'DELIVERED', 'OPENED'].includes(l.status)).length,
        emailsDelivered: auditLogs.filter(l => l.status === 'DELIVERED').length,
        emailsOpened: auditLogs.filter(l => l.status === 'OPENED').length,
        emailsFailed: auditLogs.filter(l => l.status === 'FAILED' || l.status === 'BOUNCED').length,
        hasProofOfDelivery: auditLogs.some(l => l.status === 'DELIVERED'),
        hasProofOfOpening: auditLogs.some(l => l.status === 'OPENED'),
        receiptArchived: auditLogs.some(l => l.pdfAccessKey !== null),
        receiptDownloadUrl: (() => {
          const pdfLog = auditLogs.find(l => l.pdfAccessKey);
          return pdfLog ? `/api/audit/receipt/${pdfLog.pdfAccessKey}` : null;
        })()
      },

      // Déclaration légale
      legalNotice: 'Ce dossier est généré automatiquement par le système d\'audit. ' +
        'Les horodatages sont en UTC. Les identifiants de messages (providerMessageId) ' +
        'peuvent être vérifiés auprès du fournisseur de messagerie pour confirmation indépendante.'
    };

    res.status(200).json({
      message: 'Dossier de preuve généré avec succès.',
      data: { proof }
    });

  } catch (error) {
    console.error('Erreur extraction preuve:', error);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

// ============================================================
// GET /api/audit/receipt/:accessKey
// Téléchargement du PDF archivé
// ============================================================
exports.downloadReceipt = async (req, res) => {
  try {
    const { accessKey } = req.params;

    // Chercher le log d'audit par clé d'accès
    const auditLog = await AuditLog.findOne({
      where: { pdfAccessKey: accessKey }
    });

    if (!auditLog) {
      return res.status(404).json({ error: 'Reçu introuvable.' });
    }

    // Sécurité : vérifier que le log appartient à l'org de l'utilisateur
    if (auditLog.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Accès refusé.' });
    }

    // Vérifier que le fichier existe
    if (!auditLog.pdfStoragePath || !fs.existsSync(auditLog.pdfStoragePath)) {
      return res.status(404).json({ error: 'Fichier PDF introuvable sur le serveur.' });
    }

    // Construire un nom de fichier lisible
    const filename = `recu-${auditLog.relatedTransactionId?.substring(0, 8) || 'XXXX'}.pdf`;

    // Envoyer le fichier avec les headers appropriés
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Audit-Log-Id', auditLog.id);

    const fileStream = fs.createReadStream(auditLog.pdfStoragePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Erreur téléchargement reçu:', error);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};
