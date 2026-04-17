const { Organization, User, Transaction, Subscription, Plan, AdminLog, Announcement, sequelize } = require('../models');
const { Op, fn, col, literal } = require('sequelize');

/**
 * ============================================================
 * Super-Admin Controller — "God Mode"
 * ============================================================
 * 
 * Accessible UNIQUEMENT via le middleware superAdminAuth.
 * Le rôle 'superadmin' est attribué uniquement en BDD directe.
 * 
 * Fonctionnalités :
 * - Vue globale de toutes les organisations
 * - Suspension / activation d'organisations
 * - Statistiques globales (CA total, users actifs, etc.)
 * - Validation manuelle de paiements (si webhook a échoué)
 * - Consultation des logs d'audit admin
 * - Gestion du churn (annulation + offre de rétention)
 */

// ============================================================
// ORGANISATIONS
// ============================================================

/**
 * GET /api/v1/superadmin/organizations
 * Liste TOUTES les organisations avec statistiques.
 */
exports.listOrganizations = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status) where.status = status;
    if (search) where.name = { [Op.iLike]: `%${search}%` };

    const orgs = await Organization.findAndCountAll({
      where,
      include: [{
        model: User,
        as: 'users',
        attributes: ['id', 'role'] // included to get admin
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
      distinct: true
    });

    const organizations = orgs.rows.map(org => {
      const orgJSON = org.toJSON();
      const admin = orgJSON.users?.find(u => u.role === 'admin' || u.role === 'manager');
      return {
        ...orgJSON,
        userCount: orgJSON.users?.length || 0,
        adminId: admin ? admin.id : null,
        users: undefined // hide users list
      };
    });

    res.status(200).json({
      message: 'Organisations récupérées.',
      data: {
        total: orgs.count,
        page: parseInt(page),
        totalPages: Math.ceil(orgs.count / parseInt(limit)),
        organizations
      }
    });
  } catch (error) {
    console.error('Erreur listOrganizations:', error);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

/**
 * PUT /api/v1/superadmin/organizations/:id/suspend
 * Suspend une organisation (ses utilisateurs ne peuvent plus se connecter).
 */
exports.suspendOrganization = async (req, res) => {
  try {
    const org = await Organization.findByPk(req.params.id);
    if (!org) return res.status(404).json({ error: 'Organisation introuvable.' });

    const before = { status: org.status };
    org.status = 'suspended';
    await org.save();

    // Log admin
    await AdminLog.create({
      adminId: req.user.id,
      organizationId: null, // Action Super-Admin
      action: 'SUSPEND_ORG',
      targetType: 'Organization',
      targetId: org.id,
      changes: { before, after: { status: 'suspended' } },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 500)
    });

    res.status(200).json({
      message: `Organisation "${org.name}" suspendue.`,
      data: { organization: { id: org.id, name: org.name, status: org.status } }
    });
  } catch (error) {
    console.error('Erreur suspendOrganization:', error);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

/**
 * PUT /api/v1/superadmin/organizations/:id/activate
 */
exports.activateOrganization = async (req, res) => {
  try {
    const org = await Organization.findByPk(req.params.id);
    if (!org) return res.status(404).json({ error: 'Organisation introuvable.' });

    const before = { status: org.status };
    org.status = 'active';
    await org.save();

    await AdminLog.create({
      adminId: req.user.id,
      organizationId: null,
      action: 'ACTIVATE_ORG',
      targetType: 'Organization',
      targetId: org.id,
      changes: { before, after: { status: 'active' } },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 500)
    });

    res.status(200).json({
      message: `Organisation "${org.name}" activée.`,
      data: { organization: { id: org.id, name: org.name, status: org.status } }
    });
  } catch (error) {
    console.error('Erreur activateOrganization:', error);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

// ============================================================
// STATISTIQUES GLOBALES
// ============================================================

/**
 * GET /api/v1/superadmin/stats
 * Statistiques globales de la plateforme (pour dashboard frontend).
 */
exports.getGlobalStats = async (req, res) => {
  try {
    const [
      totalOrgs,
      totalUsers,
      activeSubscriptions,
      totalRevenue,
      revenueThisMonth,
      transactionsByStatus,
      topOrgs
    ] = await Promise.all([
      Organization.count(),
      User.count(),
      Subscription.count({ where: { status: ['active', 'grace_period'] } }),
      Transaction.sum('amount', { where: { status: 'success' } }),
      Transaction.sum('amount', {
        where: {
          status: 'success',
          createdAt: { [Op.gte]: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
        }
      }),
      Transaction.findAll({
        attributes: ['status', [fn('COUNT', col('id')), 'count']],
        group: ['status']
      }),
      Organization.findAll({
        include: [{
          model: User,
          as: 'users',
          attributes: [],
          include: [{
            model: Transaction,
            as: 'transactions',
            attributes: [],
            where: { status: 'success' },
            required: false
          }]
        }],
        attributes: [
          'id', 'name', 'status',
          [fn('COALESCE', fn('SUM', col('users->transactions.amount')), 0), 'totalRevenue']
        ],
        group: ['Organization.id'],
        order: [[literal('"totalRevenue"'), 'DESC']],
        limit: 5,
        subQuery: false
      })
    ]);

    res.status(200).json({
      message: 'Statistiques globales.',
      data: {
        overview: {
          totalOrganizations: totalOrgs,
          totalUsers,
          activeSubscriptions,
          totalRevenue: totalRevenue || 0,
          revenueThisMonth: revenueThisMonth || 0,
          currency: 'XAF'
        },
        transactionsByStatus: transactionsByStatus.reduce((acc, t) => {
          acc[t.status] = parseInt(t.get('count'));
          return acc;
        }, {}),
        topOrganizations: topOrgs.map(o => ({
          id: o.id,
          name: o.name,
          status: o.status,
          totalRevenue: parseFloat(o.get('totalRevenue')) || 0
        }))
      }
    });
  } catch (error) {
    console.error('Erreur getGlobalStats:', error);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

// ============================================================
// VALIDATION MANUELLE DE PAIEMENT
// ============================================================

/**
 * POST /api/v1/superadmin/transactions/:id/validate
 * Confirme manuellement une transaction si le webhook a échoué.
 */
exports.manualPaymentValidation = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const transaction = await Transaction.findByPk(req.params.id, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!transaction) {
      await t.rollback();
      return res.status(404).json({ error: 'Transaction introuvable.' });
    }

    if (transaction.status === 'success') {
      await t.rollback();
      return res.status(400).json({ error: 'Transaction déjà validée.' });
    }

    const before = { status: transaction.status };
    transaction.status = 'success';
    transaction.metadata = {
      ...transaction.metadata,
      manualValidation: true,
      validatedBy: req.user.id,
      validatedAt: new Date().toISOString(),
      reason: req.body.reason || 'Validation manuelle par Super-Admin'
    };
    await transaction.save({ transaction: t });

    // Activer l'abonnement lié
    if (transaction.subscriptionId) {
      const subscription = await Subscription.findByPk(transaction.subscriptionId, { transaction: t });
      if (subscription && subscription.status === 'pending') {
        subscription.status = 'active';
        await subscription.save({ transaction: t });
      }
    }

    await t.commit();

    await AdminLog.create({
      adminId: req.user.id,
      organizationId: null,
      action: 'MANUAL_PAYMENT',
      targetType: 'Transaction',
      targetId: transaction.id,
      changes: { before, after: { status: 'success', manualValidation: true } },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 500),
      metadata: { reason: req.body.reason }
    });

    res.status(200).json({
      message: 'Transaction validée manuellement.',
      data: {
        transaction: {
          id: transaction.id,
          status: 'success',
          amount: transaction.amount,
          validatedAt: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error('Erreur manualPaymentValidation:', error);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

// ============================================================
// GESTION DU CHURN (ANNULATION)
// ============================================================

/**
 * POST /api/v1/superadmin/subscriptions/:id/cancel
 * Annule un abonnement avec option de rétention.
 */
exports.cancelSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findByPk(req.params.id, {
      include: [{ model: Plan, as: 'plan' }]
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Abonnement introuvable.' });
    }

    const before = {
      status: subscription.status,
      autoRenew: subscription.autoRenew
    };

    // Désactiver le renouvellement automatique
    subscription.autoRenew = false;

    // Si annulation immédiate demandée
    if (req.body.immediate) {
      subscription.status = 'expired';
    }

    await subscription.save();

    // Calculer l'offre de rétention (réduction de 30% sur le prochain renouvellement)
    let retentionOffer = null;
    if (subscription.plan && !req.body.immediate) {
      retentionOffer = {
        discountPercent: 30,
        originalPrice: subscription.plan.price,
        discountedPrice: Math.round(subscription.plan.price * 0.7),
        validUntil: subscription.endDate,
        message: `Offre spéciale : -30% sur votre prochain renouvellement (${Math.round(subscription.plan.price * 0.7)} XAF au lieu de ${subscription.plan.price} XAF)`
      };
    }

    await AdminLog.create({
      adminId: req.user.id,
      organizationId: null,
      action: 'CANCEL_SUBSCRIPTION',
      targetType: 'Subscription',
      targetId: subscription.id,
      changes: {
        before,
        after: {
          status: subscription.status,
          autoRenew: false,
          retentionOffered: !!retentionOffer
        }
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 500)
    });

    res.status(200).json({
      message: req.body.immediate
        ? 'Abonnement annulé immédiatement.'
        : 'Renouvellement automatique désactivé. L\'abonnement reste actif jusqu\'à la fin de la période.',
      data: {
        subscription: {
          id: subscription.id,
          status: subscription.status,
          autoRenew: false,
          endDate: subscription.endDate
        },
        retentionOffer
      }
    });
  } catch (error) {
    console.error('Erreur cancelSubscription:', error);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

// ============================================================
// LOGS D'AUDIT ADMIN
// ============================================================

/**
 * GET /api/v1/superadmin/audit-logs
 * Historique complet des actions admin sur la plateforme.
 * ISOLATION : Les admins clients ne voient pas les logs Super-Admin.
 */
exports.getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, action, adminId, organizationId } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (action) where.action = action;
    if (adminId) where.adminId = adminId;
    if (organizationId) where.organizationId = organizationId;

    const { count, rows: logs } = await AdminLog.findAndCountAll({
      where,
      include: [{
        model: User,
        as: 'admin',
        attributes: ['id', 'email', 'role']
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.status(200).json({
      message: 'Logs d\'audit récupérés.',
      data: {
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
        logs: logs.map(log => ({
          id: log.id,
          action: log.action,
          admin: log.admin ? { id: log.admin.id, email: log.admin.email, role: log.admin.role } : null,
          targetType: log.targetType,
          targetId: log.targetId,
          changes: log.changes,
          ipAddress: log.ipAddress,
          createdAt: log.createdAt,
          metadata: log.metadata
        }))
      }
    });
  } catch (error) {
    console.error('Erreur getAuditLogs:', error);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

// ============================================================
// IMPERSONATION — "Shadowing" (Se connecter en tant que)
// ============================================================

/**
 * POST /api/v1/superadmin/impersonate/:userId
 * Génère un token JWT spécial pour se connecter "en tant que" un admin.
 * 
 * SÉCURITÉ :
 * - Log d'audit IMPERSONATION_START (obligatoire, non suppressible)
 * - Le JWT généré contient un flag `isImpersonated: true`
 * - Le `realUserId` (Super-Admin) est stocké dans le token
 * - Durée de vie courte (1h max)
 */
exports.impersonate = async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({
        error: 'Une raison d\'au moins 5 caractères est requise pour l\'impersonation.'
      });
    }

    // Trouver l'utilisateur cible
    const targetUser = await User.findByPk(targetUserId, {
      include: [{
        model: Organization,
        as: 'organization',
        attributes: ['id', 'name', 'slug', 'status']
      }]
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Utilisateur cible introuvable.' });
    }

    // Interdire l'impersonation d'un autre superadmin
    if (targetUser.role === 'superadmin') {
      return res.status(403).json({
        error: 'Impossible d\'impersonifier un autre Super-Admin.'
      });
    }

    // Générer un JWT spécial (durée courte : 1h)
    const jwt = require('jsonwebtoken');
    const impersonationToken = jwt.sign(
      {
        id: targetUser.id,
        role: targetUser.role,
        organizationId: targetUser.organizationId,
        isImpersonated: true,
        realUserId: req.user.id,
        impersonatedAt: new Date().toISOString()
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // ── LOG D'AUDIT CRITIQUE — IMPERSONATION_START ──
    await AdminLog.create({
      adminId: req.user.id,
      organizationId: null, // Action Super-Admin
      action: 'IMPERSONATION_START',
      targetType: 'User',
      targetId: targetUser.id,
      changes: {
        impersonatedUser: {
          id: targetUser.id,
          email: targetUser.email,
          role: targetUser.role,
          organizationId: targetUser.organizationId,
          orgName: targetUser.organization?.name || null
        }
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 500),
      metadata: {
        reason: reason.trim(),
        tokenExpiresIn: '1h',
        startedAt: new Date().toISOString()
      }
    });

    console.warn(
      `🎭 IMPERSONATION: SuperAdmin ${req.user.id} → User ${targetUser.email} ` +
      `(${targetUser.role}) | Raison: ${reason}`
    );

    res.status(200).json({
      message: `Impersonation de ${targetUser.email} activée (1h max).`,
      data: {
        token: impersonationToken,
        expiresIn: '1h',
        targetUser: {
          id: targetUser.id,
          email: targetUser.email,
          role: targetUser.role,
          organization: targetUser.organization ? {
            id: targetUser.organization.id,
            name: targetUser.organization.name
          } : null
        },
        warning: '⚠️ Toutes les actions effectuées avec ce token sont tracées et liées à votre compte Super-Admin.'
      }
    });
  } catch (error) {
    console.error('Erreur impersonate:', error);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

/**
 * POST /api/v1/superadmin/impersonate/end
 * Termine une session d'impersonation et log l'événement.
 */
exports.endImpersonation = async (req, res) => {
  try {
    await AdminLog.create({
      adminId: req.user.id,
      organizationId: null,
      action: 'IMPERSONATION_END',
      targetType: 'User',
      targetId: req.body.targetUserId || null,
      changes: {},
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 500),
      metadata: { endedAt: new Date().toISOString() }
    });

    res.status(200).json({
      message: 'Session d\'impersonation terminée.',
      data: { endedAt: new Date().toISOString() }
    });
  } catch (error) {
    console.error('Erreur endImpersonation:', error);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

// ============================================================
// ANNONCES GLOBALES
// ============================================================

/**
 * POST /api/v1/superadmin/announcements
 * Créer une annonce globale.
 */
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, content, type = 'info', target = 'all', targetValue, priority = 'normal', expiresAt } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Titre et contenu sont requis.' });
    }

    if (title.length < 3 || title.length > 200) {
      return res.status(400).json({ error: 'Le titre doit contenir entre 3 et 200 caractères.' });
    }

    if (content.length < 10) {
      return res.status(400).json({ error: 'Le contenu doit contenir au moins 10 caractères.' });
    }

    const announcement = await Announcement.create({
      authorId: req.user.id,
      title,
      content,
      type,
      target,
      targetValue: targetValue || null,
      priority,
      expiresAt: expiresAt ? new Date(expiresAt) : null
    });

    // Log d'audit
    await AdminLog.create({
      adminId: req.user.id,
      organizationId: null,
      action: 'GLOBAL_ANNOUNCEMENT',
      targetType: 'Announcement',
      targetId: announcement.id,
      changes: { after: { title, type, target, priority } },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 500)
    });

    res.status(201).json({
      message: 'Annonce créée et diffusée.',
      data: { announcement }
    });
  } catch (error) {
    console.error('Erreur createAnnouncement:', error);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

/**
 * GET /api/v1/superadmin/announcements
 * Liste toutes les annonces (actives et expirées).
 */
exports.listAnnouncements = async (req, res) => {
  try {
    const { page = 1, limit = 20, active } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (active === 'true') {
      where.isActive = true;
      where[Op.or] = [
        { expiresAt: null },
        { expiresAt: { [Op.gt]: new Date() } }
      ];
    }

    const { count, rows: announcements } = await Announcement.findAndCountAll({
      where,
      include: [{ model: User, as: 'author', attributes: ['id', 'email'] }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.status(200).json({
      message: 'Annonces récupérées.',
      data: {
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
        announcements
      }
    });
  } catch (error) {
    console.error('Erreur listAnnouncements:', error);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

/**
 * PUT /api/v1/superadmin/announcements/:id/deactivate
 * Désactiver une annonce (sans la supprimer).
 */
exports.deactivateAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findByPk(req.params.id);
    if (!announcement) {
      return res.status(404).json({ error: 'Annonce introuvable.' });
    }

    announcement.isActive = false;
    await announcement.save();

    res.status(200).json({
      message: 'Annonce désactivée.',
      data: { announcement: { id: announcement.id, isActive: false } }
    });
  } catch (error) {
    console.error('Erreur deactivateAnnouncement:', error);
    res.status(500).json({ error: 'Erreur interne.' });
  }
};

