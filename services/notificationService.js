/**
 * ============================================================
 * SERVICE DE NOTIFICATIONS — Email + SMS (préparation)
 * ============================================================
 * 
 * Moteur de notification multicanal :
 * - Email via Nodemailer (SMTP / SendGrid)
 * - SMS préparé pour Twilio / Africa's Talking (future intégration)
 * 
 * Templates inclus :
 * - paymentConfirmation : Confirmation de paiement + reçu PDF
 * - expirationAlert     : Alerte d'expiration J-3
 * - welcome             : Email de bienvenue à l'inscription
 * 
 * Chaque envoi est tracé dans la table AuditLog pour preuve.
 * 
 * PATTERN FIRE-AND-FORGET :
 * Les méthodes send* retournent des Promises mais le webhook
 * ne les await PAS — il appelle setImmediate() pour les exécuter
 * sur le prochain tick de l'event loop, APRÈS la réponse HTTP.
 * → Le webhook répond en < 100ms, l'email part en background.
 */

const nodemailer = require('nodemailer');
const { formatXAF, formatDate, formatDateShort } = require('./pdfService');
const { sendPushToUser } = require('./pushService');
const { sendNotificationToUser } = require('./socketService');

// ============================================================
// CONFIGURATION DU TRANSPORT EMAIL
// ============================================================

/**
 * Crée le transport Nodemailer selon la configuration .env
 * En développement : mode preview (log dans la console)
 * En production : SMTP réel ou SendGrid
 */
const createTransport = () => {
  // Si aucune config SMTP, utiliser un transport "preview" qui log
  if (!process.env.SMTP_HOST) {
    console.log('📧 NotificationService: Mode preview (pas de SMTP configuré)');
    return {
      sendMail: async (options) => {
        console.log('════════════════════════════════════════════');
        console.log('📧 EMAIL PREVIEW (non envoyé — configurer SMTP_HOST)');
        console.log(`   To:      ${options.to}`);
        console.log(`   Subject: ${options.subject}`);
        console.log(`   Attach:  ${options.attachments ? options.attachments.length + ' fichier(s)' : 'aucun'}`);
        console.log('════════════════════════════════════════════');
        return { messageId: `preview-${Date.now()}`, preview: true };
      }
    };
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

let transporter = null;
const getTransporter = () => {
  if (!transporter) {
    transporter = createTransport();
  }
  return transporter;
};

// ============================================================
// TEMPLATES EMAIL (HTML inline CSS compatible tous clients)
// ============================================================

const emailWrapper = (content) => `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0; padding:0; font-family:'Segoe UI',Arial,sans-serif; background-color:#f4f7fa;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background:#ffffff;">
    <tr>
      <td style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding:30px 40px; text-align:center;">
        <h1 style="color:#ffffff; margin:0; font-size:22px; font-weight:600; letter-spacing:1px;">
          {{ORG_NAME}}
        </h1>
      </td>
    </tr>
    <tr>
      <td style="padding:40px 40px 30px;">
        ${content}
      </td>
    </tr>
    <tr>
      <td style="background:#f8f9fa; padding:20px 40px; text-align:center; border-top:1px solid #e9ecef;">
        <p style="color:#999; font-size:11px; margin:0;">
          Cet email a été envoyé automatiquement. Ne pas répondre à ce message.<br>
          © ${new Date().getFullYear()} {{ORG_NAME}} — Tous droits réservés.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

const templates = {
  /**
   * Template : Confirmation de paiement
   */
  paymentConfirmation: (data) => {
    const html = emailWrapper(`
      <div style="text-align:center; margin-bottom:25px;">
        <div style="display:inline-block; background:#dcfce7; color:#16a34a; padding:8px 20px; border-radius:20px; font-size:14px; font-weight:600;">
          ✓ Paiement confirmé
        </div>
      </div>
      <p style="color:#333; font-size:15px; line-height:1.6;">
        Bonjour,<br><br>
        Votre paiement de <strong style="color:#1a1a2e; font-size:18px;">${formatXAF(data.amount)}</strong> 
        a été confirmé avec succès.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa; border-radius:8px; margin:20px 0;">
        <tr><td style="padding:20px;">
          <table width="100%">
            <tr>
              <td style="color:#666; font-size:13px; padding:6px 0;">Plan</td>
              <td style="color:#1a1a2e; font-size:13px; font-weight:600; text-align:right;">${data.planName}</td>
            </tr>
            <tr>
              <td style="color:#666; font-size:13px; padding:6px 0;">Durée</td>
              <td style="color:#1a1a2e; font-size:13px; font-weight:600; text-align:right;">${data.durationDays} jours</td>
            </tr>
            <tr>
              <td style="color:#666; font-size:13px; padding:6px 0;">Période</td>
              <td style="color:#1a1a2e; font-size:13px; font-weight:600; text-align:right;">
                ${formatDateShort(data.startDate)} → ${formatDateShort(data.endDate)}
              </td>
            </tr>
            <tr>
              <td style="color:#666; font-size:13px; padding:6px 0;">Méthode</td>
              <td style="color:#1a1a2e; font-size:13px; font-weight:600; text-align:right;">${data.paymentMethod}</td>
            </tr>
            <tr>
              <td style="color:#666; font-size:13px; padding:6px 0;">Référence</td>
              <td style="color:#1a1a2e; font-size:13px; font-weight:600; text-align:right; font-family:monospace;">${data.transactionRef}</td>
            </tr>
          </table>
        </td></tr>
      </table>
      <p style="color:#666; font-size:13px; line-height:1.6;">
        Votre reçu de paiement est joint à cet email au format PDF.<br>
        Conservez-le précieusement comme preuve de paiement.
      </p>
    `).replace(/\{\{ORG_NAME\}\}/g, data.orgName);

    return {
      subject: `✓ Paiement confirmé — ${data.planName} (${formatXAF(data.amount)})`,
      html,
      text: `Paiement confirmé: ${formatXAF(data.amount)} pour le plan ${data.planName}. Période: ${formatDateShort(data.startDate)} au ${formatDateShort(data.endDate)}. Référence: ${data.transactionRef}`
    };
  },

  /**
   * Template : Alerte d'expiration (J-3)
   */
  expirationAlert: (data) => {
    const html = emailWrapper(`
      <div style="text-align:center; margin-bottom:25px;">
        <div style="display:inline-block; background:#fef3c7; color:#d97706; padding:8px 20px; border-radius:20px; font-size:14px; font-weight:600;">
          ⚠ Expiration proche
        </div>
      </div>
      <p style="color:#333; font-size:15px; line-height:1.6;">
        Bonjour,<br><br>
        Votre abonnement <strong>${data.planName}</strong> expire dans 
        <strong style="color:#d97706; font-size:18px;">${data.daysRemaining} jour(s)</strong>.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; margin:20px 0;">
        <tr><td style="padding:20px;">
          <p style="color:#92400e; font-size:13px; margin:0; line-height:1.6;">
            📅 <strong>Date d'expiration :</strong> ${formatDateShort(data.endDate)}<br>
            ⏳ <strong>Période de grâce :</strong> ${data.graceDays} jours après expiration<br>
            💡 <strong>Conseil :</strong> Renouvelez maintenant pour éviter toute interruption de service.
          </p>
        </td></tr>
      </table>
      <div style="text-align:center; margin:25px 0;">
        <a href="${data.renewUrl || '#'}" style="display:inline-block; background:#1a1a2e; color:#ffffff; padding:12px 30px; border-radius:6px; text-decoration:none; font-weight:600; font-size:14px;">
          Renouveler maintenant
        </a>
      </div>
    `).replace(/\{\{ORG_NAME\}\}/g, data.orgName);

    return {
      subject: `⚠ Votre abonnement ${data.planName} expire dans ${data.daysRemaining} jour(s)`,
      html,
      text: `Votre abonnement ${data.planName} expire le ${formatDateShort(data.endDate)}. Renouvelez-le pour éviter toute interruption.`
    };
  },

  /**
   * Template : Bienvenue
   */
  welcome: (data) => {
    const html = emailWrapper(`
      <div style="text-align:center; margin-bottom:25px;">
        <div style="display:inline-block; background:#dbeafe; color:#2563eb; padding:8px 20px; border-radius:20px; font-size:14px; font-weight:600;">
          🎉 Bienvenue !
        </div>
      </div>
      <p style="color:#333; font-size:15px; line-height:1.6;">
        Bonjour,<br><br>
        Bienvenue sur <strong>${data.orgName}</strong> ! Votre compte a été créé avec succès.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa; border-radius:8px; margin:20px 0;">
        <tr><td style="padding:20px;">
          <table width="100%">
            <tr>
              <td style="color:#666; font-size:13px; padding:6px 0;">Email</td>
              <td style="color:#1a1a2e; font-size:13px; font-weight:600; text-align:right;">${data.email}</td>
            </tr>
            <tr>
              <td style="color:#666; font-size:13px; padding:6px 0;">Organisation</td>
              <td style="color:#1a1a2e; font-size:13px; font-weight:600; text-align:right;">${data.orgName}</td>
            </tr>
            <tr>
              <td style="color:#666; font-size:13px; padding:6px 0;">Rôle</td>
              <td style="color:#1a1a2e; font-size:13px; font-weight:600; text-align:right;">${data.role}</td>
            </tr>
            <tr>
              <td style="color:#666; font-size:13px; padding:6px 0;">Code parrainage</td>
              <td style="color:#2563eb; font-size:13px; font-weight:600; text-align:right; font-family:monospace;">${data.referralCode}</td>
            </tr>
          </table>
        </td></tr>
      </table>
      <p style="color:#666; font-size:13px; line-height:1.6;">
        Partagez votre code de parrainage <strong style="color:#2563eb;">${data.referralCode}</strong> 
        avec vos contacts pour les inviter à rejoindre la plateforme.
      </p>
    `).replace(/\{\{ORG_NAME\}\}/g, data.orgName);

    return {
      subject: `🎉 Bienvenue sur ${data.orgName} !`,
      html,
      text: `Bienvenue sur ${data.orgName} ! Votre compte a été créé. Email: ${data.email}. Code parrainage: ${data.referralCode}`
    };
  }
};

// ============================================================
// FONCTIONS D'ENVOI
// ============================================================

/**
 * Envoie un email avec template et pièces jointes optionnelles.
 * 
 * @param {object} params
 * @param {string} params.to - Adresse email du destinataire
 * @param {string} params.templateName - Nom du template ('paymentConfirmation', 'expirationAlert', 'welcome')
 * @param {object} params.templateData - Données pour le template
 * @param {Array} params.attachments - Pièces jointes [{filename, content (Buffer)}]
 * @returns {Promise<{ success: boolean, messageId: string, error?: string }>}
 */
const sendEmail = async ({ to, templateName, templateData, attachments = [] }) => {
  try {
    const template = templates[templateName];
    if (!template) {
      throw new Error(`Template email inconnu: ${templateName}`);
    }

    const { subject, html, text } = template(templateData);
    const transport = getTransporter();

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'App'}" <${process.env.EMAIL_FROM || 'noreply@app.com'}>`,
      to,
      subject,
      html,
      text,
      attachments: attachments.map(att => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType || 'application/pdf'
      }))
    };

    const result = await transport.sendMail(mailOptions);

    return {
      success: true,
      messageId: result.messageId,
      preview: result.preview || false
    };
  } catch (error) {
    console.error(`❌ Erreur envoi email (${templateName}):`, error.message);
    return {
      success: false,
      messageId: null,
      error: error.message
    };
  }
};

/**
 * Envoie la confirmation de paiement avec le reçu PDF en pièce jointe.
 * 
 * @param {string} to - Email du destinataire
 * @param {object} templateData - Données du template
 * @param {Buffer} pdfBuffer - Le reçu PDF généré
 * @returns {Promise<object>}
 */
const sendPaymentConfirmation = async (to, templateData, pdfBuffer) => {
  const receiptRef = `REC-${templateData.transactionRef?.substring(0, 8) || 'XXXX'}`;
  return sendEmail({
    to,
    templateName: 'paymentConfirmation',
    templateData,
    attachments: pdfBuffer ? [{
      filename: `recu-${receiptRef}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }] : []
  });
};

/**
 * Envoie l'alerte d'expiration.
 */
const sendExpirationAlert = async (to, templateData) => {
  return sendEmail({ to, templateName: 'expirationAlert', templateData });
};

/**
 * Envoie l'email de bienvenue.
 */
const sendWelcome = async (to, templateData) => {
  return sendEmail({ to, templateName: 'welcome', templateData });
};

// ============================================================
// PRÉPARATION SMS (structure prête pour intégration future)
// ============================================================

/**
 * Prépare et envoie un SMS.
 * Structure prête pour Twilio, Africa's Talking, ou tout autre provider.
 * 
 * @param {object} params
 * @param {string} params.to - Numéro de téléphone
 * @param {string} params.message - Contenu du SMS
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
const sendSMS = async ({ to, message }) => {
  // ──────────────────────────────────────────────────────────
  // TODO PRODUCTION : Remplacer par l'intégration Twilio ou Africa's Talking
  // ──────────────────────────────────────────────────────────
  // const client = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
  // const result = await client.messages.create({
  //   body: message,
  //   from: process.env.TWILIO_FROM,
  //   to
  // });
  // return { success: true, messageId: result.sid };
  // ──────────────────────────────────────────────────────────

  console.log('════════════════════════════════════════════');
  console.log('📱 SMS PREVIEW (non envoyé — intégrer provider SMS)');
  console.log(`   To:      ${to}`);
  console.log(`   Message: ${message}`);
  console.log('════════════════════════════════════════════');

  return {
    success: true,
    messageId: `sms-preview-${Date.now()}`,
    preview: true
  };
};

/**
 * Templates SMS prédéfinis
 */
const smsTemplates = {
  paymentConfirmation: (data) =>
    `[${data.orgName}] Paiement de ${formatXAF(data.amount)} confirmé pour ${data.planName}. Ref: ${data.transactionRef}`,

  expirationAlert: (data) =>
    `[${data.orgName}] Votre abonnement ${data.planName} expire dans ${data.daysRemaining} jour(s). Renouvelez maintenant.`,

  welcome: (data) =>
    `[${data.orgName}] Bienvenue ! Votre code parrainage: ${data.referralCode}. Partagez-le !`
};

// ============================================================
// EXPORTS
// ============================================================

/**
 * Enregistre la notification en BDD, WebSockets et Web Push
 */
const sendInAppNotification = async ({ userId, organizationId, type, title, message, data, severityLevel }) => {
  try {
    const { Notification } = require('../models');
    
    // 1. Sauvegarder en BDD
    const notif = await Notification.create({
      userId,
      organizationId,
      type,
      title,
      message,
      data,
      severityLevel
    });

    const notifData = notif.toJSON();

    // 2. WebSockets (si en ligne)
    sendNotificationToUser(userId, notifData);

    // 3. Web Push (pour smartphone, offline, PWA)
    let url = '/dashboard';
    if (data && data.link) url = data.link;

    await sendPushToUser(userId, {
      title,
      body: message,
      url
    });

    return notifData;
  } catch (err) {
    console.error('❌ Erreur sendInAppNotification:', err);
    return null;
  }
};

module.exports = {
  sendEmail,
  sendPaymentConfirmation,
  sendExpirationAlert,
  sendWelcome,
  sendSMS,
  sendInAppNotification,
  smsTemplates,
  templates
};
