const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { checkPermission } = require('../middlewares/roleMiddleware');

/**
 * ============================================================
 * ROUTES TICKETS — Support Interne Multi-Tenant
 * ============================================================
 * 
 * PERMISSIONS RBAC :
 * - create_ticket  → Tous les utilisateurs authentifiés
 * - view_tickets   → admin, manager, superadmin
 * - respond_ticket → admin, manager, superadmin
 * - close_ticket   → admin, superadmin
 * - escalate_ticket → admin, manager, superadmin
 * 
 * Un user normal peut créer un ticket et voir SES tickets.
 * Les filtres d'isolation sont dans le contrôleur.
 */

// Toutes les routes nécessitent une authentification
router.use(authMiddleware);

// ── CRUD TICKETS ──────────────────────────────────────────

// Créer un ticket (tous les utilisateurs authentifiés)
router.post('/', checkPermission('create_ticket'), ticketController.createTicket);

// Lister les tickets (filtré par rôle dans le contrôleur)
router.get('/', ticketController.listTickets);

// Détail d'un ticket
router.get('/:id', ticketController.getTicket);

// ── ACTIONS SUR UN TICKET ──────────────────────────────────

// Répondre à un ticket (ajout de message)
router.post('/:id/reply', ticketController.replyToTicket);

// Changer le statut d'un ticket (admin/manager/superadmin)
router.patch('/:id/status', checkPermission('respond_ticket'), ticketController.updateTicketStatus);

// Assigner un ticket à un membre de l'org
router.patch('/:id/assign', checkPermission('respond_ticket'), ticketController.assignTicket);

// Escalader vers le Super-Admin
router.post('/:id/escalate', checkPermission('escalate_ticket'), ticketController.escalateTicket);

module.exports = router;
