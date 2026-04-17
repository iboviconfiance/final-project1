const Joi = require('joi');
const { Organization, AdminLog } = require('../models');

/**
 * ============================================================
 * Template Controller — Personnalisation des Relances Admin
 * ============================================================
 * 
 * L'admin peut personnaliser les messages de relance (SMS/Email)
 * envoyés à ses abonnés. Les templates sont en TEXTE BRUT
 * uniquement (pas de HTML) pour éviter les failles XSS.
 * 
 * Variables autorisées dans les templates :
 *   {Prénom}         → Prénom du client
 *   {Nom}            → Nom du client
 *   {Plan}           → Nom du plan d'abonnement
 *   {DateExpiration}  → Date d'expiration (format local)
 *   {JoursRestants}  → Nombre de jours restants
 *   {OrgName}        → Nom de l'organisation
 *   {Montant}        → Prix du plan
 * 
 * Stockage : Organization.settings.customTemplates (JSONB)
 */

// ── TEMPLATES PAR DÉFAUT ────────────────────────────────

const DEFAULT_TEMPLATES = {
  expiration_sms: {
    name: 'Alerte SMS d\'expiration',
    description: 'SMS envoyé quand l\'abonnement est sur le point d\'expirer.',
    content: 'Salut {Prénom}, ton abonnement {Plan} chez {OrgName} expire dans {JoursRestants} jour(s). Renouvelle-le pour ne pas perdre ton accès !',
    channel: 'sms',
    maxLength: 160
  },
  expiration_email: {
    name: 'Email d\'expiration',
    description: 'Email envoyé 3 jours avant l\'expiration.',
    content: 'Bonjour {Prénom} {Nom},\n\nVotre abonnement au plan {Plan} chez {OrgName} expire le {DateExpiration}.\nIl vous reste {JoursRestants} jour(s).\n\nPour renouveler, connectez-vous à votre espace ou contactez-nous.\n\nMontant du renouvellement : {Montant} XAF\n\nCordialement,\nL\'équipe {OrgName}',
    channel: 'email',
    maxLength: 2000
  },
  welcome_sms: {
    name: 'SMS de bienvenue',
    description: 'SMS envoyé à l\'inscription d\'un nouvel abonné.',
    content: 'Bienvenue chez {OrgName} {Prénom} ! Ton compte est actif. Code parrainage : partage-le avec tes amis !',
    channel: 'sms',
    maxLength: 160
  },
  welcome_email: {
    name: 'Email de bienvenue',
    description: 'Email envoyé lors de la première inscription.',
    content: 'Bonjour {Prénom},\n\nBienvenue sur {OrgName} ! Votre compte a été créé avec succès.\n\nVous pouvez dès maintenant souscrire à un abonnement depuis votre espace client.\n\nÀ bientôt,\nL\'équipe {OrgName}',
    channel: 'email',
    maxLength: 2000
  },
  payment_confirmation_sms: {
    name: 'SMS de confirmation de paiement',
    description: 'SMS envoyé après un paiement réussi.',
    content: '{OrgName}: Paiement de {Montant} XAF confirmé pour {Plan}. Merci {Prénom} !',
    channel: 'sms',
    maxLength: 160
  }
};

const ALLOWED_VARIABLES = ['{Prénom}', '{Nom}', '{Plan}', '{DateExpiration}', '{JoursRestants}', '{OrgName}', '{Montant}'];

// ── VALIDATION ──────────────────────────────────────────

const updateTemplateSchema = Joi.object({
  content: Joi.string().min(10).max(2000).required()
    .messages({
      'string.min': 'Le template doit contenir au moins 10 caractères.',
      'string.max': 'Le template ne peut pas dépasser 2000 caractères.',
      'any.required': 'Le contenu du template est requis.'
    })
});

/**
 * Nettoie un template en texte brut (supprime tout HTML).
 */
function sanitizePlainText(text) {
  return text
    .replace(/<[^>]*>/g, '')          // Supprimer toutes les balises HTML
    .replace(/&[a-z]+;/gi, '')        // Supprimer les entités HTML
    .replace(/javascript:/gi, '')     // Supprimer les liens JS
    .replace(/on\w+\s*=/gi, '')       // Supprimer les event handlers
    .trim();
}

/**
 * Remplace les variables dans un template avec des données réelles.
 */
function renderTemplate(template, data) {
  return template
    .replace(/\{Prénom\}/g, data.firstName || 'Client')
    .replace(/\{Nom\}/g, data.lastName || '')
    .replace(/\{Plan\}/g, data.planName || 'Standard')
    .replace(/\{DateExpiration\}/g, data.expirationDate || 'N/A')
    .replace(/\{JoursRestants\}/g, data.daysRemaining?.toString() || '0')
    .replace(/\{OrgName\}/g, data.orgName || 'Notre service')
    .replace(/\{Montant\}/g, data.amount?.toString() || '0');
}

// ============================================================
// GET /api/v1/admin/templates
// Liste tous les templates (par défaut + personnalisés)
// ============================================================

exports.listTemplates = async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    if (!orgId) {
      return res.status(400).json({ error: 'Aucune organisation associée.' });
    }

    const org = await Organization.findByPk(orgId);
    if (!org) {
      return res.status(404).json({ error: 'Organisation introuvable.' });
    }

    const customTemplates = org.settings?.customTemplates || {};

    // Fusionner les templates par défaut avec les personnalisés
    const templatesArray = [];
    for (const [key, defaultTemplate] of Object.entries(DEFAULT_TEMPLATES)) {
      templatesArray.push({
        name: key,
        ...defaultTemplate,
        content: customTemplates[key]?.content || defaultTemplate.content,
        isCustomized: !!customTemplates[key],
        lastModifiedAt: customTemplates[key]?.lastModifiedAt || null
      });
    }

    res.status(200).json({
      message: 'Templates récupérés.',
      data: {
        templates: templatesArray,
        availableVariables: ALLOWED_VARIABLES
      }
    });
  } catch (err) {
    console.error('Erreur listTemplates:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

// ============================================================
// PUT /api/v1/admin/templates/:templateName
// Modifier un template (texte brut uniquement)
// ============================================================

exports.updateTemplate = async (req, res) => {
  const { templateName } = req.params;

  // Vérifier que le template existe
  if (!DEFAULT_TEMPLATES[templateName]) {
    return res.status(404).json({
      error: `Template "${templateName}" introuvable.`,
      availableTemplates: Object.keys(DEFAULT_TEMPLATES)
    });
  }

  const { error, value } = updateTemplateSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const orgId = req.user.organizationId;
    const org = await Organization.findByPk(orgId);
    if (!org) return res.status(404).json({ error: 'Organisation introuvable.' });

    // Sanitizer le contenu (texte brut uniquement)
    const sanitizedContent = sanitizePlainText(value.content);

    // Vérifier la longueur max pour les SMS
    const maxLen = DEFAULT_TEMPLATES[templateName].maxLength;
    if (sanitizedContent.length > maxLen) {
      return res.status(400).json({
        error: `Le template dépasse la longueur maximale (${maxLen} caractères pour ${DEFAULT_TEMPLATES[templateName].channel}).`,
        currentLength: sanitizedContent.length
      });
    }

    // Mettre à jour dans Organization.settings
    const settings = { ...org.settings };
    if (!settings.customTemplates) settings.customTemplates = {};

    settings.customTemplates[templateName] = {
      content: sanitizedContent,
      lastModifiedAt: new Date().toISOString(),
      modifiedBy: req.user.id
    };

    await org.update({ settings });

    // Log d'audit
    setImmediate(async () => {
      try {
        await AdminLog.create({
          adminId: req.user.id,
          organizationId: orgId,
          action: 'SYSTEM_CONFIG',
          targetType: 'Organization',
          targetId: orgId,
          changes: {
            templateName,
            before: { content: DEFAULT_TEMPLATES[templateName].content },
            after: { content: sanitizedContent }
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']?.substring(0, 500),
          metadata: { action: 'UPDATE_TEMPLATE' }
        });
      } catch (logErr) {
        console.error('⚠️ Erreur log UPDATE_TEMPLATE:', logErr.message);
      }
    });

    res.status(200).json({
      message: `Template "${templateName}" mis à jour.`,
      data: {
        templateName,
        content: sanitizedContent,
        lastModifiedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Erreur updateTemplate:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

// ============================================================
// POST /api/v1/admin/templates/:templateName/preview
// Prévisualiser un template avec des données fictives
// ============================================================

exports.previewTemplate = async (req, res) => {
  const { templateName } = req.params;

  if (!DEFAULT_TEMPLATES[templateName]) {
    return res.status(404).json({
      error: `Template "${templateName}" introuvable.`,
      availableTemplates: Object.keys(DEFAULT_TEMPLATES)
    });
  }

  try {
    const orgId = req.user.organizationId;
    const org = await Organization.findByPk(orgId);
    if (!org) return res.status(404).json({ error: 'Organisation introuvable.' });

    // Récupérer le template (personnalisé ou par défaut)
    const customTemplates = org.settings?.customTemplates || {};
    const template = customTemplates[templateName]?.content || DEFAULT_TEMPLATES[templateName].content;

    // Données fictives pour la prévisualisation
    const previewData = {
      firstName: 'Jean',
      lastName: 'Mbemba',
      planName: 'Premium Mensuel',
      expirationDate: '15/04/2026',
      daysRemaining: 3,
      orgName: org.name,
      amount: 15000
    };

    const renderedContent = renderTemplate(template, previewData);

    res.status(200).json({
      message: 'Prévisualisation générée.',
      data: {
        templateName,
        original: template,
        rendered: renderedContent,
        previewData,
        channel: DEFAULT_TEMPLATES[templateName].channel,
        characterCount: renderedContent.length
      }
    });
  } catch (err) {
    console.error('Erreur previewTemplate:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

// ============================================================
// POST /api/v1/admin/templates/:templateName/reset
// Revenir au template par défaut
// ============================================================

exports.resetTemplate = async (req, res) => {
  const { templateName } = req.params;

  if (!DEFAULT_TEMPLATES[templateName]) {
    return res.status(404).json({ error: `Template "${templateName}" introuvable.` });
  }

  try {
    const orgId = req.user.organizationId;
    const org = await Organization.findByPk(orgId);
    if (!org) return res.status(404).json({ error: 'Organisation introuvable.' });

    const settings = { ...org.settings };
    if (settings.customTemplates && settings.customTemplates[templateName]) {
      delete settings.customTemplates[templateName];
      await org.update({ settings });
    }

    res.status(200).json({
      message: `Template "${templateName}" réinitialisé au contenu par défaut.`,
      data: {
        templateName,
        content: DEFAULT_TEMPLATES[templateName].content
      }
    });
  } catch (err) {
    console.error('Erreur resetTemplate:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

// Export pour utilisation par le notificationService
module.exports.DEFAULT_TEMPLATES = DEFAULT_TEMPLATES;
module.exports.renderTemplate = renderTemplate;
module.exports.sanitizePlainText = sanitizePlainText;
