const { User, Transaction, Organization, AdminLog, Subscription, sequelize } = require('../models');
const { getOrgDashboardStats, getDailySignups } = require('../services/statsService');
const { Op, fn, col } = require('sequelize');

/**
 * ============================================================
 * Admin Controller — Dashboard & Gestion Organisation
 * ============================================================
 * 
 * Pour l'Admin d'une organisation (pas le Super-Admin).
 * Toutes les données sont scopées à l'organizationId du user.
 * 
 * Fonctionnalités :
 * - Dashboard de santé (stats temps réel)
 * - Export CSV des transactions
 * - Gestion des rôles des membres
 */

// ============================================================
// DASHBOARD DE SANTÉ
// ============================================================

/**
 * GET /api/v1/admin/stats
 * Statistiques complètes de l'organisation pour le dashboard admin.
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    if (!orgId) {
      return res.status(400).json({ error: 'Aucune organisation associée à votre compte.' });
    }

    const [stats, dailySignups] = await Promise.all([
      getOrgDashboardStats(orgId),
      getDailySignups(orgId, 30)
    ]);

    // Log l'action de vue des stats
    setImmediate(async () => {
      try {
        await AdminLog.create({
          adminId: req.user.id,
          organizationId: orgId,
          action: 'VIEW_STATS',
          targetType: 'Organization',
          targetId: orgId,
          changes: {},
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']?.substring(0, 500)
        });
      } catch (logErr) {
        console.error('⚠️ Erreur log VIEW_STATS:', logErr.message);
      }
    });

    res.status(200).json({
      message: 'Statistiques du dashboard récupérées.',
      data: {
        ...stats,
        dailySignups,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Erreur getDashboardStats:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

// ============================================================
// EXPORT CSV DES TRANSACTIONS
// ============================================================

/**
 * GET /api/v1/admin/export/transactions
 * Génère un fichier CSV des transactions sur une période donnée.
 * 
 * Query params :
 * - startDate : Date de début (ISO 8601, ex: 2026-01-01)
 * - endDate   : Date de fin (ISO 8601, ex: 2026-01-31)
 * - status    : Filtrer par statut (success, failed, pending)
 */
exports.exportTransactionsCSV = async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    if (!orgId) {
      return res.status(400).json({ error: 'Aucune organisation associée.' });
    }

    // Période par défaut : dernier mois
    const endDateRaw = req.query.endDate || req.query.to;
    const startDateRaw = req.query.startDate || req.query.from;
    
    const endDate = endDateRaw ? new Date(endDateRaw) : new Date();
    const startDate = startDateRaw
      ? new Date(startDateRaw)
      : new Date(endDate.getFullYear(), endDate.getMonth(), 1); // 1er du mois courant

    // Validation des dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Dates invalides. Format attendu : YYYY-MM-DD' });
    }

    if (startDate > endDate) {
      return res.status(400).json({ error: 'La date de début doit être avant la date de fin.' });
    }

    // Limiter l'export à 1 an maximum
    const oneYear = 365 * 24 * 60 * 60 * 1000;
    if (endDate - startDate > oneYear) {
      return res.status(400).json({ error: 'La période d\'export ne peut pas dépasser 1 an.' });
    }

    const where = {
      createdAt: { [Op.between]: [startDate, endDate] }
    };
    if (req.query.status) where.status = req.query.status;

    const transactions = await Transaction.findAll({
      where,
      include: [{
        model: User,
        as: 'user',
        where: { organizationId: orgId },
        required: true,
        attributes: ['id', 'email']
      }],
      order: [['createdAt', 'DESC']],
      raw: true,
      nest: true
    });

    if (transactions.length === 0) {
      return res.status(200).json({
        message: 'Aucune transaction trouvée pour cette période.',
        data: { count: 0, csv: '' }
      });
    }

    // ── GÉNÉRATION CSV MANUELLE (sans dépendance externe) ──
    const csvHeaders = [
      'ID Transaction',
      'Date',
      'Email Client',
      'Montant',
      'Devise',
      'Méthode de Paiement',
      'Statut',
      'Référence Provider',
      'Provider'
    ];

    const csvRows = transactions.map(t => {
      const date = new Date(t.createdAt).toLocaleString('fr-FR', { timeZone: 'Africa/Brazzaville' });
      return [
        t.id,
        date,
        t.user?.email || 'N/A',
        t.amount,
        t.currency,
        t.paymentMethod,
        t.status,
        t.providerRef || 'N/A',
        t.providerName || 'N/A'
      ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
    });

    const csv = [csvHeaders.join(','), ...csvRows].join('\n');

    // Log de l'export
    setImmediate(async () => {
      try {
        await AdminLog.create({
          adminId: req.user.id,
          organizationId: orgId,
          action: 'EXPORT_DATA',
          targetType: 'Transaction',
          targetId: null,
          changes: {
            period: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
            count: transactions.length
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']?.substring(0, 500)
        });
      } catch (logErr) {
        console.error('⚠️ Erreur log EXPORT_DATA:', logErr.message);
      }
    });

    // Envoyer le CSV comme fichier téléchargeable
    const filename = `transactions_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // BOM UTF-8 pour que Excel reconnaisse l'encodage
    res.status(200).send('\uFEFF' + csv);

  } catch (err) {
    console.error('Erreur exportTransactionsCSV:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

// ============================================================
// GESTION DES RÔLES
// ============================================================

/**
 * GET /api/v1/admin/members
 * Liste les membres de l'organisation avec leurs rôles.
 */
exports.listMembers = async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const { page = 1, limit = 50, role } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = { organizationId: orgId };
    if (role) where.role = role;

    const count = await User.count({ where });

    // Step 1: get the IDs for pagination
    const paginatedUsers = await User.findAll({
      where,
      attributes: ['id'],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });
    const userIds = paginatedUsers.map(u => u.id);

    // Step 2: fetch complete data with associations
    let members = [];
    if (userIds.length > 0) {
      members = await User.findAll({
        where: { id: userIds },
        attributes: ['id', 'email', 'firstName', 'lastName', 'phone', 'role', 'createdAt'],
        include: [{
          model: Subscription,
          as: 'subscriptions',
          attributes: ['status', 'endDate'],
          required: false,
          where: { status: 'active' }
        }],
        order: [['createdAt', 'DESC']]
      });
    }

    res.status(200).json({
      message: 'Membres récupérés.',
      data: {
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
        members
      }
    });
  } catch (err) {
    console.error('Erreur listMembers:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

/**
 * PUT /api/v1/admin/members/:id/role
 * Change le rôle d'un membre de l'organisation.
 * 
 * Règles de sécurité :
 * - Un admin ne peut pas se changer son propre rôle
 * - Un admin ne peut pas promouvoir quelqu'un en superadmin
 * - Un manager ne peut assigner que staff/accountant/user
 */
exports.changeRole = async (req, res) => {
  try {
    const { role: newRole } = req.body;
    const targetUserId = req.params.id;
    const orgId = req.user.organizationId;

    // Validation du rôle
    const assignableRoles = ['admin', 'manager', 'staff', 'accountant', 'user'];
    if (!newRole || !assignableRoles.includes(newRole)) {
      return res.status(400).json({
        error: `Rôle invalide. Rôles autorisés: ${assignableRoles.join(', ')}`
      });
    }

    // Interdire de se changer soi-même
    if (targetUserId === req.user.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas changer votre propre rôle.' });
    }

    // Un manager ne peut pas promouvoir en admin
    if (req.user.role === 'manager' && ['admin'].includes(newRole)) {
      return res.status(403).json({ error: 'Un manager ne peut pas promouvoir en admin.' });
    }

    // Trouver le membre cible dans la même organisation
    const targetUser = await User.findOne({
      where: { id: targetUserId, organizationId: orgId }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Membre introuvable dans votre organisation.' });
    }

    // Interdire de modifier un superadmin
    if (targetUser.role === 'superadmin') {
      return res.status(403).json({ error: 'Impossible de modifier le rôle d\'un Super-Admin.' });
    }

    // Un manager ne peut pas modifier un admin
    if (req.user.role === 'manager' && targetUser.role === 'admin') {
      return res.status(403).json({ error: 'Un manager ne peut pas modifier le rôle d\'un admin.' });
    }

    const before = { role: targetUser.role };
    targetUser.role = newRole;
    await targetUser.save();

    // Log d'audit
    await AdminLog.create({
      adminId: req.user.id,
      organizationId: orgId,
      action: 'ASSIGN_ROLE',
      targetType: 'User',
      targetId: targetUser.id,
      changes: { before, after: { role: newRole } },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 500),
      metadata: { targetEmail: targetUser.email }
    });

    res.status(200).json({
      message: `Rôle de ${targetUser.email} changé en "${newRole}".`,
      data: {
        user: {
          id: targetUser.id,
          email: targetUser.email,
          role: newRole,
          previousRole: before.role
        }
      }
    });
  } catch (err) {
    console.error('Erreur changeRole:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

/**
 * POST /api/v1/admin/members
 * Ajouter un nouveau membre à l'organisation.
 * L'admin crée le compte directement (pas d'auto-inscription).
 */
exports.addMember = async (req, res) => {
  try {
    const { email, password, role = 'user' } = req.body;
    const orgId = req.user.organizationId;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe sont requis.' });
    }

    // Validation du rôle
    const allowedRoles = ['manager', 'staff', 'accountant', 'user'];
    if (req.user.role === 'admin') allowedRoles.push('admin');

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        error: `Rôle invalide. Rôles autorisés pour vous: ${allowedRoles.join(', ')}`
      });
    }

    // Vérifier que l'email n'est pas déjà pris
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé.' });
    }

    const crypto = require('crypto');
    const newUser = await User.create({
      email,
      password,
      role,
      organizationId: orgId,
      referral_code: crypto.randomBytes(6).toString('hex').toUpperCase()
    });

    // Log d'audit
    await AdminLog.create({
      adminId: req.user.id,
      organizationId: orgId,
      action: 'CREATE_USER',
      targetType: 'User',
      targetId: newUser.id,
      changes: { after: { email, role } },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 500)
    });

    res.status(201).json({
      message: 'Membre ajouté avec succès.',
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
          referral_code: newUser.referral_code
        }
      }
    });
  } catch (err) {
    console.error('Erreur addMember:', err);
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Problème d\'unicité.' });
    }
    res.status(500).json({ error: 'Erreur interne.' });
  }
};
