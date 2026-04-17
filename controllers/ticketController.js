const Joi = require('joi');
const { Ticket, User, Organization, AdminLog, sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * ============================================================
 * Ticket Controller — Système de Support Interne
 * ============================================================
 * 
 * FLOW :
 * 1. Un client (user) ouvre un ticket → lié à son organization
 * 2. L'Admin/Manager de l'org voit le ticket et répond
 * 3. Si besoin → escalade vers le Super-Admin
 * 4. Le Super-Admin peut intervenir sur n'importe quel ticket
 * 
 * ISOLATION MULTI-TENANT :
 * - Chaque ticket est lié à une organizationId
 * - Un admin ne voit QUE les tickets de son organisation
 * - Le Super-Admin voit TOUT
 */

// ── SCHÉMAS DE VALIDATION ────────────────────────────────

const createTicketSchema = Joi.object({
  subject: Joi.string().min(3).max(200).required()
    .messages({
      'string.min': 'Le sujet doit contenir au moins 3 caractères.',
      'any.required': 'Le sujet est requis.'
    }),
  message: Joi.string().min(5).max(5000).required()
    .messages({
      'string.min': 'Le message doit contenir au moins 5 caractères.',
      'any.required': 'Le message initial est requis.'
    }),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional().default('medium'),
  category: Joi.string().valid('billing', 'technical', 'account', 'general').optional().default('general'),
  relatedType: Joi.string().valid('Transaction', 'Subscription').optional().allow(null),
  relatedId: Joi.string().uuid().optional().allow(null)
});

const replySchema = Joi.object({
  message: Joi.string().min(1).max(5000).required()
    .messages({ 'any.required': 'Le message est requis.' })
});

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('open', 'in_progress', 'waiting_customer', 'escalated', 'closed').required()
});

// ============================================================
// CRÉER UN TICKET
// ============================================================

/**
 * POST /api/tickets
 * Tout utilisateur authentifié peut créer un ticket.
 */
exports.createTicket = async (req, res) => {
  const { error, value } = createTicketSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({ error: 'Erreur de validation.', details: error.details.map(d => d.message) });
  }

  try {
    const ticket = await Ticket.create({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      subject: value.subject,
      priority: value.priority,
      category: value.category,
      relatedType: value.relatedType || null,
      relatedId: value.relatedId || null,
      status: 'open',
      messages: [{
        author: req.user.id,
        role: req.user.role,
        text: value.message,
        at: new Date().toISOString()
      }]
    });

    res.status(201).json({
      message: 'Ticket créé avec succès.',
      data: { ticket }
    });
  } catch (err) {
    console.error('Erreur createTicket:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

// ============================================================
// LISTER LES TICKETS
// ============================================================

/**
 * GET /api/tickets
 * - user : voit SES tickets
 * - admin/manager : voit les tickets de SON organisation
 * - superadmin : voit TOUS les tickets
 */
exports.listTickets = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, priority, category } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};

    // Isolation multi-tenant
    if (req.user.role === 'superadmin') {
      // Voir tous les tickets (optionnellement filtrer par org)
      if (req.query.organizationId) where.organizationId = req.query.organizationId;
    } else if (['admin', 'manager', 'staff'].includes(req.user.role)) {
      // Voir les tickets de son org
      where.organizationId = req.user.organizationId;
    } else {
      // User normal : seulement ses propres tickets
      where.userId = req.user.id;
    }

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (category) where.category = category;

    const { count, rows: tickets } = await Ticket.findAndCountAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'email', 'role'] },
        { model: User, as: 'assignee', attributes: ['id', 'email', 'role'] },
        { model: Organization, as: 'organization', attributes: ['id', 'name'] }
      ],
      order: [
        ['priority', 'DESC'],  // Urgent en premier
        ['createdAt', 'DESC']
      ],
      limit: parseInt(limit),
      offset
    });

    res.status(200).json({
      message: 'Tickets récupérés.',
      data: {
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
        tickets
      }
    });
  } catch (err) {
    console.error('Erreur listTickets:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

// ============================================================
// DÉTAIL D'UN TICKET
// ============================================================

/**
 * GET /api/tickets/:id
 */
exports.getTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findByPk(req.params.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'email', 'role'] },
        { model: User, as: 'assignee', attributes: ['id', 'email', 'role'] },
        { model: Organization, as: 'organization', attributes: ['id', 'name'] }
      ]
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket introuvable.' });
    }

    // Vérification d'accès
    if (req.user.role !== 'superadmin') {
      if (ticket.organizationId !== req.user.organizationId) {
        return res.status(403).json({ error: 'Accès refusé à ce ticket.' });
      }
      // Un user normal ne peut voir que ses propres tickets
      if (req.user.role === 'user' && ticket.userId !== req.user.id) {
        return res.status(403).json({ error: 'Accès refusé à ce ticket.' });
      }
    }

    res.status(200).json({
      message: 'Ticket récupéré.',
      data: { ticket }
    });
  } catch (err) {
    console.error('Erreur getTicket:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

// ============================================================
// RÉPONDRE À UN TICKET
// ============================================================

/**
 * POST /api/tickets/:id/reply
 * Ajoute un message au fil de discussion du ticket.
 */
exports.replyToTicket = async (req, res) => {
  const { error, value } = replySchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({ error: 'Erreur de validation.', details: error.details.map(d => d.message) });
  }

  try {
    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket introuvable.' });
    }

    // Vérification d'accès
    if (req.user.role !== 'superadmin') {
      if (ticket.organizationId !== req.user.organizationId) {
        return res.status(403).json({ error: 'Accès refusé.' });
      }
      if (req.user.role === 'user' && ticket.userId !== req.user.id) {
        return res.status(403).json({ error: 'Accès refusé.' });
      }
    }

    if (ticket.status === 'closed') {
      return res.status(400).json({ error: 'Impossible de répondre à un ticket fermé.' });
    }

    // Ajouter le message
    const newMessage = {
      author: req.user.id,
      role: req.user.role,
      text: value.message,
      at: new Date().toISOString()
    };

    const updatedMessages = [...ticket.messages, newMessage];
    
    // Mettre à jour le statut automatiquement
    let newStatus = ticket.status;
    if (['admin', 'manager', 'superadmin'].includes(req.user.role)) {
      newStatus = 'waiting_customer';
    } else if (req.user.role === 'user') {
      newStatus = ticket.status === 'waiting_customer' ? 'in_progress' : ticket.status;
    }

    await ticket.update({
      messages: updatedMessages,
      status: newStatus
    });

    res.status(200).json({
      message: 'Réponse ajoutée.',
      data: {
        ticket: {
          id: ticket.id,
          status: newStatus,
          messagesCount: updatedMessages.length,
          lastMessage: newMessage
        }
      }
    });
  } catch (err) {
    console.error('Erreur replyToTicket:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

// ============================================================
// CHANGER LE STATUT D'UN TICKET
// ============================================================

/**
 * PATCH /api/tickets/:id/status
 * Admin/Manager/SuperAdmin uniquement.
 */
exports.updateTicketStatus = async (req, res) => {
  const { error, value } = updateStatusSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket introuvable.' });
    }

    // Isolation multi-tenant
    if (req.user.role !== 'superadmin' && ticket.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Accès refusé.' });
    }

    const before = { status: ticket.status };

    const updateData = { status: value.status };
    if (value.status === 'closed') {
      updateData.closedAt = new Date();
      updateData.closedBy = req.user.id;
    }

    await ticket.update(updateData);

    res.status(200).json({
      message: `Statut du ticket mis à jour : ${value.status}`,
      data: { ticket: { id: ticket.id, status: value.status, closedAt: updateData.closedAt || null } }
    });
  } catch (err) {
    console.error('Erreur updateTicketStatus:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

// ============================================================
// ASSIGNER UN TICKET
// ============================================================

/**
 * PATCH /api/tickets/:id/assign
 * Assigne un ticket à un admin/manager de l'organisation.
 */
exports.assignTicket = async (req, res) => {
  try {
    const { assignToUserId } = req.body;
    if (!assignToUserId) {
      return res.status(400).json({ error: 'assignToUserId est requis.' });
    }

    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket introuvable.' });
    }

    if (req.user.role !== 'superadmin' && ticket.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Accès refusé.' });
    }

    // Vérifier que l'assigné fait partie de l'org
    const assignee = await User.findOne({
      where: {
        id: assignToUserId,
        organizationId: ticket.organizationId,
        role: { [Op.in]: ['admin', 'manager', 'staff'] }
      }
    });

    if (!assignee) {
      return res.status(400).json({ error: 'L\'utilisateur cible n\'existe pas ou n\'a pas les droits dans cette organisation.' });
    }

    await ticket.update({
      assignedTo: assignToUserId,
      status: ticket.status === 'open' ? 'in_progress' : ticket.status
    });

    res.status(200).json({
      message: `Ticket assigné à ${assignee.email}`,
      data: { ticket: { id: ticket.id, assignedTo: assignToUserId, status: ticket.status } }
    });
  } catch (err) {
    console.error('Erreur assignTicket:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

// ============================================================
// ESCALADER UN TICKET (vers le Super-Admin)
// ============================================================

/**
 * POST /api/tickets/:id/escalate
 * L'Admin escalade vers le Super-Admin quand il ne peut pas résoudre.
 */
exports.escalateTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket introuvable.' });
    }

    if (req.user.role !== 'superadmin' && ticket.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Accès refusé.' });
    }

    if (ticket.status === 'closed') {
      return res.status(400).json({ error: 'Impossible d\'escalader un ticket fermé.' });
    }

    // Ajouter un message système d'escalade
    const escalationMessage = {
      author: req.user.id,
      role: req.user.role,
      text: `⚠️ ESCALADE: ${req.body.reason || 'Ce ticket a été escaladé vers le Super-Admin pour intervention.'}`,
      at: new Date().toISOString(),
      isSystemMessage: true
    };

    await ticket.update({
      status: 'escalated',
      messages: [...ticket.messages, escalationMessage]
    });

    res.status(200).json({
      message: 'Ticket escaladé vers le Super-Admin.',
      data: { ticket: { id: ticket.id, status: 'escalated' } }
    });
  } catch (err) {
    console.error('Erreur escalateTicket:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};
