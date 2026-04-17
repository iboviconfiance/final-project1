const { AuditLog } = require('../models');

/**
 * ============================================================
 * Delivery Controller — Callbacks de preuve de livraison
 * ============================================================
 * 
 * Reçoit les confirmations de livraison des providers :
 * 
 * EMAIL :
 *   SendGrid/Mailgun envoient des webhooks quand un email est :
 *   - delivered  : reçu par le serveur destinataire
 *   - opened     : ouvert par le destinataire (tracking pixel)
 *   - bounced    : rejeté (adresse invalide)
 *   - dropped    : supprimé par le provider
 * 
 * SMS :
 *   Les APIs SMS (Twilio, Africa's Talking) envoient un DLR
 *   (Delivery Report) quand le SMS est :
 *   - delivered  : reçu par le téléphone
 *   - failed     : échec de livraison
 * 
 * Chaque callback met à jour le log d'audit correspondant
 * en ajoutant un événement dans `deliveryUpdates[]` et en
 * mettant à jour `status` et `deliveredAt`.
 */

// ============================================================
// POST /api/delivery/email
// Webhook de livraison email (SendGrid Event Webhook)
// ============================================================
exports.handleEmailDelivery = async (req, res) => {
  try {
    // SendGrid envoie un tableau d'événements
    const events = Array.isArray(req.body) ? req.body : [req.body];

    let processed = 0;
    let errors = 0;

    for (const event of events) {
      try {
        // Extraire l'ID du message selon le provider
        const messageId = event.sg_message_id  // SendGrid
          || event['message-id']               // Mailgun
          || event.MessageID                   // Postmark
          || event.messageId;                  // Nodemailer/custom

        if (!messageId) {
          console.warn('⚠️ Delivery event sans messageId:', event.event || event.type);
          continue;
        }

        // Trouver le log d'audit correspondant
        const auditLog = await AuditLog.findOne({
          where: { providerMessageId: messageId }
        });

        if (!auditLog) {
          console.warn(`⚠️ AuditLog introuvable pour messageId: ${messageId}`);
          continue;
        }

        // Mapper l'événement du provider vers nos statuts
        const eventType = event.event || event.type || event.RecordType;
        const statusMap = {
          'delivered': 'DELIVERED',
          'open': 'OPENED',
          'click': 'OPENED',
          'bounce': 'BOUNCED',
          'dropped': 'FAILED',
          'deferred': 'SENT',
          'spamreport': 'BOUNCED',
          'unsubscribe': 'DELIVERED',
          // Mailgun
          'accepted': 'SENT',
          'rejected': 'FAILED',
          'failed': 'FAILED',
          'opened': 'OPENED',
          'complained': 'BOUNCED'
        };

        const newStatus = statusMap[eventType?.toLowerCase()];
        if (!newStatus) {
          console.warn(`⚠️ Événement email non mappé: ${eventType}`);
          continue;
        }

        // Mettre à jour le log d'audit (seuls ces champs sont mutables)
        const existingUpdates = Array.isArray(auditLog.deliveryUpdates)
          ? auditLog.deliveryUpdates
          : [];

        auditLog.deliveryUpdates = [
          ...existingUpdates,
          {
            event: eventType,
            status: newStatus,
            timestamp: new Date(event.timestamp ? event.timestamp * 1000 : Date.now()).toISOString(),
            ip: event.ip || null,
            userAgent: event.useragent || null,
            details: event.reason || event.response || null
          }
        ];

        auditLog.status = newStatus;

        if (newStatus === 'DELIVERED' || newStatus === 'OPENED') {
          auditLog.deliveredAt = new Date(event.timestamp ? event.timestamp * 1000 : Date.now());
        }

        if (newStatus === 'BOUNCED' || newStatus === 'FAILED') {
          auditLog.errorMessage = event.reason || event.response || `Email ${eventType}`;
        }

        await auditLog.save();
        processed++;

        console.log(`📧 Delivery update: ${messageId} → ${newStatus}`);

      } catch (eventError) {
        console.error('⚠️ Erreur traitement event delivery:', eventError.message);
        errors++;
      }
    }

    // Toujours retourner 200 pour éviter les retentatives
    res.status(200).json({
      received: true,
      processed,
      errors,
      total: events.length
    });

  } catch (error) {
    console.error('❌ Erreur callback email delivery:', error);
    res.status(200).json({ received: true, error: 'Internal processing error' });
  }
};

// ============================================================
// POST /api/delivery/sms
// Webhook de livraison SMS (DLR — Delivery Report)
// ============================================================
exports.handleSmsDelivery = async (req, res) => {
  try {
    const body = req.body;

    // Extraire l'ID du message selon le provider SMS
    const messageId = body.MessageSid    // Twilio
      || body.messageId                  // Africa's Talking
      || body.message_id                 // Generic
      || body.id;

    if (!messageId) {
      return res.status(200).json({ received: true, status: 'no_message_id' });
    }

    const auditLog = await AuditLog.findOne({
      where: { providerMessageId: messageId }
    });

    if (!auditLog) {
      console.warn(`⚠️ AuditLog introuvable pour SMS messageId: ${messageId}`);
      return res.status(200).json({ received: true, status: 'not_found' });
    }

    // Mapper le statut DLR
    const dlrStatus = body.MessageStatus   // Twilio
      || body.status                       // Africa's Talking / Generic
      || body.Status;

    const statusMap = {
      'delivered': 'DELIVERED',
      'DeliveredToTerminal': 'DELIVERED',
      'sent': 'SENT',
      'Sent': 'SENT',
      'failed': 'FAILED',
      'Failed': 'FAILED',
      'undelivered': 'FAILED',
      'Rejected': 'FAILED',
      'Expired': 'FAILED'
    };

    const newStatus = statusMap[dlrStatus] || 'SENT';

    // Mettre à jour le log
    const existingUpdates = Array.isArray(auditLog.deliveryUpdates)
      ? auditLog.deliveryUpdates
      : [];

    auditLog.deliveryUpdates = [
      ...existingUpdates,
      {
        event: 'dlr',
        status: newStatus,
        timestamp: new Date().toISOString(),
        dlrStatus: dlrStatus,
        details: body.ErrorCode || body.failureReason || null
      }
    ];

    auditLog.status = newStatus;

    if (newStatus === 'DELIVERED') {
      auditLog.deliveredAt = new Date();
    }

    if (newStatus === 'FAILED') {
      auditLog.errorMessage = body.ErrorCode || body.failureReason || `SMS ${dlrStatus}`;
    }

    await auditLog.save();

    console.log(`📱 SMS Delivery update: ${messageId} → ${newStatus}`);
    res.status(200).json({ received: true, status: newStatus });

  } catch (error) {
    console.error('❌ Erreur callback SMS delivery:', error);
    res.status(200).json({ received: true, error: 'Internal processing error' });
  }
};
