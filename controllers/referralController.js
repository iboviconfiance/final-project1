/**
 * ============================================================
 * Referral Controller — Parrainage BtoC
 * ============================================================
 */

const discountService = require('../services/discountService');
const Referral = require('../models/Referral');
const { User } = require('../models');
const { Op } = require('sequelize');

/**
 * GET /api/v1/referrals/my
 * Client : Mon code + mes filleuls
 */
async function getMyReferrals(req, res) {
  try {
    const stats = await discountService.getReferralStats(
      req.user.id,
      req.user.organizationId
    );
    return res.json({ data: stats });
  } catch (err) {
    console.error('Erreur get referrals:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

/**
 * GET /api/v1/referrals/admin
 * Admin : Tous les parrainages de l'organisation
 */
async function getOrgReferrals(req, res) {
  try {
    const { page = 1, status } = req.query;
    const limit = 20;
    const offset = (page - 1) * limit;
    const where = { organizationId: req.user.organizationId };

    if (status) where.status = status;

    const { rows, count } = await Referral.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'referrer',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
        {
          model: User,
          as: 'referred',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    const completed = await Referral.count({
      where: { organizationId: req.user.organizationId, status: 'completed' },
    });
    const totalBonusDays = await Referral.sum('rewardValue', {
      where: {
        organizationId: req.user.organizationId,
        status: 'completed',
        rewardType: 'days',
      },
    }) || 0;

    return res.json({
      data: {
        referrals: rows,
        total: count,
        totalPages: Math.ceil(count / limit),
        page: parseInt(page),
        stats: {
          total: count,
          completed,
          totalBonusDays,
          rejected: await Referral.count({
            where: { organizationId: req.user.organizationId, status: 'rejected' },
          }),
        },
      },
    });
  } catch (err) {
    console.error('Erreur org referrals:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

/**
 * PUT /api/v1/referrals/config
 * Admin : Configurer les récompenses de parrainage
 */
async function updateReferralConfig(req, res) {
  try {
    const { Organization } = require('../models');
    const org = await Organization.findByPk(req.user.organizationId);
    if (!org) return res.status(404).json({ error: 'Organisation introuvable.' });

    const { rewardType, rewardValue, referredDiscount, enabled } = req.body;
    const settings = org.settings || {};
    settings.referral = {
      ...settings.referral,
      rewardType: rewardType || settings.referral?.rewardType || 'days',
      rewardValue: rewardValue ?? settings.referral?.rewardValue ?? 5,
      referredDiscount: referredDiscount ?? settings.referral?.referredDiscount ?? 10,
      enabled: enabled ?? settings.referral?.enabled ?? true,
    };

    org.settings = settings;
    org.changed('settings', true);
    await org.save();

    return res.json({ data: settings.referral });
  } catch (err) {
    console.error('Erreur update referral config:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

/**
 * GET /api/v1/referrals/config
 * Admin : Lire la config parrainage
 */
async function getReferralConfig(req, res) {
  try {
    const { Organization } = require('../models');
    const org = await Organization.findByPk(req.user.organizationId);
    const config = org?.settings?.referral || {
      rewardType: 'days',
      rewardValue: 5,
      referredDiscount: 10,
      enabled: true,
    };
    return res.json({ data: config });
  } catch (err) {
    console.error('Erreur get referral config:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

module.exports = {
  getMyReferrals,
  getOrgReferrals,
  updateReferralConfig,
  getReferralConfig,
};
