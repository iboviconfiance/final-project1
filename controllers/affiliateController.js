/**
 * ============================================================
 * Affiliate Controller — Partenaires BtoB (Option C)
 * ============================================================
 * 
 * Géré EXCLUSIVEMENT par le Super-Admin.
 */

const { Affiliate, AffiliateCommission, Organization } = require('../models');
const { Op } = require('sequelize');

/**
 * GET /api/v1/superadmin/affiliates
 * Liste des affiliés
 */
async function listAffiliates(req, res) {
  try {
    const { page = 1, status } = req.query;
    const limit = 20;
    const offset = (page - 1) * limit;
    const where = {};

    if (status) where.status = status;

    const { rows, count } = await Affiliate.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    // Stats globales
    const totalEarned = await Affiliate.sum('totalEarned') || 0;
    const totalPaid = await Affiliate.sum('totalPaid') || 0;
    const totalOrgsReferred = await Affiliate.sum('organizationsReferred') || 0;

    return res.json({
      data: {
        affiliates: rows,
        total: count,
        totalPages: Math.ceil(count / limit),
        page: parseInt(page),
        stats: {
          totalAffiliates: count,
          totalEarned,
          totalPaid,
          totalUnpaid: totalEarned - totalPaid,
          totalOrgsReferred,
        },
      },
    });
  } catch (err) {
    console.error('Erreur list affiliates:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

/**
 * POST /api/v1/superadmin/affiliates
 * Créer un affilié
 */
async function createAffiliate(req, res) {
  try {
    const { name, email, phone, affiliateCode, commissionType, commissionValue, notes } = req.body;

    if (!name || !affiliateCode) {
      return res.status(400).json({ error: 'Nom et code affilié requis.' });
    }

    const existing = await Affiliate.findOne({
      where: { affiliateCode: affiliateCode.toUpperCase() },
    });
    if (existing) {
      return res.status(409).json({ error: 'Ce code affilié existe déjà.' });
    }

    const affiliate = await Affiliate.create({
      name,
      email,
      phone,
      affiliateCode: affiliateCode.toUpperCase(),
      commissionType: commissionType || 'percentage',
      commissionValue: commissionValue || 10,
      notes,
    });

    return res.status(201).json({ data: affiliate });
  } catch (err) {
    console.error('Erreur create affiliate:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

/**
 * PUT /api/v1/superadmin/affiliates/:id
 * Modifier un affilié
 */
async function updateAffiliate(req, res) {
  try {
    const affiliate = await Affiliate.findByPk(req.params.id);
    if (!affiliate) return res.status(404).json({ error: 'Affilié introuvable.' });

    const { status, commissionType, commissionValue, notes } = req.body;
    if (status) affiliate.status = status;
    if (commissionType) affiliate.commissionType = commissionType;
    if (commissionValue !== undefined) affiliate.commissionValue = commissionValue;
    if (notes !== undefined) affiliate.notes = notes;

    await affiliate.save();
    return res.json({ data: affiliate });
  } catch (err) {
    console.error('Erreur update affiliate:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

/**
 * GET /api/v1/superadmin/affiliates/:id/commissions
 * Détail des commissions d'un affilié
 */
async function getCommissions(req, res) {
  try {
    const commissions = await AffiliateCommission.findAll({
      where: { affiliateId: req.params.id },
      include: [{
        model: Organization,
        attributes: ['id', 'name', 'slug'],
      }],
      order: [['createdAt', 'DESC']],
    });

    return res.json({ data: commissions });
  } catch (err) {
    console.error('Erreur get commissions:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

/**
 * POST /api/v1/superadmin/affiliates/:id/pay
 * Marquer des commissions comme payées
 */
async function markCommissionsPaid(req, res) {
  try {
    const affiliate = await Affiliate.findByPk(req.params.id);
    if (!affiliate) return res.status(404).json({ error: 'Affilié introuvable.' });

    const { commissionIds } = req.body;
    if (!commissionIds?.length) {
      return res.status(400).json({ error: 'Aucune commission sélectionnée.' });
    }

    const commissions = await AffiliateCommission.findAll({
      where: {
        id: { [Op.in]: commissionIds },
        affiliateId: affiliate.id,
        status: 'pending',
      },
    });

    let totalPaid = 0;
    for (const c of commissions) {
      c.status = 'paid';
      c.paidAt = new Date();
      await c.save();
      totalPaid += parseFloat(c.amount);
    }

    affiliate.totalPaid = parseFloat(affiliate.totalPaid) + totalPaid;
    await affiliate.save();

    return res.json({
      data: {
        paidCount: commissions.length,
        totalPaid,
      },
    });
  } catch (err) {
    console.error('Erreur mark paid:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

/**
 * Enregistre une commission quand une org ramenée paie.
 * Appelé en interne par le webhook controller.
 */
async function recordCommission(affiliateCode, organizationId, transactionAmount) {
  try {
    const affiliate = await Affiliate.findOne({
      where: { affiliateCode, status: 'active' },
    });
    if (!affiliate) return null;

    let commissionAmount;
    if (affiliate.commissionType === 'percentage') {
      commissionAmount = Math.round(transactionAmount * (parseFloat(affiliate.commissionValue) / 100));
    } else {
      commissionAmount = parseFloat(affiliate.commissionValue);
    }

    const commission = await AffiliateCommission.create({
      affiliateId: affiliate.id,
      organizationId,
      amount: commissionAmount,
    });

    affiliate.totalEarned = parseFloat(affiliate.totalEarned) + commissionAmount;
    await affiliate.save();

    return commission;
  } catch (err) {
    console.error('Erreur record commission:', err);
    return null;
  }
}

module.exports = {
  listAffiliates,
  createAffiliate,
  updateAffiliate,
  getCommissions,
  markCommissionsPaid,
  recordCommission,
};
