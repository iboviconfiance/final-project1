const { Transaction, Subscription, Plan, User, Organization, AuditLog, sequelize } = require('../models');
const pdfService = require('../services/pdfService');
const notificationService = require('../services/notificationService');
const discountService = require('../services/discountService');
const affiliateController = require('../controllers/affiliateController');

/**
 * ============================================================
 * Webhook Controller — Confirmation de paiement
 * ============================================================
 * 
 * Ce contrôleur est appelé APRÈS que le webhookMiddleware a validé :
 * - L'IP source (whitelisting)
 * - La signature HMAC
 * - Le timestamp anti-replay
 * 
 * Il gère la COUCHE 4 de sécurité : l'IDEMPOTENCE.
 * 
 * PATTERN FIRE-AND-FORGET POUR L'EMAIL :
 * La génération du PDF et l'envoi de l'email se font en ASYNCHRONE
 * via setImmediate(). Le webhook répond 200 OK IMMÉDIATEMENT,
 * puis l'event loop traite les notifications sur le tick suivant.
 * 
 * Pourquoi ?
 * - Les providers (MTN, Airtel) ont des timeouts courts (5-10s)
 * - Si on attend l'envoi de l'email, le provider croit que le webhook a échoué
 * - Il renvoie le webhook, causant des doublons inutiles
 * - setImmediate() garantit que le code s'exécute APRÈS res.json()
 */

/**
 * POST /api/webhooks/:provider
 * Reçoit la confirmation de paiement d'un opérateur Mobile Money.
 */
exports.confirmPayment = async (req, res) => {
  const { webhookData, providerName } = req;

  if (!webhookData) {
    return res.status(400).json({ error: 'Données webhook manquantes.' });
  }

  const t = await sequelize.transaction();

  try {
    // 1. Trouver la transaction par providerRef OU externalRef
    let transaction = await Transaction.findOne({
      where: { providerRef: webhookData.providerRef },
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!transaction) {
      transaction = await Transaction.findOne({
        where: { id: webhookData.externalRef },
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (!transaction) {
        await t.rollback();
        console.warn(`⚠️ Webhook reçu pour transaction inconnue: ${webhookData.providerRef}`);
        return res.status(200).json({ received: true, status: 'ignored' });
      }
    }

    return await processTransaction(transaction, webhookData, providerName, t, res);

  } catch (error) {
    if (!t.finished) {
      await t.rollback();
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
      console.log(`♻️ Webhook déjà traité (idempotence): ${webhookData.webhookId}`);
      return res.status(200).json({ received: true, status: 'already_processed' });
    }

    console.error('❌ Erreur traitement webhook:', error);
    return res.status(500).json({ error: 'Erreur interne.' });
  }
};

/**
 * Traite une transaction et met à jour le statut.
 * En cas de succès, déclenche les notifications en fire-and-forget.
 */
async function processTransaction(transaction, webhookData, providerName, t, res) {

  // IDEMPOTENCE — Si déjà success, ne rien faire
  if (transaction.status === 'success') {
    await t.rollback();
    console.log(`♻️ Transaction déjà validée (idempotence): ${transaction.id}`);
    return res.status(200).json({ received: true, status: 'already_processed' });
  }

  // ──────────────────────────────────────────────────────────
  // CAS 1 : PAIEMENT ÉCHOUÉ
  // ──────────────────────────────────────────────────────────
  if (webhookData.status === 'failed') {
    transaction.status = 'failed';
    transaction.webhookId = webhookData.webhookId;
    transaction.metadata = {
      ...transaction.metadata,
      webhookReceivedAt: new Date().toISOString(),
      providerName,
      failureData: webhookData.rawData
    };
    await transaction.save({ transaction: t });

    if (transaction.subscriptionId) {
      await Subscription.update(
        { status: 'expired' },
        { where: { id: transaction.subscriptionId }, transaction: t }
      );
    }

    await t.commit();
    console.log(`❌ Paiement échoué: Transaction ${transaction.id}`);
    return res.status(200).json({ received: true, status: 'failed' });
  }

  // ──────────────────────────────────────────────────────────
  // CAS 2 : PAIEMENT CONFIRMÉ → ACTIVER + NOTIFIER
  // ──────────────────────────────────────────────────────────
  if (webhookData.status === 'success') {
    // Mettre à jour la transaction
    transaction.status = 'success';
    transaction.webhookId = webhookData.webhookId;
    transaction.metadata = {
      ...transaction.metadata,
      webhookReceivedAt: new Date().toISOString(),
      providerName,
      confirmedAmount: webhookData.amount,
      confirmedPhone: webhookData.phoneNumber
    };
    await transaction.save({ transaction: t });

    // Récupérer l'abonnement et l'activer
    let subscription = null;
    if (transaction.subscriptionId) {
      subscription = await Subscription.findByPk(transaction.subscriptionId, {
        include: [{ model: Plan, as: 'plan' }],
        transaction: t
      });

      if (subscription && subscription.status === 'pending') {
        subscription.status = 'active';
        await subscription.save({ transaction: t });
        console.log(`✅ Abonnement activé: ${subscription.id} (via ${providerName})`);
        
        // --- MARKETING LOGIC: Appliquer coupons & parrainages (BtoC) ---
        try {
          const user = await User.findByPk(transaction.userId, { attributes: ['organizationId'], transaction: t });
          if (user) {
            // 1. Coupon
            if (transaction.metadata?.couponId) {
              const couponDiscount = transaction.metadata.discounts?.find(d => d.type === 'coupon');
              if (couponDiscount) {
                // Not passing transaction: t directly to discountService yet, so it writes outside the trans.
                // Could be optimized, but safe enough.
                await discountService.applyCoupon(
                  transaction.metadata.couponId,
                  transaction.userId,
                  transaction.id,
                  couponDiscount.amount
                );
              }
            }
            // 2. Referral
            await discountService.completeReferral(transaction.userId, user.organizationId);
          }
        } catch (marketingErr) {
          console.error('⚠️ Erreur application marketing post-paiement:', marketingErr.message);
        }

        // --- BtoB AFFILIATION LOGIC ---
        try {
          const user = await User.findByPk(transaction.userId, { attributes: ['organizationId'], transaction: t });
          if (user && user.organizationId) {
            const org = await Organization.findByPk(user.organizationId, { attributes: ['id', 'affiliate_code'], transaction: t });
            if (org && org.affiliate_code) {
              await affiliateController.recordCommission(org.affiliate_code, org.id, webhookData.amount);
            }
          }
        } catch (affiliateErr) {
          console.error('⚠️ Erreur application affiliation BtoB post-paiement:', affiliateErr.message);
        }
      }
    }

    await t.commit();
    console.log(`✅ Paiement confirmé: Transaction ${transaction.id} via ${providerName}`);

    // ──────────────────────────────────────────────────────────
    // RÉPONDRE IMMÉDIATEMENT AU PROVIDER (< 100ms)
    // ──────────────────────────────────────────────────────────
    res.status(200).json({ received: true, status: 'confirmed' });

    // ──────────────────────────────────────────────────────────
    // FIRE-AND-FORGET : PDF + Email + Audit Log
    // setImmediate() exécute le callback sur le PROCHAIN tick
    // de l'event loop, APRÈS que res.json() a envoyé la réponse.
    // → Le provider reçoit 200 OK instantanément
    // → Le PDF et l'email sont traités en background
    // ──────────────────────────────────────────────────────────
    setImmediate(async () => {
      try {
        await handlePostPaymentNotifications(transaction, subscription, providerName);
      } catch (error) {
        console.error('⚠️ Erreur notification post-paiement (non-bloquante):', error.message);
      }
    });

    return; // Réponse déjà envoyée
  }

  // Statut inconnu
  await t.rollback();
  console.warn(`⚠️ Statut webhook inconnu: ${webhookData.status}`);
  return res.status(200).json({ received: true, status: 'unknown' });
}

/**
 * ============================================================
 * NOTIFICATIONS POST-PAIEMENT (Fire-and-Forget)
 * ============================================================
 * 
 * Exécuté en ASYNCHRONE après que le webhook a répondu 200 OK.
 * Même si cette fonction échoue, le paiement est déjà confirmé.
 * Les erreurs sont tracées dans AuditLog pour investigation.
 * 
 * Étapes :
 * 1. Récupérer les données complètes (user, org, plan)
 * 2. Générer le reçu PDF
 * 3. Tracer la génération PDF dans AuditLog
 * 4. Envoyer l'email de confirmation avec le PDF
 * 5. Tracer l'envoi email dans AuditLog
 */
async function handlePostPaymentNotifications(transaction, subscription, providerName) {
  // 1. Récupérer les données complètes
  const user = await User.findByPk(transaction.userId, {
    attributes: ['id', 'email', 'organizationId']
  });

  if (!user) {
    console.error('⚠️ Utilisateur introuvable pour notification:', transaction.userId);
    return;
  }

  const organization = await Organization.findByPk(user.organizationId, {
    attributes: ['id', 'name', 'slug']
  });

  const plan = subscription?.plan || (subscription?.planId
    ? await Plan.findByPk(subscription.planId, { attributes: ['id', 'name', 'duration_days', 'price'] })
    : null);

  const orgName = organization?.name || 'Notre Plateforme';
  const transactionRef = transaction.id.substring(0, 8).toUpperCase();

  // Données de contexte pour les payloads de preuve
  const receiptData = {
    organization: { name: orgName, slug: organization?.slug || '' },
    transaction: {
      id: transaction.id,
      amount: transaction.amount,
      currency: transaction.currency,
      paymentMethod: transaction.paymentMethod,
      providerRef: transaction.providerRef,
      providerName,
      status: transaction.status,
      createdAt: transaction.createdAt
    },
    subscription: subscription ? {
      id: subscription.id,
      startDate: subscription.startDate,
      endDate: subscription.endDate
    } : null,
    plan: plan ? {
      name: plan.name,
      duration_days: plan.duration_days,
      price: plan.price
    } : null,
    user: { email: user.email }
  };

  // ──────────────────────────────────────────────────────────
  // ÉTAPE 2 : GÉNÉRER ET ARCHIVER LE PDF
  // ──────────────────────────────────────────────────────────
  let pdfBuffer = null;
  let pdfStorage = null;
  let pdfAuditLog = null;

  try {
    pdfBuffer = await pdfService.generateReceipt(receiptData);

    // ARCHIVER le PDF sur disque pour re-téléchargement
    pdfStorage = pdfService.storePDF(pdfBuffer, transaction.id);

    // Audit : PDF généré et archivé
    pdfAuditLog = await AuditLog.create({
      actionType: 'PDF_RECEIPT',
      status: 'SENT',
      recipientEmail: user.email,
      payload: receiptData,
      pdfAccessKey: pdfStorage.accessKey,
      pdfStoragePath: pdfStorage.storagePath,
      userId: user.id,
      organizationId: user.organizationId,
      relatedTransactionId: transaction.id,
      relatedSubscriptionId: subscription?.id || null,
      deliveryUpdates: [{
        event: 'pdf_generated',
        timestamp: new Date().toISOString(),
        details: `PDF archivé: ${pdfStorage.sizeBytes} bytes, clé: ${pdfStorage.accessKey}`
      }],
      metadata: {
        pdfSizeBytes: pdfStorage.sizeBytes,
        providerName,
        accessKey: pdfStorage.accessKey
      }
    });

    // LIER le reçu à la Transaction
    await transaction.update({ receiptAuditLogId: pdfAuditLog.id });

    console.log(`📄 Reçu PDF archivé: ${pdfStorage.sizeBytes} bytes → ${pdfStorage.accessKey}`);

  } catch (pdfError) {
    console.error('⚠️ Erreur génération/archivage PDF:', pdfError.message);
    await AuditLog.create({
      actionType: 'PDF_RECEIPT',
      status: 'FAILED',
      recipientEmail: user.email,
      errorMessage: pdfError.message,
      payload: receiptData,
      userId: user.id,
      organizationId: user.organizationId,
      relatedTransactionId: transaction.id,
      metadata: { providerName }
    });
  }

  // ──────────────────────────────────────────────────────────
  // ÉTAPE 3 : ENVOYER L'EMAIL AVEC LE PDF EN PIÈCE JOINTE
  // ──────────────────────────────────────────────────────────
  const emailTemplateData = {
    orgName,
    amount: transaction.amount,
    planName: plan?.name || 'N/A',
    durationDays: plan?.duration_days || 0,
    startDate: subscription?.startDate || new Date(),
    endDate: subscription?.endDate || new Date(),
    paymentMethod: transaction.paymentMethod,
    transactionRef
  };

  try {
    const emailResult = await notificationService.sendPaymentConfirmation(
      user.email,
      emailTemplateData,
      pdfBuffer
    );

    // Audit : Email envoyé — payload = PREUVE DE CONTENU EXACT
    await AuditLog.create({
      actionType: 'EMAIL_RECEIPT',
      status: emailResult.success ? 'SENT' : 'FAILED',
      providerMessageId: emailResult.messageId,
      recipientEmail: user.email,
      subject: `✓ Paiement confirmé — ${plan?.name || 'N/A'}`,
      payload: {
        templateName: 'paymentConfirmation',
        templateData: emailTemplateData,
        hasPdfAttachment: !!pdfBuffer,
        pdfAccessKey: pdfStorage?.accessKey || null
      },
      deliveryUpdates: [{
        event: 'sent',
        timestamp: new Date().toISOString(),
        details: emailResult.preview ? 'Mode preview (SMTP non configuré)' : 'Envoyé au provider SMTP',
        messageId: emailResult.messageId
      }],
      errorMessage: emailResult.error || null,
      userId: user.id,
      organizationId: user.organizationId,
      relatedTransactionId: transaction.id,
      relatedSubscriptionId: subscription?.id || null,
      metadata: {
        providerName,
        preview: emailResult.preview || false
      }
    });

    console.log(`📧 Email confirmation ${emailResult.success ? 'envoyé' : 'échoué'}: ${user.email}`);

  } catch (emailError) {
    console.error('⚠️ Erreur envoi email:', emailError.message);
    await AuditLog.create({
      actionType: 'EMAIL_RECEIPT',
      status: 'FAILED',
      recipientEmail: user.email,
      subject: `✓ Paiement confirmé — ${plan?.name || 'N/A'}`,
      errorMessage: emailError.message,
      payload: {
        templateName: 'paymentConfirmation',
        templateData: emailTemplateData,
        error: emailError.message
      },
      userId: user.id,
      organizationId: user.organizationId,
      relatedTransactionId: transaction.id,
      metadata: { providerName }
    });
  }
}


