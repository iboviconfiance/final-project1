/**
 * ============================================================
 * Coupon Controller — Gestion des codes promos
 * ============================================================
 * 
 * Admin : CRUD des coupons pour son organisation
 * Client : Validation d'un code promo avant paiement
 */

const Coupon = require('../models/Coupon');
const UserCoupon = require('../models/UserCoupon');
const discountService = require('../services/discountService');
const { Op } = require('sequelize');

/**
 * POST /api/v1/coupons/validate
 * Client valide un code promo (avant paiement)
 */
async function validateCoupon(req, res) {
  try {
    const { code, planId } = req.body;
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    if (!code || !planId) {
      return res.status(400).json({ error: 'Code et plan requis.' });
    }

    const Plan = require('../models/Plan');
    const plan = await Plan.findOne({
      where: { id: planId, organizationId },
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan introuvable.' });
    }

    const result = await discountService.validateCoupon(
      code,
      userId,
      organizationId,
      parseFloat(plan.price)
    );

    return res.json({ data: result });
  } catch (err) {
    console.error('Erreur validation coupon:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

/**
 * GET /api/v1/coupons
 * Admin : Liste des coupons de son organisation
 */
async function listCoupons(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const { page = 1, status } = req.query;
    const limit = 20;
    const offset = (page - 1) * limit;

    const where = { organizationId };
    if (status === 'active') {
      where.isActive = true;
      where[Op.or] = [
        { expiresAt: null },
        { expiresAt: { [Op.gt]: new Date() } },
      ];
    } else if (status === 'expired') {
      where[Op.or] = [
        { isActive: false },
        { expiresAt: { [Op.lt]: new Date() } },
      ];
    }

    const { rows, count } = await Coupon.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    // Enrichir avec les stats d'utilisation
    const couponsWithStats = await Promise.all(rows.map(async (c) => {
      const totalRevenue = await UserCoupon.sum('discountAmount', {
        where: { couponId: c.id },
      });

      return {
        ...c.toJSON(),
        totalRevenue: totalRevenue || 0,
        isExpired: c.expiresAt && new Date(c.expiresAt) < new Date(),
        isExhausted: c.maxUses !== null && c.currentUses >= c.maxUses,
      };
    }));

    return res.json({
      data: {
        coupons: couponsWithStats,
        total: count,
        totalPages: Math.ceil(count / limit),
        page: parseInt(page),
      },
    });
  } catch (err) {
    console.error('Erreur list coupons:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

/**
 * POST /api/v1/coupons
 * Admin : Créer un nouveau coupon
 */
async function createCoupon(req, res) {
  try {
    const { code, type, value, minPurchase, maxUses, expiresAt } = req.body;
    const organizationId = req.user.organizationId;

    // Validations
    if (!code || !type || !value) {
      return res.status(400).json({ error: 'Code, type et valeur requis.' });
    }

    if (!['fixed', 'percentage'].includes(type)) {
      return res.status(400).json({ error: 'Type invalide (fixed ou percentage).' });
    }

    if (type === 'percentage' && (value < 1 || value > 100)) {
      return res.status(400).json({ error: 'Le pourcentage doit être entre 1 et 100.' });
    }

    // Vérifier unicité dans l'org
    const existing = await Coupon.findOne({
      where: { code: code.toUpperCase(), organizationId },
    });
    if (existing) {
      return res.status(409).json({ error: 'Ce code existe déjà.' });
    }

    const coupon = await Coupon.create({
      code: code.toUpperCase().replace(/[^A-Z0-9\-_]/g, ''),
      type,
      value,
      minPurchase: minPurchase ? parseFloat(minPurchase) : 0,
      maxUses: maxUses ? parseInt(maxUses) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      organizationId,
      createdBy: req.user.id,
    });

    return res.status(201).json({ data: coupon });
  } catch (err) {
    console.error('Erreur create coupon:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

/**
 * PUT /api/v1/coupons/:id
 * Admin : Modifier un coupon
 */
async function updateCoupon(req, res) {
  try {
    const coupon = await Coupon.findOne({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });

    if (!coupon) {
      return res.status(404).json({ error: 'Coupon introuvable.' });
    }

    const { isActive, maxUses, expiresAt, minPurchase } = req.body;
    if (isActive !== undefined) coupon.isActive = isActive;
    if (maxUses !== undefined) coupon.maxUses = maxUses;
    if (expiresAt !== undefined) coupon.expiresAt = expiresAt;
    if (minPurchase !== undefined) coupon.minPurchase = minPurchase;

    await coupon.save();
    return res.json({ data: coupon });
  } catch (err) {
    console.error('Erreur update coupon:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

/**
 * DELETE /api/v1/coupons/:id
 * Admin : Désactiver (soft delete)
 */
async function deleteCoupon(req, res) {
  try {
    const coupon = await Coupon.findOne({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });

    if (!coupon) {
      return res.status(404).json({ error: 'Coupon introuvable.' });
    }

    coupon.isActive = false;
    await coupon.save();

    return res.json({ message: 'Coupon désactivé.' });
  } catch (err) {
    console.error('Erreur delete coupon:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

/**
 * GET /api/v1/coupons/stats
 * Admin : Statistiques marketing des coupons
 */
async function couponStats(req, res) {
  try {
    const organizationId = req.user.organizationId;

    const totalCoupons = await Coupon.count({ where: { organizationId } });
    const activeCoupons = await Coupon.count({ where: { organizationId, isActive: true } });
    const totalUsages = await Coupon.sum('currentUses', { where: { organizationId } });
    const totalDiscountGiven = await UserCoupon.sum('discountAmount', {
      include: [{ model: Coupon, where: { organizationId }, attributes: [] }],
    }) || 0;

    return res.json({
      data: {
        totalCoupons,
        activeCoupons,
        totalUsages: totalUsages || 0,
        totalDiscountGiven,
      },
    });
  } catch (err) {
    console.error('Erreur coupon stats:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

module.exports = {
  validateCoupon,
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  couponStats,
};
